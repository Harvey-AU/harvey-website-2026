/**
 * Smooth scroll
 *
 * Eases the whole page's wheel and trackpad scrolling with Lenis, so every
 * scroll-driven effect (like the work wall) glides consistently. Touch keeps
 * native scrolling, and reduced motion turns it off.
 *
 * Load standalone, site-wide or per page (not part of the framework's main.js):
 *   <script src="https://cdn.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@1.7.0/js/smooth-scroll.js" defer></script>
 *
 * Settings on the script tag:
 *   data-lerp="0.08"    Share of the remaining distance covered per frame.
 *                       Lower is smoother and floatier (Lenis default 0.1).
 *
 * Elements with data-lenis-prevent keep native scrolling (e.g. modals,
 * scrollable panels). The instance is exposed as
 * window.WebflowFramework.lenis.
 */
(function () {
  "use strict";

  const debug = window.WebflowFramework?.debug || function () {};

  const LENIS_SRC = "https://cdn.jsdelivr.net/npm/lenis@1.3.26/dist/lenis.min.js";
  const LENIS_INTEGRITY = "sha384-jqpi9VmOdhyLoLURgjCn7EpnG9BbnHW57ibIZoeaIU+erWDH3k8fQQg0xH2ySjnw";
  const DEFAULT_LERP = 0.08;

  // From lenis/dist/lenis.css, plus overriding any smooth scroll-behavior
  // Webflow sets, which would fight Lenis
  const CSS = `
html.lenis,html.lenis body{height:auto}
html.lenis.lenis-smooth{scroll-behavior:auto!important}
.lenis:not(.lenis-autoToggle).lenis-stopped{overflow:clip}
.lenis [data-lenis-prevent],.lenis [data-lenis-prevent-wheel],.lenis [data-lenis-prevent-touch],.lenis [data-lenis-prevent-vertical],.lenis [data-lenis-prevent-horizontal]{overscroll-behavior:contain}
.lenis.lenis-smooth iframe{pointer-events:none}
`;

  const script = document.currentScript;

  function loadLenis() {
    if (window.Lenis) return Promise.resolve(window.Lenis);
    return new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = LENIS_SRC;
      el.integrity = LENIS_INTEGRITY;
      el.crossOrigin = "anonymous";
      el.onload = () => (window.Lenis ? resolve(window.Lenis) : reject(new Error("Lenis did not load")));
      el.onerror = () => reject(new Error(`Failed to load ${LENIS_SRC}`));
      document.head.appendChild(el);
    });
  }

  function start(Lenis) {
    const style = document.createElement("style");
    style.setAttribute("data-smooth-scroll", "");
    style.textContent = CSS;
    document.head.appendChild(style);

    const lerpAttr = parseFloat(script?.getAttribute("data-lerp"));
    const lenis = new Lenis({
      lerp: lerpAttr > 0 && lerpAttr <= 1 ? lerpAttr : DEFAULT_LERP,
      anchors: true,
      autoRaf: !window.gsap,
    });

    // Share GSAP's clock when present so scroll and animations tick together
    if (window.gsap) {
      window.gsap.ticker.add((time) => lenis.raf(time * 1000));
      window.gsap.ticker.lagSmoothing(0);
    }

    window.WebflowFramework = window.WebflowFramework || {};
    window.WebflowFramework.lenis = lenis;
    document.dispatchEvent(new CustomEvent("smoothScrollReady", { detail: { lenis } }));
    debug("smooth-scroll", "init", "Lenis smooth scroll ready", "info");
  }

  function init() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      debug("smooth-scroll", "init", "Skipped for reduced motion", "info");
      return;
    }
    if (window.WebflowFramework?.lenis) return;
    loadLenis()
      .then(start)
      .catch((error) => {
        // Native scrolling still works, so this only costs the smoothing
        console.warn("[smooth-scroll]", error);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
