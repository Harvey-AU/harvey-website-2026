# Harvey website 2026

Motion scripts for the Harvey 2026 Webflow site (harvey-2026.webflow.io).
These are site-specific, so they live here rather than in [webflow-framework](https://github.com/Harvey-AU/webflow-framework), which is shared across client sites.

## Scripts

| File | What it does | Hooks |
| --- | --- | --- |
| `js/smooth-scroll.js` | Site-wide smooth scroll via Lenis 1.3.26 (loaded from jsDelivr), driven by the GSAP ticker when GSAP is present. | `data-lerp` on the script tag (default 0.08) |
| `js/parallax-columns.js` | Hero grid of looping columns with scroll parallax and mouse pan, optionally shrinking from full width into a rounded frame at the container width as it scrolls away. | `[data-parallax-columns]` section, `data-parallax-columns-shrink/-radius/-border` |
| `js/pinned-reveal.js` | Section whose text lights up word by word as it scrolls in, pinning until every word is lit, while marked content above fades out (needs GSAP + ScrollTrigger). | `[data-pinned-reveal]` section, `[data-pinned-reveal-text]` text, `[data-pinned-reveal-fade]` content, `data-pinned-reveal-start` |
| `js/pinned-steps.js` | Pinned numbered steps with image wipes and optional per-step colours (needs GSAP + ScrollTrigger). | `[data-pinned-steps]` section, `data-pinned-steps-bg/-fg/-sub/-accent` on steps |
| `js/marquee.js` | Seamless endless row at a constant speed, with optional odd/even item split and scroll-velocity boost. | `[data-marquee]` strip, `data-marquee-items`, `data-marquee-boost` |
| `js/bg-melt.js` | Page background that melts between section colours as each section scrolls up, flipping marked artwork to light-on-dark over dark colours and melting marked text colour with it. | `[data-bg-melt]` sections, `data-bg-melt-fg`, `[data-bg-melt-invert]` artwork, `[data-bg-melt-text]` text |
| `js/smile-field.js` | Pinned statement ringed by a canvas field of grey strokes that curl into yellow rounded smiles, centre first, as it scrolls, while its words light up (needs GSAP + ScrollTrigger). | `[data-smile-field]` section, `[data-smile-field-text]` text, `data-smile-field-length/-color/-from` |
| `js/impact-chapter.js` | Pinned impact chapter: a canvas field curls into smiles behind the statement, which shrinks to a headline, then the stats slide in, fill and count up once (needs GSAP + ScrollTrigger). | `[data-impact-chapter]` section, `-stage`, `-copy`, `-statement`, `-stat`, `-number`, `-grid`, `-smile` |
| `js/impact-goals.js` | List of goals (the 17 UN SDGs) whose icons light up in order, grey to colour, the first time it scrolls into view. Plays once. | `[data-impact-goals]` list, `-item`, `-icon`, `-label`, `data-impact-goals-stagger` |
| `js/work-explorer.js` | Row of work cards that rests at its start and pans sideways with the pointer on desktop, staying put when the pointer leaves (needs GSAP). | `[data-work-explorer]` frame, `[data-work-explorer-track]` row, `data-work-explorer-left/-right` |
| `js/nav-reveal.js` | Header that hides on scroll down and reveals on scroll up (not used yet). | `[data-nav-reveal]` header |

Each file's header comment documents its full markup and settings.
No build step: files are served as they are.

## Loading

Scripts load from jsDelivr, pinned to a release tag (`X.Y.Z` below; `npm run release-status` prints the latest):

```html
<script src="https://cdn.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@X.Y.Z/js/smooth-scroll.js" data-lerp="0.12" defer></script>
<script src="https://cdn.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@X.Y.Z/js/parallax-columns.js" defer></script>
```

## Developing

`npm run dev` serves the live site at http://localhost:4321 (or the next free port) with its jsDelivr scripts swapped for the local `js/` files.
The page reloads when a script changes.
Set `SITE` to preview another Webflow domain.
Set `SCRIPTS=impact-chapter,impact-goals` to also load local scripts the live footer does not load yet.

`npm install` points git at `.githooks/`, whose `pre-push` refuses to push a branch whose PR is already merged.

## Releasing a change

1. Merge to `main`, then run `npm run release-status` to see the latest tag, untagged commits and what the live footer loads.
2. Tag it and push the tag: `git tag vX.Y.Z origin/main && git push origin vX.Y.Z`.
3. Check jsDelivr serves it: `https://cdn.jsdelivr.net/gh/Harvey-AU/harvey-website-2026@X.Y.Z/js/marquee.js` returns the script, not a 404.
4. In Webflow, swap the old `@version` for the new one on every script line in the Home page footer code, then publish.

Step 2 must land before step 4.
A footer pointing at a tag that does not exist yet 404s every script and breaks all the motion on the page.
A tag is immutable, so the live site only changes when the footer URL does.
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit together.
