/**
 * Smile field
 *
 * Fills a section with a field of flat grey strokes that curl into amber
 * Harvey smiles as the page scrolls, centre first, around the section's
 * statement. The section holds still in the middle of the screen while the
 * smiles form, then lets go and scrolls on. Each smile is a squared-off U
 * with gently rounded corners, to match the site's buttons.
 *
 * The field is a canvas the script adds behind the section's content, so the
 * section only needs the attribute. Give it its layout in Webflow (e.g. at
 * least a screen tall, with the statement centred); the strokes keep clear of
 * the statement.
 *
 * Needs GSAP with ScrollTrigger, e.g. from Webflow's GSAP integration.
 * Without them the smiles show fully formed and nothing pins. With SplitText
 * as well, the statement's words also light up from faint to full.
 *
 * Load standalone on pages that need it (not part of the framework's main.js),
 * after pinned-steps.js when both are on a page:
 *   <script src="https://cdn.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@1.4.0/js/smile-field.js" defer></script>
 *
 * Markup:
 *   [data-smile-field]                 Section, pinned while the smiles form.
 *     [data-smile-field-text]          Statement the strokes keep clear of,
 *                                      and whose words light up. Optional:
 *                                      without it the field keeps clear of
 *                                      the section's headings and paragraphs.
 *
 * Settings on [data-smile-field]:
 *   -length="1.5"                      How long it stays pinned, in screen
 *                                      heights of scrolling.
 *   -color="#ffb200"                   Colour the smiles turn.
 *   -from="0.18"                       Opacity the words start at.
 *
 * With reduced motion nothing pins, the smiles show fully formed and the
 * text stays fully lit.
 */
