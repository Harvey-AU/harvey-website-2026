/**
 * Impact chapter
 *
 * One pinned chapter for the impact statement and its stats. A sticky
 * full-screen stage holds a canvas field of flat strokes that curl into
 * Harvey U smiles, centre first, as you scroll. The statement fades in word
 * by word with the curl, then rises and shrinks to its headline size while
 * the field fades back. Both beats are scrubbed to scroll.
 *
 * When the statement reaches its headline size the stats play once on the
 * clock (about 2.2s): each slides in, its grid of small smiles lights up
 * and its number counts up. From then on the end state holds: scrolling
 * back up does not reverse or replay anything. It also fires on load when
 * the page opens past that point.
 *
 * The layout lives in Webflow: style the stage contents as they should look
 * at the end (statement at headline size, stats in a row, grids full). The
 * script makes the section tall and the stage sticky, adds the canvas
 * behind the copy, fills each grid with its smiles, and scales the
 * statement up from its styled size for the opening beat.
 *
 * Needs GSAP with ScrollTrigger, e.g. from Webflow's GSAP integration. The
 * script splits the statement's words itself, so SplitText is not needed.
 * Without GSAP, or with reduced motion, nothing pins: the field sits still
 * and faint behind the copy, grids are full and numbers are final.
 *
 * Load standalone on pages that need it (not part of the framework's main.js):
 *   <script src="https://cdn.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@1.7.0/js/impact-chapter.js" defer></script>
 *
 * Markup (attribute prefix data-impact-chapter):
 *   [data-impact-chapter]              Section component, the scroll track.
 *                                      The script sets its height (420vh,
 *                                      380vh at 991px and below).
 *     [-stage]                         Full-screen stage, made sticky. The
 *                                      canvas field goes in as its first
 *                                      child, behind everything else.
 *       [-field]                       Optional: a static stand-in for the
 *                                      field, shown without JavaScript.
 *                                      Hidden once the canvas goes in.
 *       [-copy]                        Optional: the statement's container,
 *                                      used to fit the large statement.
 *                                      Defaults to the statement's parent.
 *         [-statement]                 The statement heading, styled at its
 *                                      end (headline) size.
 *         [-stat]                      One stat, in order. Slides in.
 *           [-number]                  The stat's number. Counts up to
 *                                      -count, written with -prefix,
 *                                      -suffix and -decimals.
 *           [-grid]                    Filled with -units smiles that light
 *                                      up as the number counts. Set its
 *                                      columns in Webflow (a CSS grid).
 *                                      Any smiles already inside, shown
 *                                      without JavaScript, are replaced.
 *   [-smile]                           Anywhere: one smile icon, e.g. the
 *                                      key beside each stat. Give it a width.
 *
 * Settings on [-number]:
 *   -count="9027"                      Final value.
 *   -prefix="$"  -suffix="m"           Text either side of the value.
 *   -decimals="1"                      Decimal places (default 0). Whole
 *                                      numbers get thousands separators.
 * Settings on [-grid]:
 *   -units="150"                       Number of smiles in the grid.
 *
 * Smiles are amber; set --impact-chapter-smile on any ancestor to change it.
 */
