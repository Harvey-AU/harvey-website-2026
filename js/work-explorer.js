/**
 * Work explorer
 *
 * A row of work cards wider than its frame that pans sideways with the
 * pointer. It rests at its start, with the first card in line with the
 * content above, until the pointer moves over the frame. Left of centre
 * nudges the row a little; right of centre pans it to its end, which it
 * reaches before the pointer reaches the frame's right edge. At the end its
 * last item lines up with the right edge of the frame's parent, mirroring the
 * start, even if the frame bleeds past it. When the pointer leaves, the row
 * stays where it was.
 *
 * The layout lives in Webflow: let the track run past the frame (e.g. width
 * max-content, overflow visible) on desktop, and give it native horizontal
 * scroll below 992px, where this script leaves it alone.
 *
 * Load standalone on pages that need it (not part of the framework's main.js):
 *   <script src="https://cdn.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@X.Y.Z/js/work-explorer.js" defer></script>
 *
 * Markup:
 *   [data-work-explorer]               The frame, e.g. the CMS list wrapper.
 *                                      The pointer pans the row while over
 *                                      it, mapped across its width.
 *     [data-work-explorer-track]       The row that moves, e.g. the CMS list.
 *                                      Defaults to the frame's first child.
 *
 * Settings on [data-work-explorer]:
 *   -left="0.05"                       How far the row nudges right with the
 *                                      pointer at the left edge, as a share
 *                                      of its hidden width.
 *   -right="1.2"                       How far it pans left with the pointer
 *                                      at the right edge, as a share of its
 *                                      hidden width. Over 1 reaches the end
 *                                      early; it never pans past the end.
 *
 * Needs GSAP. With reduced motion, a touch screen or below 992px the row
 * stays put.
 */
(function () {
  "use strict";

  const debug = window.WebflowFramework?.debug || function () {};

  const MEDIA = "(min-width: 992px) and (hover: hover) and (pointer: fine)";
  const DEFAULT_LEFT = 0.05;
  const DEFAULT_RIGHT = 1.2;
  const DURATION = 0.8;
  const EASE = "power3.out";

  function readShare(root, name, fallback) {
    const value = parseFloat(root.getAttribute(`data-work-explorer-${name}`));
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  // How far the row moves left to bring its last item in line with the right
  // edge of the frame's parent. Measured against the track, so it holds while
  // the track is mid-pan.
  function hiddenWidth(root, track) {
    const last = track.lastElementChild;
    if (!last) return 0;
    const parent = root.parentElement;
    const edge = parent.getBoundingClientRect().right - parseFloat(getComputedStyle(parent).paddingRight);
    const rowEnd = last.getBoundingClientRect().right - track.getBoundingClientRect().left;
    return Math.max(0, rowEnd - (edge - root.getBoundingClientRect().left));
  }

  function createExplorer(root, media) {
    const track = root.querySelector("[data-work-explorer-track]") || root.firstElementChild;
    if (!track) {
      debug("work-explorer", "init", "No track inside [data-work-explorer]", "warn");
      return;
    }
    const left = readShare(root, "left", DEFAULT_LEFT);
    const right = readShare(root, "right", DEFAULT_RIGHT);
    const moveTo = window.gsap.quickTo(track, "x", { duration: DURATION, ease: EASE });

    root.addEventListener("pointermove", (event) => {
      if (!media.matches || event.pointerType !== "mouse") return;
      const rect = root.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right) return;
      if (event.clientY < rect.top || event.clientY > rect.bottom) return;
      const hidden = hiddenWidth(root, track);
      const offset = Math.max(-1, Math.min(1, (event.clientX - rect.left) / (rect.width / 2) - 1));
      const x = offset > 0 ? Math.max(-hidden, -offset * hidden * right) : -offset * hidden * left;
      moveTo(x);
    });

    media.addEventListener("change", () => {
      if (media.matches) return;
      window.gsap.killTweensOf(track);
      window.gsap.set(track, { clearProps: "x" });
    });
  }

  function init() {
    try {
      const roots = document.querySelectorAll("[data-work-explorer]");
      if (!roots.length) return;
      if (!window.gsap) {
        debug("work-explorer", "init", "GSAP missing, staying put", "warn");
        return;
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        debug("work-explorer", "init", "Reduced motion, staying put", "info");
        return;
      }
      const media = window.matchMedia(MEDIA);
      roots.forEach((root) => {
        try {
          createExplorer(root, media);
        } catch (error) {
          console.error("Work explorer failed to start:", error);
        }
      });
      debug("work-explorer", "init", `Ready with ${roots.length} rows`, "info");
    } catch (error) {
      console.error("Work explorer failed to load:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
