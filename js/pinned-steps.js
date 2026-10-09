/**
 * Pinned steps
 *
 * A numbered list of steps beside an image frame. On desktop the section
 * pins in the middle of the screen and scrolling steps through it: the
 * current step's text fades up and out, the next image wipes up over the
 * last one with a slight zoom-out, and the next step's text fades up in.
 * Scrolling settles on a whole step so a resting page never sits between
 * two. Below the desktop breakpoint the steps stack as normal and each
 * step's own image unclips as it scrolls into view.
 *
 * Optionally a lead-in heading fills word by word from grey to its own
 * colour as it scrolls through the screen.
 *
 * The layout lives in Webflow: style the steps as a normal list, each with
 * its text, and the image frames stacked in one frame beside them (absolute
 * inset 0, overflow hidden, image covering). On desktop the script stacks
 * the steps into one grid cell and turns off sticky positioning inside the
 * section while it is pinned. It puts everything back when the screen
 * drops below the breakpoint.
 *
 * Needs GSAP with ScrollTrigger (and SplitText for the lead-in), e.g. from
 * Webflow's GSAP integration. Without them the section stays static.
 *
 * Load standalone on pages that need it (not part of the framework's main.js):
 *   <script src="https://cdn.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@X.Y.Z/js/pinned-steps.js" defer></script>
 *
 * Markup (attribute prefix data-pinned-steps):
 *   [data-pinned-steps]                Section component, pinned on desktop.
 *                                      Optional settings below.
 *     [-list]                          Wraps the steps.
 *       [-step]                        One step, in order. Its children fade
 *                                      out and in, or only its [-text]
 *                                      descendants if it has any.
 *     [-media]                         One image frame per step, in the same
 *                                      order. Each wipes up over the last;
 *                                      its img zooms out as it does.
 *   [-reveal]                          Below the breakpoint: a frame (with
 *                                      overflow hidden) around a step's
 *                                      image, unclipped on scroll. Its img
 *                                      zooms out as it does. On a bare img
 *                                      only the clip runs.
 *   [-heading]                         Anywhere on the page: a heading whose
 *                                      words fill from grey on scroll.
 *
 * Settings on [data-pinned-steps]:
 *   -min-width="992"                   Narrowest screen, in px, that pins.
 *   -theme-target=".section_approach"  Element whose colours the steps set
 *                                      (default: the closest section).
 * Settings on [-step], all optional (colours):
 *   -bg="#ecebe7"                      Background of the theme target.
 *   -fg="#1e1e1e"                      Sets --pinned-steps-fg on it.
 *   -sub="#3a3935"                     Sets --pinned-steps-sub on it.
 *   -accent="#ffb200"                  Sets --pinned-steps-accent on it,
 *                                      e.g. for a smile icon that must
 *                                      stay visible on every background.
 *                                      On desktop the colours blend from
 *                                      step to step with the image wipe.
 *                                      Below the breakpoint the first
 *                                      step's colours hold. With bg-melt.js
 *                                      the background goes to the melt
 *                                      instead of the target itself.
 * Settings on [-heading]:
 *   -from="#aaa69d"                    Colour the words start at. They end
 *                                      at the heading's own colour.
 *
 * With reduced motion the section still pins and steps through, but the
 * steps swap instantly instead of fading and wiping, nothing zooms and the
 * lead-in heading stays its own colour.
 */
