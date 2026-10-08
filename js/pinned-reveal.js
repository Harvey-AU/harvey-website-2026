/**
 * Pinned reveal
 *
 * Holds a section still in the middle of the screen while its text lights up
 * word by word, from faint to full, as the page scrolls. Once every word is
 * lit the section lets go and scrolls on. Below the desktop breakpoint the
 * section does not pin, and the words light up as the text scrolls through
 * the screen instead.
 *
 * The words fade with opacity, so they keep whatever colour the text has
 * (e.g. one that follows bg-melt.js through [data-bg-melt-text]).
 *
 * Needs GSAP with ScrollTrigger and SplitText, e.g. from Webflow's GSAP
 * integration. Without them the text stays as it is.
 *
 * Load standalone on pages that need it (not part of the framework's main.js),
 * before pinned-steps.js when both are on a page:
 *   <script src="https://cdn.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@1.3.0/js/pinned-reveal.js" defer></script>
 *
 * Markup:
 *   [data-pinned-reveal]               Section, pinned on desktop.
 *     [data-pinned-reveal-text]        Text that lights up, in page order,
 *                                      one after another.
 *
 * Settings on [data-pinned-reveal]:
 *   -length="1.2"                      How long it stays pinned, in screen
 *                                      heights of scrolling.
 *   -from="0.18"                       Opacity the words start at.
 *   -min-width="992"                   Narrowest screen, in px, that pins.
 *
 * With reduced motion nothing pins and the text stays fully lit.
 */
(function () {
  "use strict";

  const debug = window.WebflowFramework?.debug || function () {};

  const DEFAULT_LENGTH = 1.2;
  const DEFAULT_FROM = 0.18;
  const DEFAULT_MIN_WIDTH = 992;
  // Share of the pin spent lighting words; the rest holds the lit text
  // before the section lets go
  const REVEAL_SHARE = 0.8;

  function numberAttr(el, name, fallback) {
    const value = parseFloat(el.getAttribute(name));
    return Number.isFinite(value) ? value : fallback;
  }

  // Each Lenis scroll must move ScrollTrigger, or the pin lags a frame
  function syncLenis() {
    const update = () => window.ScrollTrigger.update();
    const wire = (lenis) => {
      if (!lenis || lenis.__pinnedRevealSynced) return;
      lenis.__pinnedRevealSynced = true;
      lenis.on("scroll", update);
    };
    wire(window.WebflowFramework?.lenis);
    document.addEventListener("smoothScrollReady", (event) => wire(event.detail?.lenis));
  }

  function createReveal(section, mm) {
    const gsap = window.gsap;
    const texts = [...section.querySelectorAll("[data-pinned-reveal-text]")];
    if (!texts.length) {
      debug("pinned-reveal", "init", "No [data-pinned-reveal-text] inside", "warn");
      return;
    }

    const length = Math.max(0, numberAttr(section, "data-pinned-reveal-length", DEFAULT_LENGTH));
    const from = Math.min(Math.max(numberAttr(section, "data-pinned-reveal-from", DEFAULT_FROM), 0), 1);
    const minWidth = numberAttr(section, "data-pinned-reveal-min-width", DEFAULT_MIN_WIDTH);

    // Words across every text, in reading order, so one stagger runs through
    // them all
    const words = texts.flatMap((text) => new window.SplitText(text, { type: "words" }).words);
    const stagger = 1 / words.length;

    mm.add(`(min-width: ${minWidth}px)`, () => {
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "center center",
          end: () => "+=" + window.innerHeight * length,
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
          // Earlier on the page than other pins, so it measures first
          refreshPriority: 1,
        },
      });
      tl.fromTo(words, { opacity: from }, { opacity: 1, duration: stagger, stagger: stagger * REVEAL_SHARE }, 0);
      tl.to({}, { duration: 1 - REVEAL_SHARE }, ">");
    });

    mm.add(`(max-width: ${minWidth - 0.02}px)`, () => {
      gsap.fromTo(
        words,
        { opacity: from },
        {
          opacity: 1,
          ease: "none",
          stagger: 0.1,
          scrollTrigger: { trigger: texts[0], endTrigger: texts[texts.length - 1], start: "top 85%", end: "bottom 45%", scrub: true },
        }
      );
    });
  }

  function start() {
    const gsap = window.gsap;
    if (!gsap || !window.ScrollTrigger || !window.SplitText) {
      debug("pinned-reveal", "init", "GSAP, ScrollTrigger or SplitText missing, staying static", "warn");
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      debug("pinned-reveal", "init", "Skipped for reduced motion", "info");
      return;
    }
    gsap.registerPlugin(window.ScrollTrigger, window.SplitText);
    syncLenis();

    const mm = gsap.matchMedia();
    document.querySelectorAll("[data-pinned-reveal]").forEach((section) => {
      try {
        createReveal(section, mm);
      } catch (error) {
        console.error("Pinned reveal failed to start:", error);
      }
    });

    // Images and fonts change heights, and so where the pin starts and ends
    window.addEventListener("load", () => window.ScrollTrigger.refresh(), { once: true });
    debug("pinned-reveal", "init", "Ready", "info");
  }

  function init() {
    // Wait for web fonts so SplitText and the pin measure final glyphs
    const safeStart = () => {
      try {
        start();
      } catch (error) {
        console.error("Pinned reveal failed to load:", error);
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
