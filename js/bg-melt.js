/**
 * Background melt
 *
 * Melts the page background from one section's colour into the next as each
 * section scrolls up the screen, so the sections read as one surface that
 * changes colour rather than as stacked blocks.
 *
 * Each marked section blends in over the band where its top travels from
 * 56% to 42% of the screen height. While the script runs the marked sections
 * go transparent and the body carries the colour, so give each section its
 * real background in Webflow as the fallback without the script.
 *
 * Load standalone on pages that need it (not part of the framework's main.js):
 *   <script src="https://cdn.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@1.1.0/js/bg-melt.js" defer></script>
 *
 * Markup:
 *   [data-bg-melt="#151514"]           A section, in page order. The value is
 *                                      its colour (hex or rgb). Empty takes
 *                                      the section's own background colour.
 *
 * Needs at least two marked sections, otherwise it does nothing. Before the
 * first one arrives the body keeps its own colour.
 *
 * Other scripts can steer a section's colour at runtime by setting
 * element._meltColor (pinned-steps.js does this for its per-step colours).
 *
 * With reduced motion each colour switches at once as its section's top
 * passes the middle of the screen.
 */
(function () {
  "use strict";

  const debug = window.WebflowFramework?.debug || function () {};

  const CSS = `html.bg-melt [data-bg-melt]{background-color:transparent!important}`;

  const BAND_START = 0.56;
  const BAND_LENGTH = 0.14;
  const REDUCED_SWITCH = 0.5;

  function injectStyles() {
    if (document.getElementById("bg-melt-styles")) return;
    const style = document.createElement("style");
    style.id = "bg-melt-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // "#rgb", "#rrggbb", "#rrggbbaa", "rgb()" or "rgba()" to [r, g, b, a]
  function parseColor(value) {
    if (!value) return null;
    const color = String(value).trim();
    let match = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (match) {
      let hex = match[1];
      if (hex.length === 3) hex = hex.replace(/./g, "$&$&");
      const n = (i) => parseInt(hex.slice(i, i + 2), 16);
      return [n(0), n(2), n(4), hex.length === 8 ? n(6) / 255 : 1];
    }
    match = color.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i);
    if (match) {
      let alpha = match[4] === undefined ? 1 : parseFloat(match[4]);
      if (match[4] && match[4].endsWith("%")) alpha /= 100;
      return [+match[1], +match[2], +match[3], alpha];
    }
    return null;
  }

  // A computed colour, unless it is fully transparent
  function solidColor(el) {
    const color = parseColor(getComputedStyle(el).backgroundColor);
    return color && color[3] > 0 ? color : null;
  }

  function mix(a, b, t) {
    return a.map((channel, i) => channel + (b[i] - channel) * t);
  }

  function toCss(color) {
    const [r, g, b, a] = color.map((channel, i) => (i < 3 ? Math.round(channel) : Math.round(channel * 1000) / 1000));
    return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  function clamp01(value) {
    return Math.min(Math.max(value, 0), 1);
  }

  function createMelt(sections, reducedMotion) {
    const root = document.documentElement;
    const body = document.body;
    const previousBody = body.style.backgroundColor;

    // Read each section's own colour before the class clears it
    const fallbacks = sections.map((el) => parseColor(el.getAttribute("data-bg-melt")) || solidColor(el));
    const base = solidColor(body) || [255, 255, 255, 1];

    root.classList.add("bg-melt");

    let last = "";
    let frame = 0;

    function colorOf(el, i) {
      return parseColor(el._meltColor) || fallbacks[i];
    }

    function update() {
      const vh = window.innerHeight;
      let color = base;
      sections.forEach((el, i) => {
        const target = colorOf(el, i);
        if (!target) return;
        const top = el.getBoundingClientRect().top;
        const p = reducedMotion
          ? top <= vh * REDUCED_SWITCH ? 1 : 0
          : clamp01((vh * BAND_START - top) / (vh * BAND_LENGTH));
        if (p > 0) color = mix(color, target, p);
      });
      const css = toCss(color);
      if (css !== last) {
        last = css;
        body.style.backgroundColor = css;
      }
    }

    // GSAP's ticker runs in step with Lenis; without GSAP, keep a frame loop
    const gsap = window.gsap;
    function loop() {
      update();
      frame = requestAnimationFrame(loop);
    }
    if (gsap && gsap.ticker) gsap.ticker.add(update);
    else frame = requestAnimationFrame(loop);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();

    return () => {
      if (gsap && gsap.ticker) gsap.ticker.remove(update);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      root.classList.remove("bg-melt");
      body.style.backgroundColor = previousBody;
    };
  }

  function init() {
    try {
      const sections = [...document.querySelectorAll("[data-bg-melt]")];
      if (sections.length < 2) {
        debug("bg-melt", "init", "Needs at least two [data-bg-melt] sections", "warn");
        return;
      }
      injectStyles();

      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      let teardown = createMelt(sections, query.matches);
      if (query.addEventListener) {
        query.addEventListener("change", () => {
          try {
            teardown();
            teardown = createMelt(sections, query.matches);
          } catch (error) {
            console.error("Background melt failed to restart:", error);
          }
        });
      }
      debug("bg-melt", "init", `Ready with ${sections.length} sections`, "info");
    } catch (error) {
      console.error("Background melt failed to load:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