(function () {
  "use strict";

  const debug = window.WebflowFramework?.debug || function () {};

  const CSS = `
[data-pinned-steps-list].is-pinned-steps-stacked{display:grid;align-self:stretch}
.is-pinned-steps-stacked>[data-pinned-steps-step]{grid-area:1/1;min-height:0}
`;

  const CLIP_HIDDEN = "inset(100% 0% 0% 0%)";
  const CLIP_SHOWN = "inset(0% 0% 0% 0%)";

  function injectStyles() {
    if (document.getElementById("pinned-steps-styles")) return;
    const style = document.createElement("style");
    style.id = "pinned-steps-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function numberAttr(el, name, fallback) {
    const value = parseFloat(el.getAttribute(name));
    return Number.isFinite(value) ? value : fallback;
  }

  // Keep ScrollTrigger in step with Lenis, whether smooth scroll started
  // before or after this script
  function syncLenis() {
    const update = () => window.ScrollTrigger.update();
    const wire = (lenis) => {
      if (!lenis || lenis.__pinnedStepsSynced) return;
      lenis.__pinnedStepsSynced = true;
      lenis.on("scroll", update);
    };
    wire(window.WebflowFramework?.lenis);
    document.addEventListener("smoothScrollReady", (event) => wire(event.detail?.lenis));
  }

  // Sticky children misbehave inside a pinned element, so turn them off
  // while pinned and hand back whatever inline values they had. They stay
  // positioned (relative, offsets cleared) so absolute children such as
  // the media frames keep them as their containing block.
  const STICKY_PROPS = ["position", "top", "bottom"];
  function unstick(root) {
    const stuck = [...root.querySelectorAll("*")].filter((el) => getComputedStyle(el).position === "sticky");
    const previous = stuck.map((el) => STICKY_PROPS.map((prop) => el.style[prop]));
    stuck.forEach((el) => Object.assign(el.style, { position: "relative", top: "auto", bottom: "auto" }));
    return () =>
      stuck.forEach((el, i) => STICKY_PROPS.forEach((prop, j) => (el.style[prop] = previous[i][j])));
  }

  function textsOf(step) {
    const marked = step.querySelectorAll("[data-pinned-steps-text]");
    return marked.length ? [...marked] : [...step.children];
  }

  const THEME_KEYS = ["bg", "fg", "sub", "accent"];

  // Per-step colours, blended between neighbouring steps by a fractional
  // step index. Returns null when no step sets a colour.
  function createTheme(root, steps) {
    const gsap = window.gsap;
    const themes = steps.map((step) => {
      const theme = {};
      THEME_KEYS.forEach((key) => (theme[key] = step.getAttribute(`data-pinned-steps-${key}`) || null));
      return theme;
    });
    const used = THEME_KEYS.filter((key) => themes.some((theme) => theme[key]));
    if (!used.length) return null;
    // A step without a colour keeps the one before it (or the first set)
    used.forEach((key) => {
      let last = themes.find((theme) => theme[key])[key];
      themes.forEach((theme) => {
        theme[key] = theme[key] || last;
        last = theme[key];
      });
    });

    const selector = root.getAttribute("data-pinned-steps-theme-target");
    const target = (selector && document.querySelector(selector)) || root.closest("section") || root;
    const previousBg = target.style.backgroundColor;

    function paint(index) {
      const i = Math.min(Math.max(index, 0), themes.length - 1);
      const a = themes[Math.floor(i)];
      const b = themes[Math.ceil(i)];
      const t = i - Math.floor(i);
      const mix = (key) => (t === 0 ? a[key] : gsap.utils.interpolate(a[key], b[key], t));
      if (used.includes("fg")) target.style.setProperty("--pinned-steps-fg", mix("fg"));
      if (used.includes("sub")) target.style.setProperty("--pinned-steps-sub", mix("sub"));
      if (used.includes("accent")) target.style.setProperty("--pinned-steps-accent", mix("accent"));
      if (used.includes("bg")) {
        // bg-melt.js reads this for the body; its CSS keeps the target clear
        const bg = mix("bg");
        target._meltColor = bg;
        target.style.backgroundColor = bg;
      }
    }

    function clear() {
      delete target._meltColor;
      target.style.removeProperty("--pinned-steps-fg");
      target.style.removeProperty("--pinned-steps-sub");
      target.style.removeProperty("--pinned-steps-accent");
      target.style.backgroundColor = previousBg;
    }

    return { paint, clear };
  }

  function createPinnedSteps(root, mm, reducedMotion) {
    const gsap = window.gsap;
    const list = root.querySelector("[data-pinned-steps-list]");
    const steps = list ? [...list.querySelectorAll("[data-pinned-steps-step]")] : [];
    const frames = [...root.querySelectorAll("[data-pinned-steps-media]")];
    const count = Math.min(steps.length, frames.length);
    if (count < 2) {
      debug("pinned-steps", "init", "Needs at least two steps and two media frames", "warn");
      return;
    }
    const minWidth = numberAttr(root, "data-pinned-steps-min-width", 992);
    const theme = createTheme(root, steps.slice(0, count));

    mm.add(`(min-width: ${minWidth}px)`, () => {
      list.classList.add("is-pinned-steps-stacked");
      const restick = unstick(root);
      const texts = steps.slice(0, count).map(textsOf);
      const imgs = frames.slice(0, count).map((frame) => frame.querySelector("img"));

      const proxy = { i: 0 };
      const paint = theme ? () => theme.paint(proxy.i) : null;
      if (paint) paint();

      gsap.set(frames.slice(1, count), { clipPath: CLIP_HIDDEN });
      texts.slice(1).forEach((nodes) => gsap.set(nodes, { autoAlpha: 0, y: reducedMotion ? 0 : 20 }));

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        // Repaint on every render so the colours follow scrubbing both ways
        onUpdate: paint || undefined,
        scrollTrigger: {
          trigger: root,
          start: "center center",
          end: () => "+=" + window.innerHeight * (count - 1) * 0.8,
          pin: true,
          scrub: reducedMotion ? true : 0.6,
          invalidateOnRefresh: true,
          // Settle on a whole step so a resting scroll never sits between two
          snap: {
            snapTo: "labels",
            duration: reducedMotion ? 0 : { min: 0.3, max: 0.8 },
            delay: 0.15,
            ease: "power1.inOut",
          },
        },
      });
      tl.addLabel("p0", 0);
      for (let i = 1; i < count; i++) {
        const at = i - 1 + 0.25;
        if (reducedMotion) {
          // Swap at the midpoint between steps
          tl.set(texts[i - 1], { autoAlpha: 0 }, i - 0.5)
            .set(frames[i], { clipPath: CLIP_SHOWN }, i - 0.5)
            .set(texts[i], { autoAlpha: 1 }, i - 0.5)
            .addLabel("p" + i, i);
          if (paint) tl.set(proxy, { i }, i - 0.5);
          continue;
        }
        if (paint) tl.to(proxy, { i, duration: 0.5, ease: "power2.inOut" }, at);
        tl.to(texts[i - 1], { autoAlpha: 0, y: -20, duration: 0.2, ease: "power1.in" }, at)
          .to(frames[i], { clipPath: CLIP_SHOWN, duration: 0.5, ease: "power2.inOut" }, at);
        if (imgs[i]) tl.fromTo(imgs[i], { scale: 1.15 }, { scale: 1, duration: 0.5, ease: "power2.out" }, at);
        tl.to(texts[i], { autoAlpha: 1, y: 0, duration: 0.2, ease: "power1.out" }, at + 0.3).addLabel("p" + i, i);
      }
      tl.to({}, { duration: 0.25 });

      return () => {
        list.classList.remove("is-pinned-steps-stacked");
        restick();
        if (theme) theme.clear();
      };
    });

    // Stacked steps all show at once, so the first step's colours hold
    if (theme) {
      mm.add(`(max-width: ${minWidth - 0.02}px)`, () => {
        theme.paint(0);
        return theme.clear;
      });
    }

    if (reducedMotion) return;

    mm.add(`(max-width: ${minWidth - 0.02}px)`, () => {
      document.querySelectorAll("[data-pinned-steps-reveal]").forEach((el) => {
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: el, start: "clamp(top bottom)", end: "clamp(top 55%)", scrub: 0.6 },
        });
        tl.fromTo(el, { clipPath: "inset(10% 8% 10% 8% round 6px)" }, { clipPath: "inset(0% 0% 0% 0% round 6px)" }, 0);
        const img = el.tagName === "IMG" ? null : el.querySelector("img");
        if (img) tl.fromTo(img, { scale: 1.12 }, { scale: 1 }, 0);
      });
    });
  }

  function createHeading(heading) {
    const gsap = window.gsap;
    const words = new window.SplitText(heading, { type: "words" }).words;
    const to = getComputedStyle(heading).color;
    const from = heading.getAttribute("data-pinned-steps-heading-from") || "#aaa69d";
    gsap.fromTo(
      words,
      { color: from },
      {
        color: to,
        ease: "none",
        stagger: 0.1,
        scrollTrigger: { trigger: heading, start: "top 85%", end: "bottom 45%", scrub: true },
      }
    );
  }

  function start() {
    const gsap = window.gsap;
    if (!gsap || !window.ScrollTrigger) {
      debug("pinned-steps", "init", "GSAP or ScrollTrigger missing, staying static", "warn");
      return;
    }
    gsap.registerPlugin(window.ScrollTrigger);
    syncLenis();

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mm = gsap.matchMedia();

    document.querySelectorAll("[data-pinned-steps]").forEach((root) => {
      try {
        createPinnedSteps(root, mm, reducedMotion);
      } catch (error) {
        console.error("Pinned steps failed to start:", error);
      }
    });

    if (!reducedMotion && window.SplitText) {
      gsap.registerPlugin(window.SplitText);
      document.querySelectorAll("[data-pinned-steps-heading]").forEach((heading) => {
        try {
          createHeading(heading);
        } catch (error) {
          console.error("Pinned steps heading failed to start:", error);
        }
      });
    }

    // Images and fonts change heights, and so where the pin starts and ends
    window.addEventListener("load", () => window.ScrollTrigger.refresh(), { once: true });
    debug("pinned-steps", "init", "Ready", "info");
  }

  function init() {
    try {
      injectStyles();
      // Wait for web fonts so SplitText and the pin measure final glyphs
      const safeStart = () => {
        try {
          start();
        } catch (error) {
          console.error("Pinned steps failed to load:", error);
        }
      };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(safeStart);
      else safeStart();
    } catch (error) {
      console.error("Pinned steps failed to load:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
