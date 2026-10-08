/**
 * Parallax columns
 *
 * A hero above a grid of items laid out in columns, in the style of
 * this.design. The hero and grid fade up into place on load. Scrolling, the
 * hero stays put while the grid rises over it. Each column starts pushed
 * away from the centre of the screen and eases back in as it rises.
 * Columns start at staggered heights and drift until their bottoms line up
 * at the end of the grid. Items are images or muted looping videos.
 *
 * The layout lives in Webflow: style the CMS list as a CSS grid (columns and
 * gap per breakpoint) and the items with their aspect ratio, so the Designer
 * canvas shows the grid as it ends up. The script never moves the items. It
 * reads which column each item sits in and adds the stagger and motion with
 * transforms.
 *
 * Load standalone on pages that need it (not part of the framework's main.js):
 *   <script src="https://cdn.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@1.0.0/js/parallax-columns.js" defer></script>
 *
 * Markup (attribute prefix data-parallax-columns):
 *   [data-parallax-columns]            Section. Optional settings below.
 *     [-hero]                          The hero, styled at its resting height
 *                                      (40svh suits). Stays pinned while the
 *                                      grid scrolls over it. Fade it on
 *                                      scroll with a Webflow interaction.
 *     [-grid]                          Follows the hero. Style its padding
 *                                      and max width.
 *       CMS list                       Styled as a grid, in display order.
 *                                      Items fill it row by row.
 *         [-item]                      One collection item. Style its aspect
 *                                      ratio and overflow. Add -video bound
 *                                      to a video URL field to play an .mp4
 *                                      over the image.
 *           img[-media]                Image, or the video's poster. Style it
 *                                      to cover the item.
 *
 * Settings on [data-parallax-columns]:
 *   -strength="1"                      Motion multiplier, 0 turns it off.
 *   -intro="loop"                      Motion while the page sits at the top
 *                                      (loop by default, "none" for none),
 *                                      so the grid is alive before anyone
 *                                      scrolls. Scrolling settles the columns
 *                                      back into line before the parallax
 *                                      takes over; back at the top it resumes.
 *                                        drift  Columns bob up and down.
 *                                        loop   Columns run as endless
 *                                               conveyors, alternating
 *                                               directions.
 *                                        step   Columns tick along one item
 *                                               at a time, like a departure
 *                                               board.
 *                                        reels  Columns spin in like slot
 *                                               machine reels on load, then
 *                                               stop.
 *                                      A ?parallax-intro= URL parameter
 *                                      overrides it, for comparing them.
 *   -pan="false"                      Turns off the mouse pan, on by
 *                                      default. Once the columns run past
 *                                      the grid's padding, the mouse pans
 *                                      them left and right. Style the CMS
 *                                      list wider than the screen (e.g.
 *                                      112%, with a negative left margin of
 *                                      half the extra) so the edge columns
 *                                      are cut off. The pointer's place
 *                                      across the section sets how far along
 *                                      the overflow the grid sits: at its
 *                                      centre the grid is centred, at its
 *                                      right edge the last column lines up
 *                                      with the grid's padding. Mouse only;
 *                                      touch screens see it centred.
 *   -shrink                            Shrink the grid into a rounded frame
 *                                      as the page scrolls past it. From a
 *                                      little after the grid's top reaches
 *                                      the top of the screen until its
 *                                      bottom comes on screen (at least
 *                                      most of a screen height of
 *                                      scrolling), it narrows from full
 *                                      width to
 *                                      the hero's width (the container the
 *                                      rest of the page sits in), then keeps
 *                                      shrinking as it leaves. A selector
 *                                      (e.g. -shrink=".container-large")
 *                                      matches that element's width instead.
 *                                      It shrinks towards its bottom edge,
 *                                      so whatever follows stays snug under
 *                                      it. The pan still works while shrunk.
 *   -shrink-end="0.9"                  How much further it shrinks past that
 *                                      width by the time its bottom is a
 *                                      fifth of the way down the screen.
 *   -shrink-radius="24"                Corner radius of the frame, in pixels,
 *                                      once shrunk to the container width.
 *   -shrink-border="#e8e6df"           Colour of a 1px border that fades in
 *                                      round the frame as it shrinks.
 *
 * With reduced motion the columns keep their stagger but nothing moves,
 * fades or autoplays.
 */
