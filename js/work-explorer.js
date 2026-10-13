/**
 * Work explorer
 *
 * A row of work cards wider than its frame. It rests at its start, with the
 * first card in line with the content above. Two ways to move it, with a
 * mouse:
 *   - Edge zones: with the pointer level with the frame and within the left
 *     or right edge of the screen, the row scrolls that way at a constant speed,
 *     easing in and out as the pointer enters and leaves the zone. The zone
 *     is clamp(80px, 7vw, 120px) wide. Leaving it stops the row where it is.
 *   - Drag: press and drag the row either way. It glides briefly on release.
 *     A drag never follows a card link; a plain click still does.
 * The row stops at its start and at its end, where its last item lines up
 * with the right edge of the frame's parent, mirroring the start, even if the
 * frame bleeds past it.
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
 *     [data-work-explorer-track]       The row that moves, e.g. the CMS list.
 *                                      Defaults to the frame's first child.
 *
 * Settings on [data-work-explorer]:
 *   -speed="800"                       Edge-zone scroll speed in pixels per
 *                                      second.
 *
 * Needs GSAP. On a touch screen or below 992px the row keeps its native
 * behaviour. With reduced motion the edge zones and the release glide are off;
 * dragging still works.
 */
(function () {
  "use strict";

  const debug = window.WebflowFramework?.debug || function () {};

  const MEDIA = "(min-width: 992px) and (hover: hover) and (pointer: fine)";
  const DEFAULT_SPEED = 800;
  // seconds for the edge-zone speed to ease in or out (time constant)
  const EDGE_LAG = 0.15;
  // seconds for a released row to glide to a stop (time constant)
  const GLIDE_LAG = 0.2;
  const DRAG_THRESHOLD = 4;
  const ZONE_MIN = 80;
  const ZONE_VW = 0.07;
  const ZONE_MAX = 120;

  const CSS = `
[data-work-explorer].is-explorer-draggable,[data-work-explorer].is-explorer-draggable a{cursor:grab;user-select:none;-webkit-user-select:none}
[data-work-explorer].is-explorer-dragging,[data-work-explorer].is-explorer-dragging a{cursor:grabbing}
[data-work-explorer].is-explorer-draggable img{-webkit-user-drag:none}`;

  function injectStyles() {
    if (document.getElementById("work-explorer-styles")) return;
    const style = document.createElement("style");
    style.id = "work-explorer-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function readSpeed(root) {
    const value = parseFloat(root.getAttribute("data-work-explorer-speed"));
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_SPEED;
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

  function createExplorer(root, media, reducedMotion) {
    const track = root.querySelector("[data-work-explorer-track]") || root.firstElementChild;
    if (!track) {
      debug("work-explorer", "init", "No track inside [data-work-explorer]", "warn");
      return;
    }
    const speed = readSpeed(root);
    let x = 0;
    let pointer = null;
    let rate = 0;
    let velocity = 0;
    let frame = 0;
    let last = 0;
    let press = null;
    let suppressClick = false;

    function place(next) {
      const hidden = hiddenWidth(root, track);
      const clamped = Math.max(-hidden, Math.min(0, next));
      if (clamped !== next) velocity = 0;
      if (clamped !== x) window.gsap.set(track, { x: clamped });
      x = clamped;
    }

    function alongFrame() {
      if (!pointer) return false;
      const rect = root.getBoundingClientRect();
      return pointer.y >= rect.top && pointer.y <= rect.bottom;
    }

    // -1 scrolls the row towards its start, 1 towards its end
    function edgeDirection() {
      if (!alongFrame() || press || reducedMotion.matches) return 0;
      const width = document.documentElement.clientWidth;
      const zone = Math.max(ZONE_MIN, Math.min(ZONE_MAX, width * ZONE_VW));
      if (pointer.x <= zone) return -1;
      if (pointer.x >= width - zone) return 1;
      return 0;
    }

    function tick(now) {
      frame = 0;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      const goal = edgeDirection() * speed;
      rate += (goal - rate) * (1 - Math.exp(-dt / EDGE_LAG));
      if (!goal && Math.abs(rate) < 1) rate = 0;
      if (!press) {
        velocity *= Math.exp(-dt / GLIDE_LAG);
        if (Math.abs(velocity) < 5) velocity = 0;
      }
      if (rate || (!press && velocity)) place(x + ((press ? 0 : velocity) - rate) * dt);
      if (edgeDirection() || rate || velocity) frame = requestAnimationFrame(tick);
      else last = 0;
    }

    function kick() {
      if (!frame && media.matches) frame = requestAnimationFrame(tick);
    }

    function active(event) {
      return media.matches && event.pointerType === "mouse";
    }

    document.documentElement.addEventListener("mouseleave", () => {
      pointer = null;
    });
    window.addEventListener("resize", () => {
      if (media.matches) place(x);
    });
    window.addEventListener("scroll", kick, { passive: true });

    root.addEventListener("pointerdown", (event) => {
      suppressClick = false;
      if (!active(event) || event.button !== 0) return;
      velocity = 0;
      rate = 0;
      press = { id: event.pointerId, x: event.clientX, lastX: event.clientX, lastTime: event.timeStamp, dragging: false };
    });

    document.addEventListener("pointermove", (event) => {
      if (!active(event)) return;
      pointer = { x: event.clientX, y: event.clientY };
      if (press && event.pointerId === press.id) {
        if (!press.dragging) {
          if (Math.abs(event.clientX - press.x) < DRAG_THRESHOLD) return;
          press.dragging = true;
          root.classList.add("is-explorer-dragging");
          try {
            root.setPointerCapture(event.pointerId);
          } catch (error) {
            // The pointer is already gone
          }
        }
        const dx = event.clientX - press.lastX;
        const dt = (event.timeStamp - press.lastTime) / 1000;
        place(x + dx);
        if (dt > 0) velocity = velocity * 0.6 + (dx / dt) * 0.4;
        press.lastX = event.clientX;
        press.lastTime = event.timeStamp;
      }
      kick();
    });

    function release(event) {
      if (!press || event.pointerId !== press.id) return;
      const dragged = press.dragging;
      // A pause before letting go means no fling
      const still = event.timeStamp - press.lastTime > 80;
      press = null;
      if (!dragged) return;
      suppressClick = true;
      root.classList.remove("is-explorer-dragging");
      if (still || event.type === "pointercancel" || reducedMotion.matches) velocity = 0;
      kick();
    }
    root.addEventListener("pointerup", release);
    root.addEventListener("pointercancel", release);

    // A drag that ends over a link must not follow it
    root.addEventListener(
      "click",
      (event) => {
        if (!suppressClick) return;
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
      },
      true
    );

    root.addEventListener("dragstart", (event) => {
      if (media.matches) event.preventDefault();
    });

    function sync() {
      if (media.matches) {
        root.classList.add("is-explorer-draggable");
        place(x);
        return;
      }
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      rate = 0;
      velocity = 0;
      press = null;
      pointer = null;
      x = 0;
      root.classList.remove("is-explorer-draggable", "is-explorer-dragging");
      window.gsap.killTweensOf(track);
      window.gsap.set(track, { clearProps: "x" });
    }

    media.addEventListener("change", sync);
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(() => {
        if (media.matches) place(x);
      });
      observer.observe(root);
      observer.observe(track);
    }
    sync();
  }

  function init() {
    try {
      const roots = document.querySelectorAll("[data-work-explorer]");
      if (!roots.length) return;
      if (!window.gsap) {
        debug("work-explorer", "init", "GSAP missing, staying put", "warn");
        return;
      }
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      injectStyles();
      const media = window.matchMedia(MEDIA);
      roots.forEach((root) => {
        try {
          createExplorer(root, media, reducedMotion);
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
