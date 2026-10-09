/**
 * Nav reveal
 *
 * A fixed header that slides out of view while scrolling down and back in
 * when scrolling up. It always shows near the top of the page and while
 * anything inside it has keyboard focus.
 *
 * Load standalone on pages that need it (not part of the framework's main.js):
 *   <script src="https://cdn.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@1.7.0/js/nav-reveal.js" defer></script>
 *
 * Markup:
 *   [data-nav-reveal]           The header. Style it position: fixed, top 0.
 *
 * Settings on [data-nav-reveal]:
 *   -offset="0"                 Extra px scrolled past the header's height
 *                               before it can hide.
 *   -tolerance="8"              Px scrolled in one direction before it
 *                               hides or shows, so small jitters don't
 *                               toggle it.
 *
 * Adds .is-nav-hidden while hidden. With reduced motion it hides and shows
 * without sliding.
 */
(function () {
  "use strict";

  const debug = window.WebflowFramework?.debug || function () {};

  const EASE_OUT = "cubic-bezier(.215,.61,.355,1)"; // power3.out
  const CSS = `
[data-nav-reveal]{transition:transform .5s ${EASE_OUT};will-change:transform}
[data-nav-reveal].is-nav-hidden{transform:translate3d(0,-100%,0);transition-duration:.35s}
@media (prefers-reduced-motion:reduce){[data-nav-reveal]{transition:none}}
`;

  function numberAttr(el, name, fallback) {
    const value = parseFloat(el.getAttribute(name));
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  function setup(nav) {
    const offset = numberAttr(nav, "data-nav-reveal-offset", 0);
    const tolerance = numberAttr(nav, "data-nav-reveal-tolerance", 8);

    let lastY = window.scrollY;
    let hidden = false;
    let ticking = false;

    function setHidden(value) {
      if (value === hidden) return;
      hidden = value;
      nav.classList.toggle("is-nav-hidden", value);
    }

    function update() {
      ticking = false;
      const y = Math.max(window.scrollY, 0);
      const delta = y - lastY;

      if (y <= nav.offsetHeight + offset) {
        setHidden(false);
        lastY = y;
        return;
      }
      if (Math.abs(delta) < tolerance) return;
      setHidden(delta > 0 && !nav.contains(document.activeElement));
      lastY = y;
    }

    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
      },
      { passive: true },
    );
    nav.addEventListener("focusin", () => setHidden(false));
  }

  function init() {
    const navs = document.querySelectorAll("[data-nav-reveal]");
    if (!navs.length) return;

    const style = document.createElement("style");
    style.setAttribute("data-nav-reveal-style", "");
    style.textContent = CSS;
    document.head.appendChild(style);

    navs.forEach((nav) => {
      try {
        setup(nav);
      } catch (error) {
        console.warn("[nav-reveal]", error);
      }
    });
    debug("nav-reveal", "init", `${navs.length} header(s)`, "info");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