(function () {
  "use strict";

  const debug = window.WebflowFramework?.debug || function () {};

  // Space above the first item of each column, as a share of the column
  // width, in a repeating pattern that reads as random. Columns start at
  // uneven heights and drift until their bottoms line up.
  const COLUMN_HEADS = [0.2, 0.55, 0, 0.35, 0.7, 0.1, 0.45, 0.25];
  // How far a column starts from its place, per unit of its distance from
  // the centre of the screen, in column widths
  const SPREAD = 1.5;

  const INTROS = ["drift", "loop", "step", "reels"];
  // Scroll position, in pixels, still treated as the top of the page
  const TOP_SLACK = 2;
  // drift: how far each column sinks, in column widths, how long a bob
  // takes, and where in it each column starts
  const DRIFT_DEPTH = 0.35;
  const DRIFT_PERIOD = 6;
  const DRIFT_PHASES = [0, 0.5, 0.2, 0.7, 0.35, 0.85, 0.1, 0.6];
  // loop: items per second, per column
  const LOOP_SPEEDS = [0.126, -0.087, 0.055, -0.063, 0.102, -0.079, 0.118, -0.071];
  // step: seconds between steps, and how long each takes
  const STEP_EVERY = 2.6;
  const STEP_DURATION = 0.9;
  const STEP_STAGGER = 0.12;
  // How long a moving column takes to glide into line once scrolling starts
  const SETTLE_DURATION = 1.1;
  // Seconds for the grid to catch up with the pointer when panning (time
  // constant)
  const PAN_LAG = 0.45;
  // shrink: scroll, in screen heights, held at full width before narrowing,
  // the least scroll the grid takes to narrow to the container width, and
  // where on the screen, as a share of its height, the grid's bottom ends
  // the shrink
  const SHRINK_DELAY = 0.2;
  const SHRINK_MIN_SPAN = 0.9;
  const SHRINK_END_AT = 0.2;

  const EASE_OUT = "cubic-bezier(.215,.61,.355,1)"; // power3.out
  const CSS = `
[data-parallax-columns]{position:relative;overflow-x:clip}
[data-parallax-columns-hero]{position:relative}
[data-parallax-columns].is-parallax-columns-motion [data-parallax-columns-hero]{position:sticky;top:0}
[data-parallax-columns-grid]{position:relative;z-index:1}
[data-parallax-columns].is-parallax-columns-shrink [data-parallax-columns-grid]{overflow:clip;transform-origin:50% 100%;will-change:scale}
[data-parallax-columns].is-parallax-columns-motion [data-parallax-columns-hero],[data-parallax-columns].is-parallax-columns-motion [data-parallax-columns-grid]{opacity:0;transform:translate3d(0,40px,0)}
[data-parallax-columns].is-parallax-columns-in [data-parallax-columns-hero],[data-parallax-columns].is-parallax-columns-in [data-parallax-columns-grid]{opacity:1;transform:none;transition:opacity 1s ${EASE_OUT},transform 1s ${EASE_OUT}}
[data-parallax-columns].is-parallax-columns-in [data-parallax-columns-hero]{transition-delay:.25s}
[data-parallax-columns].is-parallax-columns-in [data-parallax-columns-grid]{transition-delay:.5s}
[data-parallax-columns].is-parallax-columns-motion [data-parallax-columns-item]{will-change:transform}
[data-parallax-columns-item]{position:relative}
[data-parallax-columns-item] img,[data-parallax-columns-item] video{pointer-events:none;-webkit-user-drag:none;user-select:none}
[data-parallax-columns-item] video{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover}
[data-parallax-columns].is-parallax-columns-motion [data-parallax-columns-media]{opacity:0;transition:opacity .4s ease}
[data-parallax-columns].is-parallax-columns-motion [data-parallax-columns-media].is-parallax-columns-loaded{opacity:1}`;

  function injectStyles() {
    if (document.getElementById("parallax-columns-styles")) return;
    const style = document.createElement("style");
    style.id = "parallax-columns-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function numberAttr(el, name, fallback) {
    const value = parseFloat(el.getAttribute(name));
    return Number.isFinite(value) ? value : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // Remainder that keeps the sign of the divisor
  function mod(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function introName(section) {
    let fromUrl = null;
    try {
      fromUrl = new URLSearchParams(window.location.search).get("parallax-intro");
    } catch (error) {
      // Ignore
    }
    const name = (fromUrl || section.getAttribute("data-parallax-columns-intro") || "loop").trim().toLowerCase();
    return INTROS.includes(name) ? name : null;
  }

  // Webflow marks empty CMS bindings with a class rather than removing them
  function isPresent(el) {
    return !!el && !el.classList.contains("w-condition-invisible") && !el.classList.contains("w-dyn-bind-empty");
  }

  function prepareItem(el) {
    const img = el.querySelector("img[data-parallax-columns-media]");
    el.querySelectorAll("img").forEach((image) => {
      image.alt = "";
      image.draggable = false;
    });

    const videoUrl = (el.getAttribute("data-parallax-columns-video") || "").trim();
    if (videoUrl && !el.querySelector("video")) {
      const video = document.createElement("video");
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "none";
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("aria-hidden", "true");
      if (isPresent(img) && img.getAttribute("src")) video.poster = img.getAttribute("src");
      video.src = videoUrl;
      el.appendChild(video);
    }
    return el;
  }

  // Fade each image in once it has loaded
  function revealWhenLoaded(img) {
    if (!img || img.classList.contains("is-parallax-columns-loaded")) return;
    const show = () => img.classList.add("is-parallax-columns-loaded");
    if (img.complete && img.naturalWidth) show();
    else {
      img.addEventListener("load", show, { once: true });
      img.addEventListener("error", show, { once: true });
    }
  }

  // Distance from an element's top or left edge to its ancestor's, ignoring
  // transforms
  function offsetWithin(el, ancestor, axis) {
    let total = 0;
    while (el && el !== ancestor) {
      total += axis === "x" ? el.offsetLeft : el.offsetTop;
      el = el.offsetParent;
    }
    return total;
  }

  function createParallaxColumns(section) {
    const grid = section.querySelector("[data-parallax-columns-grid]");
    if (!grid) {
      debug("parallax-columns", "init", "Missing [data-parallax-columns-grid]", "warn");
      return;
    }

    const items = Array.from(grid.querySelectorAll("[data-parallax-columns-item]")).map(prepareItem);
    if (!items.length) {
      debug("parallax-columns", "init", "No [data-parallax-columns-item] items found", "warn");
      return;
    }
    const list = items[0].parentElement;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const settings = {
      strength: Math.max(0, numberAttr(section, "data-parallax-columns-strength", 1)),
    };
    const motion = !reducedMotion && settings.strength > 0;

    if (motion) section.classList.add("is-parallax-columns-motion");

    // Shrink: the target width's element, how far it shrinks overall, and
    // the grid's place and the scale it narrows to, in pixels
    const shrinkValue = section.getAttribute("data-parallax-columns-shrink");
    const shrink =
      motion && shrinkValue !== null && shrinkValue !== "false"
        ? {
            target: shrinkValue && shrinkValue !== "true" ? document.querySelector(shrinkValue) : section.querySelector("[data-parallax-columns-hero]"),
            end: clamp(numberAttr(section, "data-parallax-columns-shrink-end", 0.9), 0.1, 1),
            radius: Math.max(0, numberAttr(section, "data-parallax-columns-shrink-radius", 24)),
            border: section.getAttribute("data-parallax-columns-shrink-border") || "",
            to: 1,
            top: 0,
            height: 0,
          }
        : null;
    if (shrink && !shrink.target) {
      debug("parallax-columns", "init", `No element matches -shrink="${shrinkValue}"`, "warn");
    }
    if (shrink && shrink.target) section.classList.add("is-parallax-columns-shrink");

    // Videos play only while on screen, and never with reduced motion
    const videoObserver =
      !reducedMotion && "IntersectionObserver" in window
        ? new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
              const video = entry.target;
              if (entry.isIntersecting) {
                if (video.preload === "none") video.preload = "auto";
                video.play().catch(() => {});
              } else {
                video.pause();
              }
            });
          })
        : null;
    items.forEach((item) => {
      if (videoObserver) item.querySelectorAll("video").forEach((video) => videoObserver.observe(video));
      if (motion) revealWhenLoaded(item.querySelector("[data-parallax-columns-media]"));
    });

    let columns = [];
    let gridHeight = 0;
    let viewportWidth = 0;
    let viewportHeight = 0;

    // Intro motion while the page sits at the top. Column positions are
    // counted in items rather than pixels, so they survive a re-measure.
    const intro = motion ? introName(section) : null;
    const wraps = intro === "loop" || intro === "step" || intro === "reels";
    const introColumns = [];
    // How much of the idle motion shows, eased in at the top and out once
    // scrolling starts
    let weight = 0;
    let driftClock = 0;
    // The first step comes soon after load
    let stepClock = STEP_EVERY - 1.2;
    let introFrame = null;
    let lastTick = 0;

    // In an intro that wraps, the item part-way out at a column's top also
    // shows part-way in at its bottom, as a copy, so the column never has a
    // gap there for the item to pop into
    const ghosts = new Map();
    if (wraps && getComputedStyle(list).position === "static") list.style.position = "relative";

    function ghostOf(item) {
      let ghost = ghosts.get(item);
      if (ghost) return ghost;
      ghost = item.cloneNode(true);
      [ghost, ...ghost.querySelectorAll("[id],[data-w-id]")].forEach((el) => {
        el.removeAttribute("id");
        el.removeAttribute("data-w-id");
      });
      ghost.setAttribute("aria-hidden", "true");
      ghost.inert = true;
      ghost.style.cssText = "position:absolute;margin:0;pointer-events:none";
      if (videoObserver) ghost.querySelectorAll("video").forEach((video) => videoObserver.observe(video));
      sizeGhost(item, ghost);
      list.appendChild(ghost);
      ghosts.set(item, ghost);
      return ghost;
    }

    function sizeGhost(item, ghost) {
      ghost.style.left = `${item.offsetLeft}px`;
      ghost.style.top = `${item.offsetTop}px`;
      ghost.style.width = `${item.offsetWidth}px`;
      ghost.style.height = `${item.offsetHeight}px`;
    }

    function introColumn(i) {
      if (!introColumns[i]) introColumns[i] = { slots: 0, tween: null };
      return introColumns[i];
    }

    function isAtTop() {
      return window.scrollY <= TOP_SLACK;
    }

    // Move a column to a whole number of items along, starting at `start`.
    // With a velocity it leaves at that speed and arrives at rest.
    function tweenTo(state, to, start, duration, ease, velocity) {
      state.tween = { from: state.slots, to, start, duration: duration * 1000, ease, velocity: velocity || 0 };
    }

    function advanceTween(state, now) {
      const tween = state.tween;
      if (!tween) return;
      const t = clamp((now - tween.start) / tween.duration, 0, 1);
      if (tween.velocity) {
        // Hermite curve from the running speed to a stop
        const seconds = tween.duration / 1000;
        const t2 = t * t;
        const t3 = t2 * t;
        state.slots =
          (2 * t3 - 3 * t2 + 1) * tween.from +
          (t3 - 2 * t2 + t) * seconds * tween.velocity +
          (3 * t2 - 2 * t3) * tween.to;
      } else {
        state.slots = tween.from + (tween.to - tween.from) * tween.ease(t);
      }
      if (t >= 1) {
        state.slots = tween.to;
        state.tween = null;
      }
    }

    function tick(now) {
      introFrame = null;
      const dt = lastTick ? Math.min((now - lastTick) / 1000, 0.05) : 0;
      lastTick = now;
      const atTop = isAtTop();

      const target = atTop ? 1 : 0;
      weight += (target - weight) * (1 - Math.exp(-dt / (atTop ? 0.5 : 0.2)));
      if (Math.abs(target - weight) < 0.001) weight = target;
      if (weight > 0) driftClock += dt;

      let stepDue = false;
      if (intro === "step") {
        if (atTop) {
          stepClock += dt;
          if (stepClock >= STEP_EVERY) {
            stepClock = 0;
            stepDue = true;
          }
        } else {
          stepClock = STEP_EVERY - 1.2;
        }
      }

      let moving = intro === "drift" ? weight > 0 : false;
      columns.forEach((column, i) => {
        const state = introColumn(i);
        if (intro === "loop") {
          const speed = LOOP_SPEEDS[i % LOOP_SPEEDS.length];
          if (atTop && !state.tween) {
            state.slots += speed * weight * dt;
          } else if (!atTop && !state.tween && state.slots % 1 !== 0) {
            // Glide on to the next whole item ahead, far enough along not
            // to double back
            const velocity = speed * weight;
            const ahead = state.slots + (velocity * SETTLE_DURATION) / 3;
            const to = velocity >= 0 ? Math.ceil(ahead) : Math.floor(ahead);
            tweenTo(state, to, now, SETTLE_DURATION, null, velocity);
          }
        } else if (stepDue) {
          const direction = i % 2 ? -1 : 1;
          tweenTo(state, Math.round(state.slots) + direction, now + i * STEP_STAGGER * 1000, STEP_DURATION, easeInOut);
        }
        advanceTween(state, now);
        if (state.tween) moving = true;
      });

      render();
      if (moving || (atTop && intro !== "reels")) introFrame = requestAnimationFrame(tick);
      else lastTick = 0;
    }

    function wakeIntro() {
      if (intro && !introFrame && intro !== "reels" && isAtTop()) introFrame = requestAnimationFrame(tick);
    }

    function startIntro() {
      if (!intro) return;
      if (intro === "reels") {
        const now = performance.now();
        columns.forEach((column, i) => {
          const state = introColumn(i);
          const direction = i % 2 ? 1 : -1;
          state.slots = direction * (8 + i * 3);
          tweenTo(state, 0, now + 300 + i * 150, 1.8 + i * 0.3, easeOutQuart);
        });
      }
      introFrame = requestAnimationFrame(tick);
      debug("parallax-columns", "intro", intro, "info");
    }

    // Group the items by the column the CSS grid put them in, left to right
    function readColumns() {
      const byLeft = new Map();
      items.forEach((item) => {
        if (!item.offsetParent) return;
        const left = Math.round(item.offsetLeft);
        if (!byLeft.has(left)) byLeft.set(left, []);
        byLeft.get(left).push(item);
      });
      return Array.from(byLeft.keys())
        .sort((a, b) => a - b)
        .map((left, i) => ({ items: byLeft.get(left), headShare: COLUMN_HEADS[i % COLUMN_HEADS.length] }));
    }

    // Pan: the edges the outer columns line up with when panned to (the
    // grid's padding inside the visible section), how far the columns run
    // past them on each side, and where the grid sits now and is heading,
    // in pixels
    const pan =
      motion && section.getAttribute("data-parallax-columns-pan") !== "false" && window.matchMedia("(hover: hover) and (pointer: fine)").matches
        ? { edgeLeft: 0, edgeRight: 0, left: 0, right: 0, x: 0, target: 0, ratio: 0.5, frame: null, last: 0 }
        : null;

    function measurePan() {
      if (!pan) return;
      const sectionRect = section.getBoundingClientRect();
      const gridStyle = getComputedStyle(grid);
      pan.edgeLeft = Math.max(0, sectionRect.left) + parseFloat(gridStyle.paddingLeft);
      pan.edgeRight = Math.min(window.innerWidth, sectionRect.right) - parseFloat(gridStyle.paddingRight);
    }

    // Left of the screen shows the first column in full, right the last,
    // and anywhere between sits that far along. The overflow comes from
    // where the columns are drawn, as the spread on scroll moves them.
    function aimPan(leftmost, rightmost) {
      pan.left = Math.max(0, pan.edgeLeft - leftmost);
      pan.right = Math.max(0, rightmost - pan.edgeRight);
      pan.target = pan.left - (pan.left + pan.right) * pan.ratio;
      if (!pan.frame && pan.target !== pan.x) pan.frame = requestAnimationFrame(stepPan);
    }

    function stepPan(now) {
      pan.frame = null;
      const dt = pan.last ? Math.min((now - pan.last) / 1000, 0.05) : 0;
      pan.last = now;
      pan.x += (pan.target - pan.x) * (1 - Math.exp(-dt / PAN_LAG));
      if (Math.abs(pan.target - pan.x) < 0.1) pan.x = pan.target;
      list.style.transform = Math.abs(pan.x) > 0.05 ? `translate3d(${pan.x}px,0,0)` : "";
      if (pan.x !== pan.target) pan.frame = requestAnimationFrame(stepPan);
      else pan.last = 0;
    }

    if (pan) {
      window.addEventListener(
        "pointermove",
        (event) => {
          if (event.pointerType !== "mouse") return;
          // Measured across the section, so its centre is the resting point
          const rect = section.getBoundingClientRect();
          const left = Math.max(0, rect.left);
          const right = Math.min(window.innerWidth, rect.right);
          pan.ratio = clamp((event.clientX - left) / Math.max(right - left, 1), 0, 1);
          render();
        },
        { passive: true }
      );
    }

    function measure() {
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      list.style.marginBottom = "";
      measurePan();
      columns = readColumns();
      if (!columns.length) return;

      const sectionLeft = section.getBoundingClientRect().left;
      const listTop = offsetWithin(list, section, "y");
      ghosts.forEach((ghost, item) => sizeGhost(item, ghost));
      columns.forEach((column) => {
        const first = column.items[0];
        const last = column.items[column.items.length - 1];
        column.width = first.offsetWidth;
        column.itemHeight = first.offsetHeight;
        // Corners the cut at the column's top keeps, so an item sliding
        // under it stays rounded
        const radius = getComputedStyle(first).borderRadius;
        column.round = radius && radius !== "0px" ? ` round ${radius}` : "";
        column.top = offsetWithin(first, section, "y");
        column.center = sectionLeft + offsetWithin(first, section, "x") + column.width / 2;
        column.head = column.width * column.headShare;
        // Height of the column's items, from its first item's top to its
        // last item's bottom, plus the space above it
        column.contentHeight = column.head + offsetWithin(last, section, "y") + last.offsetHeight - column.top;
        // Distance from one item's top to the next, and the length of the
        // loop the items wrap round in the intro
        const count = column.items.length;
        column.pitch = count > 1 ? (offsetWithin(last, section, "y") - column.top) / (count - 1) : 0;
        column.loopHeight = column.pitch * count;
        // The first row shows on load, and in an intro that wraps any item
        // can come round
        const eager = wraps ? column.items : [first];
        eager.forEach((item) => {
          const img = item.querySelector("img");
          if (img) img.loading = "eager";
        });
        column.items.forEach((item) => {
          item.querySelectorAll("img[srcset]").forEach((image) => {
            image.sizes = `${Math.ceil(column.width)}px`;
          });
        });
      });

      // Columns end with their bottoms lined up at the tallest one. The grid
      // grows by whatever the stagger adds below its own height.
      gridHeight = Math.max(...columns.map((column) => column.contentHeight));
      const extra = columns[0].top + gridHeight - (listTop + list.offsetHeight);
      if (extra > 0) list.style.marginBottom = `${extra}px`;
      if (shrink && shrink.target) {
        shrink.to = clamp(shrink.target.offsetWidth / Math.max(grid.offsetWidth, 1), 0.1, 1);
        shrink.top = offsetWithin(grid, section, "y");
        shrink.height = grid.offsetHeight;
      }
      render();
      debug("parallax-columns", "layout", `${columns.length} columns, ${items.length} items`, "info");
    }

    function place(column, x, y, state) {
      const slots = state ? state.slots : 0;
      column.items.forEach((item, i) => {
        let shift = 0;
        let clip = "";
        let ghostClip = "";
        if (slots && column.loopHeight) {
          // Wrap the item round the column. Above the column's top it is cut
          // off at that line, so items slide under it rather than over the
          // hero, and once out of sight come back in at the bottom.
          const home = i * column.pitch;
          // Positions run from just under one item above the top to the
          // last slot, so whole steps always fill every slot. Rounding error
          // just short of a full loop counts as none.
          const bottom = column.loopHeight - column.pitch;
          let back = mod(bottom - home - slots * column.pitch, column.loopHeight);
          if (column.loopHeight - back < 0.5) back = 0;
          const position = bottom - back;
          shift = position - home;
          if (position < 0) {
            clip = `inset(${-position}px 0 0 0${column.round})`;
            // The copy sits a loop further down, cut off at the bottom of
            // the column's last slot
            if (position + column.pitch < column.itemHeight) {
              ghostClip = `inset(0 0 ${position + column.pitch}px 0${column.round})`;
            }
          }
        }
        item.style.transform = `translate3d(${x}px,${y + shift}px,0)`;
        item.style.clipPath = clip;
        if (ghostClip) {
          const ghost = ghostOf(item);
          ghost.style.transform = `translate3d(${x}px,${y + shift + column.loopHeight}px,0)`;
          ghost.style.clipPath = ghostClip;
          ghost.style.visibility = "";
        } else if (ghosts.has(item)) {
          ghosts.get(item).style.visibility = "hidden";
        }
      });
    }

    // Narrow the grid to the container width while it scrolls up the
    // screen, then on down by -shrink-end as it leaves. Scaled rather than
    // resized, so the columns inside keep their layout and motion.
    function renderShrink(sectionTop) {
      const vh = viewportHeight;
      const top = sectionTop + shrink.top + vh * SHRINK_DELAY;
      const span = Math.max(shrink.height - vh, vh * SHRINK_MIN_SPAN);
      const narrow = clamp(-top / span, 0, 1);
      const leave = clamp((-top - span) / Math.max(vh * (1 - SHRINK_END_AT), 1), 0, 1);
      const scale = leave > 0 ? shrink.to * (1 - (1 - shrink.end) * leave) : 1 - (1 - shrink.to) * easeInOut(narrow);
      // The corners round in as it narrows, and stay the same size on screen
      const progress = shrink.to < 1 ? clamp((1 - scale) / (1 - shrink.to), 0, 1) : narrow;
      const radius = shrink.radius * progress;
      grid.style.scale = scale < 1 ? `${scale}` : "";
      grid.style.borderRadius = radius > 0 ? `${radius / scale}px` : "";
      // An outline drawn inside the edge rather than a border, so it sits
      // over the columns and the layout never shifts
      const ring = shrink.border && progress > 0 ? progress / scale : 0;
      grid.style.outline = ring ? `${ring}px solid ${shrink.border}` : "";
      grid.style.outlineOffset = ring ? `${-ring}px` : "";
    }

    // Scroll-linked motion, same curves as this.design's ScrollTrigger setup
    function render() {
      if (!motion) {
        columns.forEach((column) => place(column, 0, column.head));
        return;
      }
      const sectionTop = section.getBoundingClientRect().top;
      if (shrink && shrink.target) renderShrink(sectionTop);
      const vw = viewportWidth;
      const vh = viewportHeight;
      const strength = settings.strength;
      let leftmost = Infinity;
      let rightmost = -Infinity;

      columns.forEach((column, i) => {
        const top = sectionTop + column.top;

        // From the column's top entering the screen to a screen above it,
        // it eases in from beside its place, further out the further it is
        // from the centre
        const spreadProgress = clamp((vh - top) / (2 * vh), 0, 1);
        const start = ((vw / 2 - column.center) / vw) * column.width * -SPREAD * strength;
        const x = start * (1 - easeOut(spreadProgress));

        // From the column's top reaching halfway up the screen until its
        // bottom reaches the bottom of the screen, its items drift down so
        // every column ends flush with the bottom of the grid
        const driftDistance = Math.max(gridHeight - vh / 2, 1);
        const driftProgress = clamp((vh / 2 - top) / driftDistance, 0, 1);
        let y = column.head + (gridHeight - column.contentHeight) * driftProgress * strength;

        if (intro === "drift" && weight > 0) {
          const phase = driftClock / DRIFT_PERIOD + DRIFT_PHASES[i % DRIFT_PHASES.length];
          y += ((weight * column.width * DRIFT_DEPTH * strength) / 2) * (1 - Math.cos(phase * 2 * Math.PI));
        }

        place(column, x, y, wraps ? introColumns[i] : null);
        leftmost = Math.min(leftmost, column.center - column.width / 2 + x);
        rightmost = Math.max(rightmost, column.center + column.width / 2 + x);
      });
      if (pan && columns.length) aimPan(leftmost, rightmost);
    }

    if (motion) {
      window.addEventListener(
        "scroll",
        () => {
          render();
          wakeIntro();
        },
        { passive: true }
      );
      // Lenis moves the page inside its own frame loop; follow it there so
      // the grid never trails the page by a frame
      const followLenis = () => {
        const lenis = window.WebflowFramework?.lenis;
        if (lenis && typeof lenis.on === "function") lenis.on("scroll", render);
      };
      if (window.WebflowFramework?.lenis) followLenis();
      else document.addEventListener("smoothScrollReady", followLenis, { once: true });
    }

    let resizeFrame = null;
    const scheduleMeasure = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(measure);
    };
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;
    window.addEventListener("resize", () => {
      // Ignore height-only changes from mobile browser bars
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w === lastWidth && Math.abs(h - lastHeight) < 120) return;
      lastWidth = w;
      lastHeight = h;
      scheduleMeasure();
    });
    // The grid can also change shape without the window resizing, e.g. when
    // the hero above it reflows
    if ("ResizeObserver" in window) {
      let lastListWidth = list.offsetWidth;
      new ResizeObserver(() => {
        if (list.offsetWidth === lastListWidth) return;
        lastListWidth = list.offsetWidth;
        scheduleMeasure();
      }).observe(list);
    }

    measure();
    startIntro();
    // Web fonts can change the hero's height and so where the grid starts
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    window.addEventListener("load", measure, { once: true });

    // Fade in once the first layout has painted
    if (motion) {
      requestAnimationFrame(() => requestAnimationFrame(() => section.classList.add("is-parallax-columns-in")));
    }

    debug("parallax-columns", "init", `Ready with ${items.length} items`, "info");
  }

  function init() {
    try {
      injectStyles();
      document.querySelectorAll("[data-parallax-columns]").forEach((section) => {
        try {
          createParallaxColumns(section);
        } catch (error) {
          console.error("Parallax columns failed to start:", error);
        }
      });
    } catch (error) {
      console.error("Parallax columns failed to load:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
