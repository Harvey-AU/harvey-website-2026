/**
 * Marquee
 *
 * Runs a row of content (e.g. client logos) sideways in a seamless endless
 * loop at a constant speed in pixels per second, so it reads the same at any
 * screen width or row length.
 *
 * Load standalone on pages that need it (not part of the framework's main.js):
 *   <script src="https://cdn.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@1.0.0/js/marquee.js" defer></script>
 *
 * Markup:
 *   [data-marquee]                     The visible strip. Clipped.
 *     Track                            Its first child, a flex row.
 *       Panel                          Identical copies of the content,
 *       Panel                          e.g. the same CMS list repeated.
 *       ...                            One is enough: the script clones it
 *                                      until the strip is always covered.
 *
 * Give each panel its own trailing space (e.g. margin-right on the list
 * equal to the gap between items) so the seam matches the other gaps.
 *
 * Settings on [data-marquee]:
 *   -speed="35"                        Pixels per second.
 *   -direction="left"                  "left" or "right".
 *   -pause="hover"                     Pause while the pointer is over it.
 *   -items="odd"                       Show only the odd ("odd") or even
 *                                      ("even") items of each panel, so two
 *                                      rows can split one list. Items are
 *                                      [data-marquee-item] or CMS items.
 *   -boost                             Speed up while the page scrolls, by
 *                                      up to 800 pixels per second on top of
 *                                      -speed, so a fast flick races the row
 *                                      along. Needs smooth-scroll.js. Off
 *                                      below 992px. A number scales it
 *                                      (e.g. -boost="0.5" for half as much),
 *                                      and -boost="false" turns it off, so a
 *                                      component prop can drive it.
 *
 * With reduced motion the row stays still and never boosts.
 */