(function () {
  "use strict";

  const debug = window.WebflowFramework?.debug || function () {};

  const CSS = `[data-smile-field]{position:relative;isolation:isolate}
.smile-field_canvas{position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none}`;

  const DEFAULT_LENGTH = 1.5;
  const DEFAULT_COLOR = "#ffb200";
  const DEFAULT_FROM = 0.18;
  // Colour of the flat strokes before they curl
  const LINE = [21, 21, 20];
  // Share of the pin spent forming smiles; the rest holds the full field
  // before the section lets go
  const FORM_SHARE = 0.85;
  // Share of the pin spent lighting words
  const WORDS_SHARE = 0.6;
  // Below this width the field is denser and the smiles smaller
  // Corner radii as shares of the stroke width: a gentle round on the
  // outside of the bends, like the site's buttons, and softer still on the
  // ends and inside
  const CORNER_OUTER = 0.9;
  const CORNER_INNER = 0.25;
  const CORNER_END = 0.3;
  const SMALL_WIDTH = 600;
  // Fewest smiles a row keeps beside the statement
  const MIN_RUN = 2;

  function numberAttr(el, name, fallback) {
    const value = parseFloat(el.getAttribute(name));
    return Number.isFinite(value) ? value : fallback;
  }

  // "#rgb" or "#rrggbb" to [r, g, b]
  function parseHex(value) {
    const match = String(value || "").trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!match) return null;
    let hex = match[1];
    if (hex.length === 3) hex = hex.replace(/./g, "$&$&");
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  }

  function clamp01(value) {
    return Math.min(Math.max(value, 0), 1);
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  // Stable 0..1 noise per grid cell, so a rebuild on resize does not reshuffle
  function noise(col, row) {
    const n = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function injectStyles() {
    if (document.getElementById("smile-field-styles")) return;
    const style = document.createElement("style");
    style.id = "smile-field-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // Each Lenis scroll must move ScrollTrigger, or the pin lags a frame
  function syncLenis() {
    const update = () => window.ScrollTrigger.update();
    const wire = (lenis) => {
      if (!lenis || lenis.__smileFieldSynced) return;
      lenis.__smileFieldSynced = true;
      lenis.on("scroll", update);
    };
    wire(window.WebflowFramework?.lenis);
    document.addEventListener("smoothScrollReady", (event) => wire(event.detail?.lenis));
  }

  // Draws the field into a canvas behind the section's content
  function createField(section) {
    const canvas = document.createElement("canvas");
    canvas.className = "smile-field_canvas";
    canvas.setAttribute("aria-hidden", "true");
    section.prepend(canvas);
    const ctx = canvas.getContext("2d");

    const amber = parseHex(section.getAttribute("data-smile-field-color")) || parseHex(DEFAULT_COLOR);
    const marked = [...section.querySelectorAll("[data-smile-field-text]")];
    const texts = marked.length ? marked : [...section.querySelectorAll("h1, h2, h3, h4, p")];

    let cells = [];
    let width = 0;
    let height = 0;
    let ratio = 1;
    let progress = 0;

    // Bounds of the statement's glyphs, relative to the section
    function textBounds() {
      const box = section.getBoundingClientRect();
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      texts.forEach((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const rect = range.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        left = Math.min(left, rect.left - box.left);
        top = Math.min(top, rect.top - box.top);
        right = Math.max(right, rect.right - box.left);
        bottom = Math.max(bottom, rect.bottom - box.top);
      });
      if (left === Infinity) return null;
      return { left, top, right, bottom };
    }

    function build() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      if (!width || !height) return;
      ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);

      const step = width < SMALL_WIDTH ? 34 : 46;
      const cols = Math.ceil(width / step) + 1;
      const rows = Math.ceil(height / step) + 1;
      const offsetX = (width - (cols - 1) * step) / 2;
      const offsetY = (height - (rows - 1) * step) / 2;
      const pad = step * 0.5;

      // An ellipse around the statement stays clear; strokes near its edge
      // are fainter
      const bounds = textBounds();
      const cx = bounds ? (bounds.left + bounds.right) / 2 : width / 2;
      const cy = bounds ? (bounds.top + bounds.bottom) / 2 : height / 2;
      const rx = bounds ? ((bounds.right - bounds.left) / 2) * 1.18 + step * 0.9 : Math.min(width * 0.42, 640);
      const ry = bounds ? ((bounds.bottom - bounds.top) / 2) * 1.3 + step * 0.9 : Math.min(height * 0.3, 250);

      cells = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = offsetX + col * step + (row % 2 ? step / 2 : 0);
          const y = offsetY + row * step;
          // Only whole smiles, never cut off by the section's edges
          if (x < pad || x > width - pad || y < pad || y > height - pad) continue;
          const inside = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
          if (inside < 1) continue;
          const distance = Math.hypot((x - cx) / width, (y - cy) / height);
          cells.push({ x, y, row, distance, edge: Math.min(1, (inside - 1) / 0.9), jitter: noise(col, row) * 0.06 });
        }
      }
      // A smile or two left alone beside the statement reads as a stray, so
      // a row keeps a side only when at least MIN_RUN smiles sit on it
      const runs = new Map();
      const sideOf = (cell) => `${cell.row}:${cell.x < cx ? "l" : "r"}`;
      cells.forEach((cell) => runs.set(sideOf(cell), (runs.get(sideOf(cell)) || 0) + 1));
      cells = cells.filter((cell) => runs.get(sideOf(cell)) >= MIN_RUN || Math.abs(cell.y - cy) > ry);
      const farthest = cells.reduce((max, cell) => Math.max(max, cell.distance), 0);
      cells.forEach((cell) => (cell.distance /= farthest || 1));
      draw();
    }

    function draw() {
      if (!width || !height) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const small = width < SMALL_WIDTH;
      const half = small ? 9 : 12;
      const stroke = small ? 4.2 : 5.6;

      for (const cell of cells) {
        const t = easeInOut(clamp01((progress * 1.55 - cell.distance - cell.jitter) / 0.45));
        const color = LINE.map((channel, i) => Math.round(channel + (amber[i] - channel) * t));
        const alpha = (0.16 + 0.84 * t) * (0.35 + 0.65 * cell.edge);
        ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${Math.round(alpha * 1000) / 1000})`;
        drawSmile(cell.x, cell.y, half, stroke, t);
      }
    }

    // A flat bar whose ends rise and middle drops into a squared U, drawn as
    // one filled outline so every corner gets its own gentle radius
    function drawSmile(x, y, half, stroke, t) {
      const edge = stroke / 2;
      const bottom = y + half * t;
      const top = Math.min(y - half * 0.15 * t, bottom - edge);
      const outer = half + edge;
      const inner = half - edge;
      // The flat bar starts with even corners; the bends round as they form
      const bend = CORNER_END + (CORNER_OUTER - CORNER_END) * t;
      const points = [
        [x - outer, top, CORNER_END],
        [x - outer, bottom + edge, bend],
        [x + outer, bottom + edge, bend],
        [x + outer, top, CORNER_END],
        [x + inner, top, CORNER_END],
        [x + inner, bottom - edge, CORNER_INNER],
        [x - inner, bottom - edge, CORNER_INNER],
        [x - inner, top, CORNER_END],
      ];
      roundedPath(points, stroke);
      ctx.fill();
    }

    // Closed path through the points, each corner rounded by its share of
    // the stroke, never more than half of either edge it joins
    function roundedPath(points, stroke) {
      const pts = points.filter((p, i) => {
        const next = points[(i + 1) % points.length];
        return Math.hypot(next[0] - p[0], next[1] - p[1]) > 0.01;
      });
      const n = pts.length;
      const length = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
      ctx.beginPath();
      const last = pts[n - 1];
      ctx.moveTo((last[0] + pts[0][0]) / 2, (last[1] + pts[0][1]) / 2);
      for (let i = 0; i < n; i++) {
        const prev = pts[(i + n - 1) % n];
        const point = pts[i];
        const next = pts[(i + 1) % n];
        const r = Math.min(point[2] * stroke, length(prev, point) / 2, length(point, next) / 2);
        ctx.arcTo(point[0], point[1], next[0], next[1], r);
      }
      ctx.closePath();
    }

    function setProgress(value) {
      progress = clamp01(value);
      draw();
    }

    // Rebuild when the section changes size, at most once a frame
    let pending = 0;
    let lastSize = "";
    const observer = new ResizeObserver(() => {
      const size = `${section.clientWidth}x${section.clientHeight}`;
      if (size === lastSize || pending) return;
      lastSize = size;
      pending = requestAnimationFrame(() => {
        pending = 0;
        build();
      });
    });
    observer.observe(section);
    build();

    return { setProgress, texts };
  }

  function createPin(section, field) {
    const gsap = window.gsap;
    const length = Math.max(0, numberAttr(section, "data-smile-field-length", DEFAULT_LENGTH));
    const from = clamp01(numberAttr(section, "data-smile-field-from", DEFAULT_FROM));
    const state = { progress: 0 };

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: section,
        start: "center center",
        end: () => "+=" + window.innerHeight * length,
        pin: true,
        scrub: 0.5,
        invalidateOnRefresh: true,
        // Last pin on the page, so it measures after the others
        refreshPriority: -1,
      },
    });
    tl.to(state, { progress: 1, duration: FORM_SHARE, onUpdate: () => field.setProgress(state.progress) }, 0);
    tl.to({}, { duration: 1 - FORM_SHARE }, FORM_SHARE);

    if (window.SplitText && field.texts.length && section.querySelector("[data-smile-field-text]")) {
      const marked = field.texts.filter((el) => el.hasAttribute("data-smile-field-text"));
      const words = marked.flatMap((el) => new window.SplitText(el, { type: "words" }).words);
      const stagger = WORDS_SHARE / words.length;
      tl.fromTo(words, { opacity: from }, { opacity: 1, duration: stagger * 2, stagger }, 0);
    }
  }

  function start() {
    const sections = document.querySelectorAll("[data-smile-field]");
    if (!sections.length) return;
    injectStyles();

    const gsap = window.gsap;
    const animate = gsap && window.ScrollTrigger && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (animate) {
      gsap.registerPlugin(window.ScrollTrigger);
      if (window.SplitText) gsap.registerPlugin(window.SplitText);
      syncLenis();
    } else {
      debug("smile-field", "init", "No GSAP or reduced motion, showing smiles formed", "info");
    }

    sections.forEach((section) => {
      try {
        const field = createField(section);
        if (animate) createPin(section, field);
        else field.setProgress(1);
      } catch (error) {
        console.error("Smile field failed to start:", error);
      }
    });

    if (animate) {
      // Images and fonts change heights, and so where the pin starts and ends
      window.addEventListener("load", () => window.ScrollTrigger.refresh(), { once: true });
    }
    debug("smile-field", "init", `Ready with ${sections.length} section(s)`, "info");
  }

  function init() {
    // Wait for web fonts so the clear space fits the final glyphs
    const safeStart = () => {
      try {
        start();
      } catch (error) {
        console.error("Smile field failed to load:", error);
      }
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(safeStart);
    else safeStart();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
