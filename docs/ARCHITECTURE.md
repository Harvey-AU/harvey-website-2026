# Architecture

How the Harvey 2026 motion scripts get onto the page, how they share one frame loop with GSAP, and why a change needs a release before it shows up.

## What runs on the page

Webflow owns the page: layout, content, styling and the GSAP library.
This repo owns only the motion.
Each script finds elements by their `data-*` attribute and animates them, so nothing in Webflow references the code beyond the attribute and a script tag.

```mermaid
flowchart LR
  subgraph Webflow["Webflow (harvey-2026.webflow.io)"]
    HTML["Page HTML<br/>layout, CMS content, data-* hooks"]
    GSAP["GSAP 3.15 + ScrollTrigger<br/>Webflow GSAP integration"]
    Footer["Home page footer code<br/>script tags pinned to @version"]
  end

  subgraph CDN["jsDelivr"]
    Tag["gh/Harvey-AU/harvey-website-2026#64;X.Y.Z/js/*.js"]
    LenisLib["npm/lenis#64;1.3.26"]
  end

  subgraph Repo["GitHub repo"]
    Src["js/*.js on main"]
    GitTag["git tag vX.Y.Z"]
  end

  Src --> GitTag --> Tag
  Footer -- "loads" --> Tag
  Tag -- "smooth-scroll.js loads" --> LenisLib
  Tag -- "animates elements carrying" --> HTML
  Tag -- "uses window.gsap" --> GSAP
```

| Script | Hook | Needs GSAP | Follows Lenis |
| --- | --- | --- | --- |
| `smooth-scroll.js` | script tag (`data-lerp`) | Optional: drives Lenis from `gsap.ticker` when present | Creates it |
| `parallax-columns.js` | `[data-parallax-columns]` | No, own frame loop | Re-renders on each Lenis scroll |
| `pinned-steps.js` | `[data-pinned-steps]` | Yes, ScrollTrigger pin and scrub | Calls `ScrollTrigger.update()` |
| `smile-field.js` | `[data-smile-field]` | Yes, ScrollTrigger pin | Calls `ScrollTrigger.update()` |
| `marquee.js` | `[data-marquee]` | No, CSS animation | Reads velocity for the scroll boost |
| `bg-melt.js` | `[data-bg-melt]` | Optional: runs on `gsap.ticker` when present | Reads scroll position each tick |
| `work-explorer.js` | `[data-work-explorer]` | Yes, `gsap.quickTo` for the pan | No, pointer-driven |
| `nav-reveal.js` | `[data-nav-reveal]` | No | No (not on the page yet) |

Scripts that need GSAP check for `window.gsap` and `window.ScrollTrigger` and leave the page static without them, so a missing library degrades rather than throws.

## One frame loop: GSAP, Lenis and ScrollTrigger

Lenis replaces the browser's native wheel scrolling with an eased scroll.
Anything that reads the scroll position has to read it on the same frame Lenis moves it, or pinned sections jitter by a frame against the page.
So `smooth-scroll.js` hands Lenis to GSAP's ticker instead of letting Lenis run its own `requestAnimationFrame` loop, and turns off GSAP's lag smoothing so a slow frame never makes the two drift apart.

```mermaid
sequenceDiagram
  autonumber
  participant RAF as Browser frame
  participant Ticker as gsap.ticker
  participant Lenis as Lenis (smooth-scroll.js)
  participant ST as ScrollTrigger
  participant Own as Own-loop scripts

  RAF->>Ticker: tick(time)
  Ticker->>Lenis: lenis.raf(time * 1000)
  Lenis->>Lenis: ease scroll toward target, set window.scrollY
  Lenis-->>ST: "scroll" event, ScrollTrigger.update()<br/>pinned-steps, smile-field
  Lenis-->>Own: "scroll" event<br/>parallax-columns render, marquee boost
  Ticker->>Own: bg-melt update (added to the ticker)
  ST->>ST: pins and scrubbed timelines read the new scroll
```

Start-up order matters only in one place.
`smooth-scroll.js` creates Lenis asynchronously (it loads the library from jsDelivr), then exposes it as `window.WebflowFramework.lenis` and fires `smoothScrollReady`.
Every other script either finds Lenis already there or waits for that event, so the script tags can load in any order.
The intro pin above `pinned-steps.js` is a Webflow Interaction, which shares the same global ScrollTrigger.
It measures before `pinned-steps.js`, so the later pin starts at the right scroll position.
Webflow Interactions do not hook into Lenis themselves; on the Home page `pinned-steps.js` already calls `ScrollTrigger.update()` on each Lenis scroll, which keeps them in step.

## Why a change needs a release

Webflow cannot host files from this repo, and it caches published pages.
So the scripts are served from jsDelivr, which mirrors GitHub, and the footer pins each URL to a git tag.
A tag never changes once pushed, which makes the live site predictable: it only changes when someone edits the footer and publishes.
Pushing to `main` alone changes nothing live.

```mermaid
flowchart TD
  A["Edit js/ locally<br/>npm run dev previews the live site on local scripts"] --> B["PR: CI runs ESLint"]
  B --> C["Merge to main"]
  C --> D["Push a tag, vX.Y.Z"]
  D --> E{"jsDelivr serves<br/>@X.Y.Z/js/*.js?"}
  E -- "200" --> F["Webflow: bump @version on every<br/>script line in the Home footer code"]
  E -- "404" --> D
  F --> G["Publish in Webflow"]
  G --> H["Live: harvey-2026.webflow.io"]

  X["Footer bumped before the tag exists"]:::bad --> Y["Every script 404s<br/>all motion on the page breaks"]:::bad
  classDef bad fill:#fde2e1,stroke:#c0392b,color:#7b1d16
```

If jsDelivr has already cached a 404 for a version (because the footer was bumped first), pushing the tag is not enough on its own.
Purge each file with `https://purge.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@<version>/js/<file>.js`, then reload.

## Previewing without a release

`npm run dev` serves the live Webflow page through a local proxy that swaps the jsDelivr script URLs for the files in `js/`, and reloads the page when one changes.
Webflow's HTML, CSS and GSAP still come from the live site, so the preview matches production apart from the scripts under test.

```mermaid
flowchart LR
  Browser["Browser<br/>localhost:4321"] --> Dev["scripts/dev.mjs"]
  Dev -- "page HTML" --> Live["harvey-2026.webflow.io"]
  Dev -- "rewrite jsDelivr URLs to /js/" --> Browser
  Dev -- "/js/*.js" --> Local["local js/ files"]
  Local -. "file change: reload" .-> Browser
```
