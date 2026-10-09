/**
 * Cursor pill
 *
 * A small label that rides beside the pointer while it is over an element
 * that asks for one, e.g. "Case study" over a work card. It wipes in from the
 * left on enter and wipes out on leave, and keeps up as the page scrolls or a
 * row pans under a still pointer.
 *
 * The pill lives in Webflow, styled there; this script only positions it,
 * shows it and swaps its text. Build it once per page, anywhere (e.g. the end
 * of the body).
 *
 * Load standalone on pages that need it (not part of the framework's main.js):
 *   <script src="https://cdn.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@X.Y.Z/js/cursor-pill.js" defer></script>
 *
 * Markup:
 *   [data-cursor-pill]                 The pill. Pinned to the viewport and
 *                                      ignores the pointer.
 *     [data-cursor-pill-text]          Its label. Defaults to the pill itself.
 *   [data-cursor-text="Case study"]    Anything that shows the pill with this
 *                                      label while the pointer is over it.
 *                                      Works on CMS items added later.
 *
 * Settings on [data-cursor-pill]:
 *   -offset="16"                       Gap in px between the pointer and the
 *                                      pill's left edge. The pill is centred
 *                                      on the pointer vertically.
 *
 * Needs GSAP. Only runs with a mouse (hover and a fine pointer). With reduced
 * motion the pill shows and hides without the wipe or the lag.
 */
(function () {
  "use strict";

  const debug = window.WebflowFramework?.debug || function () {};

  const MEDIA = "(hover: hover) and (pointer: fine)";
  const DEFAULT_OFFSET = 16;
  const FOLLOW = 0.25;
  const REVEAL = "clip-path 0.4s cubic-bezier(0.65, 0, 0.35, 1), opacity 0.2s ease";
  const HIDDEN = "inset(0 100% 0 0)";
  const SHOWN = "inset(0 0% 0 0)";

  function createPill(pill, media, reduced) {
    const label = pill.querySelector("[data-cursor-pill-text]") || pill;
    const offset = parseFloat(pill.getAttribute("data-cursor-pill-offset"));
    const gap = Number.isFinite(offset) ? offset : DEFAULT_OFFSET;
    const duration = reduced ? 0 : FOLLOW;

    Object.assign(pill.style, {
      position: "fixed",
      top: "0",
      left: "0",
      zIndex: "9999",
      pointerEvents: "none",
      opacity: "0",
      clipPath: HIDDEN,
      transition: reduced ? "none" : REVEAL,
    });
    pill.setAttribute("aria-hidden", "true");
    window.gsap.set(pill, { yPercent: -50 });

    const moveX = window.gsap.quickTo(pill, "x", { duration, ease: "power3.out" });
    const moveY = window.gsap.quickTo(pill, "y", { duration, ease: "power3.out" });
    let pointer = null;
    let current = null;

    function show(target) {
      if (target === current) return;
      current = target;
      if (!target) {
        pill.style.opacity = "0";
        pill.style.clipPath = HIDDEN;
        return;
      }
      label.textContent = target.getAttribute("data-cursor-text");
      pill.style.opacity = "1";
      pill.style.clipPath = SHOWN;
    }

    function targetAt(x, y) {
      const el = document.elementFromPoint(x, y);
      return el?.closest("[data-cursor-text]") || null;
    }

    window.addEventListener("pointermove", (event) => {
      if (!media.matches || event.pointerType !== "mouse") return;
      const first = !pointer;
      pointer = { x: event.clientX, y: event.clientY };
      if (first || !current) {
        // Jump rather than glide in from wherever it last was
        window.gsap.set(pill, { x: pointer.x + gap, y: pointer.y });
      }
      moveX(pointer.x + gap);
      moveY(pointer.y);
      show(targetAt(pointer.x, pointer.y));
    });

    // The page or a row can move under a still pointer
    window.addEventListener("scroll", () => {
      if (pointer) show(targetAt(pointer.x, pointer.y));
    }, { passive: true });

    document.documentElement.addEventListener("pointerleave", () => {
      pointer = null;
      show(null);
    });

    media.addEventListener("change", () => {
      if (!media.matches) show(null);
    });
  }

  function init() {
    try {
      const pill = document.querySelector("[data-cursor-pill]");
      if (!pill) return;
      if (!window.gsap) {
        debug("cursor-pill", "init", "GSAP missing, staying hidden", "warn");
        return;
      }
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      createPill(pill, window.matchMedia(MEDIA), reduced);
      debug("cursor-pill", "init", "Ready", "info");
    } catch (error) {
      console.error("Cursor pill failed to load:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
