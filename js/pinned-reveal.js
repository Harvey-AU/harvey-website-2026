/**
 * Pinned reveal
 *
 * Lights a section's text up word by word, from faint to full, as the page
 * scrolls. The words start lighting as the section scrolls into view, then
 * the section holds still in the middle of the screen while the rest light
 * up, and once every word is lit it lets go and scrolls on. Below the
 * desktop breakpoint the section does not pin, and the words light up as
 * the text scrolls through the screen instead.
 *
 * Content above it (e.g. client logos) can fade out as the section arrives,
 * fully gone just as the section pins.
 *
 * The words fade with opacity, so they keep whatever colour the text has
 * (e.g. one that follows bg-melt.js through [data-bg-melt-text]).
 *
 * Needs GSAP with ScrollTrigger, e.g. from Webflow's GSAP integration.
 * Without them the text stays as it is. Words are split by the script
 * itself, so SplitText is not needed.
 *
 * Load standalone on pages that need it (not part of the framework's main.js),
 * before pinned-steps.js when both are on a page:
 *   <script src="https://cdn.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@1.3.0/js/pinned-reveal.js" defer></script>
 *
 * Markup:
 *   [data-pinned-reveal]               Section, pinned on desktop.
 *     [data-pinned-reveal-text]        Text that lights up, in page order,
 *                                      one after another.
 *   [data-pinned-reveal-fade]          Anywhere on the page: fades out as the
 *                                      section arrives. With several reveal
 *                                      sections it follows the first.
 *
 * Settings on [data-pinned-reveal]:
 *   -length="1.2"                      How long it stays pinned, in screen
 *                                      heights of scrolling.
 *   -from="0.18"                       Opacity the words start at.
 *   -start="80"                        Where on the screen, in % from the
 *                                      top, the section's top is when the
 *                                      words start lighting.
 *   -min-width="992"                   Narrowest screen, in px, that pins.
 *
 * With reduced motion nothing pins or fades and the text stays fully lit.
 */
(function () {
  "use strict";

  const debug = window.WebflowFramework?.debug || function () {};

  const DEFAULT_LENGTH = 1.2;
  const DEFAULT_FROM = 0.18;
  const DEFAULT_MIN_WIDTH = 992;
  const DEFAULT_START = 80;
  // Below the breakpoint, where on the screen (% from the top) the section's
  // top is when the faded content is fully gone
  const MOBILE_FADE_END = 35;
  // Share of the pin spent lighting words; the rest holds the lit text
  // before the section lets go
  const REVEAL_SHARE = 0.8;

  function numberAttr(el, name, fallback) {
    const value = parseFloat(el.getAttribute(name));
    return Number.isFinite(value) ? value : fallback;
  }

  // Wraps each word of el's text in a plain span, keeping any
  // inline markup (links, icons) and the spaces between words as they are
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

  function createReveal(section, mm, fades) {
    const gsap = window.gsap;
    const texts = [...section.querySelectorAll("[data-pinned-reveal-text]")];
    if (!texts.length) {
      debug("pinned-reveal", "init", "No [data-pinned-reveal-text] inside", "warn");
      return;
    }

    const length = Math.max(0, numberAttr(section, "data-pinned-reveal-length", DEFAULT_LENGTH));
    const from = Math.min(Math.max(numberAttr(section, "data-pinned-reveal-from", DEFAULT_FROM), 0), 1);
    const minWidth = numberAttr(section, "data-pinned-reveal-min-width", DEFAULT_MIN_WIDTH);
    const startAt = numberAttr(section, "data-pinned-reveal-start", DEFAULT_START);

    // Words across every text, in reading order, so one stagger runs through
    // them all
    const words = texts.flatMap(splitWords);
    const stagger = 1 / words.length;

    mm.add(`(min-width: ${minWidth}px)`, () => {
      const pin = window.ScrollTrigger.create({
        trigger: section,
        start: "center center",
        end: () => "+=" + window.innerHeight * length,
        pin: true,
        invalidateOnRefresh: true,
        // Earlier on the page than other pins, so it measures first
        refreshPriority: 1,
      });
      // Lights from the section scrolling in to the end of the pin, so the
      // first words are already lit by the time it holds
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: `top ${startAt}%`,
          end: () => pin.end,
          scrub: 0.6,
          invalidateOnRefresh: true,
          refreshPriority: 1,
        },
      });
      tl.fromTo(words, { opacity: from }, { opacity: 1, duration: stagger, stagger: stagger * REVEAL_SHARE }, 0);
      tl.to({}, { duration: 1 - REVEAL_SHARE }, ">");

      if (fades.length) {
        gsap.fromTo(
          fades,
          { opacity: 1 },
          {
            opacity: 0,
            ease: "none",
            scrollTrigger: { trigger: section, start: "top bottom", end: () => pin.start, scrub: true, invalidateOnRefresh: true, refreshPriority: 1 },
          }
        );
      }
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
      if (fades.length) {
        gsap.fromTo(
          fades,
          { opacity: 1 },
          { opacity: 0, ease: "none", scrollTrigger: { trigger: section, start: "top bottom", end: `top ${MOBILE_FADE_END}%`, scrub: true } }
        );
      }
    });
  }

  function start() {
    const gsap = window.gsap;
    if (!gsap || !window.ScrollTrigger) {
      debug("pinned-reveal", "init", "GSAP or ScrollTrigger missing, staying static", "warn");
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      debug("pinned-reveal", "init", "Skipped for reduced motion", "info");
      return;
    }
    gsap.registerPlugin(window.ScrollTrigger);
    syncLenis();

    const mm = gsap.matchMedia();
    const fades = [...document.querySelectorAll("[data-pinned-reveal-fade]")];
    document.querySelectorAll("[data-pinned-reveal]").forEach((section, i) => {
      try {
        createReveal(section, mm, i === 0 ? fades : []);
      } catch (error) {
        console.error("Pinned reveal failed to start:", error);
      }
    });

    // Images and fonts change heights, and so where the pin starts and ends
    window.addEventListener("load", () => window.ScrollTrigger.refresh(), { once: true });
    debug("pinned-reveal", "init", "Ready", "info");
  }

  function init() {
    // Wait for web fonts so the pin measures final glyphs
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