(function () {
  "use strict";

  const debug = window.WebflowFramework?.debug || function () {};

  // Harvey U smile, used as a mask so the colour comes from the background
  const SMILE_MASK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='521.6 196.6 27 17.2'%3E%3Cpath d='M535.094 213.401C527.874 213.401 522 207.504 522 200.255C522 198.457 523.451 197 525.242 197C527.032 197 528.483 198.457 528.483 200.255C528.483 203.915 531.449 206.892 535.094 206.892C538.74 206.892 541.706 203.915 541.706 200.255C541.706 198.457 543.157 197 544.948 197C546.739 197 548.189 198.457 548.189 200.255C548.189 207.504 542.315 213.401 535.094 213.401Z'/%3E%3C/svg%3E")`;

  const CSS = `
[data-impact-chapter-stage]{position:relative;isolation:isolate}
.impact-chapter-field{position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none}
[data-impact-chapter-unit],[data-impact-chapter-smile]{display:block;aspect-ratio:27/17.2;background:var(--impact-chapter-smile,#ffb200);-webkit-mask:${SMILE_MASK} center/contain no-repeat;mask:${SMILE_MASK} center/contain no-repeat}
[data-impact-chapter].is-impact-chapter-pinned{position:relative;height:420vh}
.is-impact-chapter-pinned [data-impact-chapter-stage]{position:sticky;top:0;height:100vh;overflow:hidden}
.is-impact-chapter-armed [data-impact-chapter-unit]{background:rgba(30,30,30,.14);transform:scale(.7);transition:background-color .35s,transform .6s cubic-bezier(.2,.7,.1,1)}
.is-impact-chapter-armed [data-impact-chapter-unit].is-on{background:var(--impact-chapter-smile,#ffb200);transform:none}
.is-impact-chapter-static [data-impact-chapter-stage]{height:auto;min-height:100vh}
.is-impact-chapter-static [data-impact-chapter-copy]{padding-block:140px 120px}
.is-impact-chapter-static .impact-chapter-field{opacity:.22}
@media (max-width:991px){[data-impact-chapter].is-impact-chapter-pinned{height:380vh}}
`;

  // Scroll lengths in screen heights: the curl (shorter below the tablet
  // breakpoint), then the rise and shrink. The rest of the track is a hold
  // that gives the stats room to play before the pin lets go.
  const CURL = 1.8;
  const CURL_TABLET = 1.4;
  const RISE = 0.6;
  const TABLET_MAX = 991;

  const AMBER = [255, 178, 0];
  const LINE = [21, 21, 20];

  function injectStyles() {
    if (document.getElementById("impact-chapter-styles")) return;
    const style = document.createElement("style");
    style.id = "impact-chapter-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function numberAttr(el, name, fallback) {
    const value = parseFloat(el.getAttribute(name));
    return Number.isFinite(value) ? value : fallback;
  }

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // Keep ScrollTrigger in step with Lenis, whether smooth scroll started
  // before or after this script
  function syncLenis() {
    const update = () => window.ScrollTrigger.update();
    const wire = (lenis) => {
      if (!lenis || lenis.__impactChapterSynced) return;
      lenis.__impactChapterSynced = true;
      lenis.on("scroll", update);
    };
    wire(window.WebflowFramework?.lenis);
    document.addEventListener("smoothScrollReady", (event) => wire(event.detail?.lenis));
  }

  function fillGrids(root) {
    root.querySelectorAll("[data-impact-chapter-grid]").forEach((grid) => {
      const count = Math.max(0, Math.round(numberAttr(grid, "data-impact-chapter-grid-units", 0)));
      if (!count) return;
      grid.setAttribute("aria-hidden", "true");
      grid.replaceChildren(
        ...Array.from({ length: count }, () => {
          const unit = document.createElement("i");
          unit.setAttribute("data-impact-chapter-unit", "");
          return unit;
        })
      );
    });
  }

  // The field: a staggered grid of strokes around an empty ellipse in the
  // middle, each curling from flat into a smile as progress passes its
  // distance from the centre
  function createField(stage) {
    const canvas = document.createElement("canvas");
    canvas.className = "impact-chapter-field";
    canvas.setAttribute("aria-hidden", "true");
    stage.querySelectorAll("[data-impact-chapter-field]").forEach((el) => (el.style.display = "none"));
    stage.prepend(canvas);
    const ctx = canvas.getContext("2d");
    let cells = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let progress = 0;

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const small = width < 600;
      const w = small ? 9 : 12;
      ctx.lineCap = "round";
      ctx.lineWidth = small ? 3.4 : 4.4;
      const grow = Math.min(1, progress / 0.82);
      for (const c of cells) {
        const t = easeInOutQuad(clamp01((grow * 1.5 - c.d * 1.05 - c.j) / 0.42));
        const col = t > 0 ? AMBER.map((v, k) => Math.round(LINE[k] + (v - LINE[k]) * t)) : LINE;
        const a = (0.16 + 0.84 * t) * (0.35 + 0.65 * c.edge);
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
        const dip = w * 1.25 * t;
        const lift = w * 0.25 * t;
        ctx.beginPath();
        ctx.moveTo(c.x - w, c.y - lift);
        ctx.bezierCurveTo(c.x - w, c.y + dip, c.x + w, c.y + dip, c.x + w, c.y - lift);
        ctx.stroke();
      }
    }

    function build() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const step = width < 600 ? 34 : 46;
      const cols = Math.ceil(width / step) + 1;
      const rows = Math.ceil(height / step) + 1;
      const ox = (width - (cols - 1) * step) / 2;
      const oy = (height - (rows - 1) * step) / 2;
      const cx = width / 2;
      const cy = height / 2;
      const rx = Math.min(width * 0.42, 640);
      const ry = Math.min(height * 0.3, 250);
      let maxD = 0;
      cells = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = ox + c * step + (r % 2 ? step / 2 : 0);
          const y = oy + r * step;
          const e = Math.pow((x - cx) / rx, 2) + Math.pow((y - cy) / ry, 2);
          if (e < 1) continue;
          const d = Math.hypot((x - cx) / width, (y - cy) / height);
          maxD = Math.max(maxD, d);
          cells.push({ x, y, d, edge: Math.min(1, (e - 1) / 0.9), j: Math.random() * 0.06 });
        }
      }
      cells.forEach((c) => (c.d /= maxD || 1));
      draw();
    }

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(build, 120);
    });

    return {
      canvas,
      build,
      setProgress(value) {
        if (value === progress) return;
        progress = value;
        draw();
      },
    };
  }

  function createStat(stat) {
    const number = stat.querySelector("[data-impact-chapter-number]");
    if (!number) return null;
    const decimals = Math.max(0, Math.round(numberAttr(number, "data-impact-chapter-number-decimals", 0)));
    return {
      stat,
      number,
      units: [...stat.querySelectorAll("[data-impact-chapter-unit]")],
      lit: 0,
      shown: "",
      end: numberAttr(number, "data-impact-chapter-number-count", 0),
      decimals,
      prefix: number.getAttribute("data-impact-chapter-number-prefix") || "",
      suffix: number.getAttribute("data-impact-chapter-number-suffix") || "",
    };
  }

  // Floored so the count never shows a value it has not reached
  function format(chart, value) {
    const q = Math.pow(10, chart.decimals);
    const v = Math.floor(value * q + 1e-6) / q;
    const text = chart.decimals ? v.toFixed(chart.decimals) : v.toLocaleString("en-AU");
    return chart.prefix + text + chart.suffix;
  }

  // Light units in DOM order and count the number up to fraction f
  function fill(chart, f) {
    const want = Math.round(chart.units.length * f);
    while (chart.lit < want) chart.units[chart.lit++].classList.add("is-on");
    const text = format(chart, chart.end * f);
    if (text !== chart.shown) {
      chart.shown = text;
      chart.number.textContent = text;
    }
  }

  function createChapter(root, animate) {
    const gsap = window.gsap;
    const stage = root.querySelector("[data-impact-chapter-stage]");
    const statement = root.querySelector("[data-impact-chapter-statement]");
    if (!stage || !statement) {
      debug("impact-chapter", "init", "Needs a stage and a statement", "warn");
      return;
    }
    const copy = root.querySelector("[data-impact-chapter-copy]") || statement.parentElement;

    fillGrids(root);
    const field = createField(stage);

    if (!animate) {
      root.classList.add("is-impact-chapter-static");
      field.build();
      field.setProgress(1);
      return;
    }

    root.classList.add("is-impact-chapter-pinned");
    field.build();

    const charts = [...root.querySelectorAll("[data-impact-chapter-stat]")].map(createStat).filter(Boolean);
    charts.forEach((chart) => {
      gsap.set(chart.stat, { opacity: 0, y: 64 });
      fill(chart, 0);
    });

    // Phase ends as fractions of the scroll track, set in measure()
    const phase = { curl: 0.5, rise: 0.75 };
    const geo = { k: 1, dy: 0 };
    const words = gsap.timeline({ paused: true });
    let drawn = -1;
    let fired = false;
    let trigger = null;

    // The statement's styled box is the headline. The opening beat scales
    // it up to the large statement size, centred on the stage.
    function measure() {
      if (fired) return;
      statement.style.transform = "none";
      statement.style.maxWidth = "";
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const startPx = Math.min(76, Math.max(34, vw * 0.046));
      const endPx = parseFloat(getComputedStyle(statement).fontSize);
      const k = startPx / endPx;
      const cs = getComputedStyle(copy);
      const innerWidth = copy.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      statement.style.maxWidth = Math.min(statement.getBoundingClientRect().width, innerWidth / k) + "px";
      const sr = statement.getBoundingClientRect();
      const gr = stage.getBoundingClientRect();
      geo.k = k;
      geo.dy = gr.top + gr.height / 2 - (sr.top + sr.height / 2);
      const travel = Math.max(1, root.offsetHeight - vh);
      const curl = (vw <= TABLET_MAX ? CURL_TABLET : CURL) * vh;
      phase.curl = curl / travel;
      phase.rise = (curl + RISE * vh) / travel;
      drawn = -1;
    }

    function render(p) {
      if (fired) return;
      const c = clamp01(p / phase.curl);
      if (c !== drawn) {
        drawn = c;
        words.progress(c);
        field.setProgress(c);
      }
      const m = easeInOutCubic(clamp01((p - phase.curl) / (phase.rise - phase.curl)));
      const s = geo.k + (1 - geo.k) * m;
      statement.style.transform = `translate(0px,${(geo.dy * (1 - m)).toFixed(2)}px) scale(${s.toFixed(4)})`;
      field.canvas.style.opacity = (1 - 0.9 * m).toFixed(3);
      if (p >= phase.rise) fire();
    }

    // One-shot: lock the opening beat at its end values, drop the scrub,
    // then play the stats on the clock
    function fire() {
      fired = true;
      words.progress(1);
      field.setProgress(1);
      statement.style.transform = "none";
      field.canvas.style.opacity = "0.1";
      if (trigger) {
        const done = trigger;
        trigger = null;
        // Not from inside its own callback
        requestAnimationFrame(() => done.kill());
      }
      const tl = gsap.timeline();
      charts.forEach((chart, i) => {
        const at = i * 0.18;
        const state = { f: 0 };
        tl.to(chart.stat, { opacity: 1, y: 0, duration: 0.9, ease: "expo.out" }, at);
        tl.to(state, { f: 1, duration: 1.6, ease: "power2.inOut", onUpdate: () => fill(chart, state.f) }, at + 0.25);
      });
      debug("impact-chapter", "fire", "Stats playing", "info");
    }

    words.fromTo(splitWords(statement), { opacity: 0.16 }, { opacity: 1, ease: "none", stagger: 0.02, duration: 0.1 }, 0.02);
    words.to({}, { duration: 1 }, 0);
    root.classList.add("is-impact-chapter-armed");

    trigger = window.ScrollTrigger.create({
      trigger: root,
      start: "top top",
      end: "bottom bottom",
      // After any pins above it have added their spacing
      refreshPriority: -1,
      onUpdate: (self) => render(self.progress),
      onRefresh: (self) => {
        measure();
        render(self.progress);
      },
    });
  }

  // Wraps each word of el's text in a plain span, keeping any inline markup
  // and the spaces between words as they are
  function splitWords(el) {
    const words = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const parts = node.textContent.split(/(\s+)/);
      if (parts.length < 2 && !parts[0].trim()) return;
      const fragment = document.createDocumentFragment();
      parts.forEach((part) => {
        if (!part) return;
        if (!part.trim()) {
          fragment.appendChild(document.createTextNode(part));
          return;
        }
        const word = document.createElement("span");
        word.textContent = part;
        words.push(word);
        fragment.appendChild(word);
      });
      node.parentNode.replaceChild(fragment, node);
    });
    return words;
  }

  function start() {
    const gsap = window.gsap;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animate = Boolean(gsap && window.ScrollTrigger) && !reducedMotion;
    if (!gsap || !window.ScrollTrigger) {
      debug("impact-chapter", "init", "GSAP or ScrollTrigger missing, staying static", "warn");
    }
    if (animate) {
      gsap.registerPlugin(window.ScrollTrigger);
      syncLenis();
    }

    document.querySelectorAll("[data-impact-chapter]").forEach((root) => {
      try {
        createChapter(root, animate);
      } catch (error) {
        console.error("Impact chapter failed to start:", error);
      }
    });

    // Images and fonts change heights, and so where the pin starts and ends
    if (animate) window.addEventListener("load", () => window.ScrollTrigger.refresh(), { once: true });
    debug("impact-chapter", "init", "Ready", "info");
  }

  function init() {
    try {
      injectStyles();
      // Wait for web fonts so the statement measures final glyphs
      const safeStart = () => {
        try {
          start();
        } catch (error) {
          console.error("Impact chapter failed to load:", error);
        }
      };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(safeStart);
      else safeStart();
    } catch (error) {
      console.error("Impact chapter failed to load:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