(function () {
  "use strict";

  const debug = window.WebflowFramework?.debug || function () {};

  const DEFAULT_SPEED = 35;
  // Extra pixels per second for each pixel per frame the page scrolls, and
  // the most it adds
  const BOOST_PER_VELOCITY = 54;
  const BOOST_MAX = 800;
  const BOOST_EASE = 0.08;
  const BOOST_MEDIA = "(min-width: 992px)";

  const CSS = `
[data-marquee]{overflow:hidden}
[data-marquee]>:first-child{flex:none}
[data-marquee].is-marquee-running>:first-child{animation:marquee-run var(--marquee-duration,60s) linear infinite;will-change:transform}
[data-marquee][data-marquee-direction="right"].is-marquee-running>:first-child{animation-direction:reverse}
[data-marquee][data-marquee-pause="hover"].is-marquee-running:hover>:first-child{animation-play-state:paused}
@keyframes marquee-run{from{transform:translate3d(0,0,0)}to{transform:translate3d(calc(-1 * var(--marquee-distance,0px)),0,0)}}`;

  function injectStyles() {
    if (document.getElementById("marquee-styles")) return;
    const style = document.createElement("style");
    style.id = "marquee-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function createMarquee(strip) {
    const track = strip.firstElementChild;
    if (!track || !track.firstElementChild) return;

    const source = track.firstElementChild;
    const speedValue = parseFloat(strip.getAttribute("data-marquee-speed"));
    const speed = Number.isFinite(speedValue) && speedValue > 0 ? speedValue : DEFAULT_SPEED;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let distance = 0;
    let frame = 0;

    splitItems(strip, track);

    // One loop is the space from the start of one copy to the start of the
    // next, including any gap between them. Moving the track by exactly that
    // lands it where it began, so the restart is invisible.
    function loopDistance() {
      const panels = track.children;
      if (panels.length > 1) {
        return panels[1].getBoundingClientRect().left - panels[0].getBoundingClientRect().left;
      }
      return source.getBoundingClientRect().width;
    }

    // The strip must stay covered while the track slides one loop along, so
    // keep at least strip width + one loop of copies.
    function fill(loop) {
      const needed = Math.ceil(strip.clientWidth / loop) + 1;
      while (track.children.length < needed) {
        const clone = source.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        clone.querySelectorAll("a, button, input, select, textarea, [tabindex]").forEach((el) => {
          el.setAttribute("tabindex", "-1");
        });
        track.appendChild(clone);
      }
    }

    function measure() {
      frame = 0;
      if (reducedMotion.matches) {
        strip.classList.remove("is-marquee-running");
        return;
      }
      let loop = loopDistance();
      if (loop <= 0) return;
      fill(loop);
      loop = loopDistance();
      if (Math.abs(loop - distance) < 0.5 && strip.classList.contains("is-marquee-running")) return;
      distance = loop;
      strip.style.setProperty("--marquee-distance", `${distance}px`);
      strip.style.setProperty("--marquee-duration", `${distance / speed}s`);
      strip.classList.add("is-marquee-running");
    }

    function scheduleMeasure() {
      if (!frame) frame = requestAnimationFrame(measure);
    }

    // Lazy images and web fonts change the copies' width as they load
    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(scheduleMeasure);
      observer.observe(strip);
      observer.observe(source);
    } else {
      window.addEventListener("resize", scheduleMeasure);
    }
    window.addEventListener("load", scheduleMeasure, { once: true });
    if (reducedMotion.addEventListener) reducedMotion.addEventListener("change", scheduleMeasure);

    measure();
    setupBoost(strip, track, speed, reducedMotion);
    debug("marquee", "init", `Ready at ${speed}px/s`, "info");
  }

  // Hide the other half of every panel's items before measuring, so the
  // clones made later inherit the split.
  function splitItems(strip, track) {
    const parity = strip.getAttribute("data-marquee-items");
    if (parity !== "odd" && parity !== "even") return;
    const keep = parity === "odd" ? 0 : 1;
    Array.from(track.children).forEach((panel) => {
      let items = panel.querySelectorAll("[data-marquee-item]");
      if (!items.length) items = panel.querySelectorAll(".w-dyn-item");
      items.forEach((item, index) => {
        if (index % 2 !== keep) item.style.display = "none";
      });
    });
  }

  function getLenis(callback) {
    const lenis = window.WebflowFramework?.lenis;
    if (lenis) {
      callback(lenis);
      return;
    }
    document.addEventListener("smoothScrollReady", (event) => callback(event.detail.lenis), { once: true });
  }

  // Scroll velocity speeds up the CSS animation's playback rate, eased so
  // it swells and settles rather than jumps
  function setupBoost(strip, track, speed, reducedMotion) {
    const value = strip.getAttribute("data-marquee-boost");
    if (value === null || value === "false") return;
    const scaleValue = parseFloat(value);
    const scale = Number.isFinite(scaleValue) && scaleValue > 0 ? scaleValue : 1;

    const wide = window.matchMedia(BOOST_MEDIA);
    let lenis = null;
    let boost = 0;
    let frame = 0;

    function setRate(rate) {
      const animation = track.getAnimations ? track.getAnimations()[0] : null;
      if (animation) animation.playbackRate = rate;
    }

    function tick() {
      frame = 0;
      const active = wide.matches && !reducedMotion.matches;
      const target = active ? Math.min(Math.abs(lenis.velocity || 0) * BOOST_PER_VELOCITY, BOOST_MAX) * scale : 0;
      boost += (target - boost) * BOOST_EASE;
      if (!active || (target === 0 && boost < 0.5)) {
        boost = 0;
        setRate(1);
        return;
      }
      setRate(1 + boost / speed);
      frame = requestAnimationFrame(tick);
    }

    getLenis((instance) => {
      if (!instance || typeof instance.on !== "function") return;
      lenis = instance;
      lenis.on("scroll", () => {
        if (!frame && wide.matches && !reducedMotion.matches) frame = requestAnimationFrame(tick);
      });
      debug("marquee", "boost", "Scroll boost on", "info");
    });
  }

  function init() {
    try {
      injectStyles();
      document.querySelectorAll("[data-marquee]").forEach((strip) => {
        try {
          createMarquee(strip);
        } catch (error) {
          console.error("Marquee failed to start:", error);
        }
      });
    } catch (error) {
      console.error("Marquee failed to load:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
