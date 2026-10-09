/**
 * Impact goals
 *
 * A list of goals, e.g. the 17 UN Sustainable Development Goals, whose icons
 * light up in order the first time the list scrolls into view. Until then
 * each icon sits small and grey and its label faded. It plays once: scrolling
 * back up does not reverse or replay it.
 *
 * The layout lives in Webflow: style everything lit, as it should look at
 * the end. Without JavaScript, or with reduced motion, it simply shows lit.
 *
 * Load standalone on pages that need it (not part of the framework's main.js):
 *   <script src="https://cdn.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@1.6.0/js/impact-goals.js" defer></script>
 *
 * Markup (attribute prefix data-impact-goals):
 *   [data-impact-goals]                The list, or any wrapper around it.
 *                                      Lights up once 30% of it is in view.
 *     [-item]                          One goal, in the order they light.
 *       [-icon]                        Its icon, e.g. a coloured smile.
 *                                      Shrinks and greys out until lit.
 *       [-label]                       Its label. Fades until lit.
 *
 * Settings on [data-impact-goals]:
 *   -stagger="0.07"                    Seconds between goals (default 0.07).
 */
(function () {
  "use strict";

  const debug = window.WebflowFramework?.debug || function () {};

  const EASE = "cubic-bezier(.2,.7,.1,1)";
  const CSS = `
[data-impact-goals] [data-impact-goals-icon]{transition:filter .4s,opacity .4s,transform .7s ${EASE}}
[data-impact-goals] [data-impact-goals-label]{transition:opacity .4s}
.is-impact-goals-armed [data-impact-goals-item]:not(.is-impact-goals-lit) [data-impact-goals-icon]{filter:grayscale(1);opacity:.3;transform:scale(.7)}
.is-impact-goals-armed [data-impact-goals-item]:not(.is-impact-goals-lit) [data-impact-goals-label]{opacity:.45}`;

  const THRESHOLD = 0.3;
  const DEFAULT_STAGGER = 0.07;

  function injectStyles() {
    if (document.getElementById("impact-goals-styles")) return;
    const style = document.createElement("style");
    style.id = "impact-goals-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function createGoals(root) {
    const items = [...root.querySelectorAll("[data-impact-goals-item]")];
    if (!items.length) {
      debug("impact-goals", "init", "No [data-impact-goals-item] inside", "warn");
      return;
    }
    const stagger = parseFloat(root.getAttribute("data-impact-goals-stagger"));
    const step = Number.isFinite(stagger) && stagger >= 0 ? stagger : DEFAULT_STAGGER;

    root.classList.add("is-impact-goals-armed");

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        items.forEach((item, i) => {
          const delay = `${(i * step).toFixed(3)}s`;
          item.querySelectorAll("[data-impact-goals-icon],[data-impact-goals-label]").forEach((el) => {
            el.style.transitionDelay = delay;
          });
          item.classList.add("is-impact-goals-lit");
        });
      },
      { threshold: THRESHOLD },
    );
    observer.observe(root);
  }

  function init() {
    try {
      const roots = document.querySelectorAll("[data-impact-goals]");
      if (!roots.length) return;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reducedMotion || !("IntersectionObserver" in window)) {
        debug("impact-goals", "init", "Reduced motion or no IntersectionObserver, staying lit", "info");
        return;
      }
      injectStyles();
      roots.forEach((root) => {
        try {
          createGoals(root);
        } catch (error) {
          console.error("Impact goals failed to start:", error);
        }
      });
      debug("impact-goals", "init", `Ready with ${roots.length} lists`, "info");
    } catch (error) {
      console.error("Impact goals failed to load:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
