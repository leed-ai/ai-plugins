# Inline SVG Diagrams Reference

The `svgDiagram` helper inlines an SVG file into the page wrapped in a themed
container, so hand-built SVG charts, diagrams, and illustrations are as easy to
drop in as an `<img>` — but with three advantages an `<img>` can't offer:

- **Theme-aware** — the SVG reacts to light/dark mode (an `<img src="*.svg">` is
  isolated from the page and cannot).
- **Crisp at any size** — vectors scale without raster blur.
- **No extra request** — the SVG is part of the HTML.

The styling lives in **one** Tailwind CSS file so every diagram shares a single,
theme-aware design system. This reference covers where to put SVG files, how to
reference them, and how to centralize their styling.

---

## Quick Start

1. **Create the SVG partial** at `src/_includes/svg/charts/adoption.hbs` (a single `<svg>`):

   ```hbs
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" role="img" aria-label="Adoption chart">
     <rect width="600" height="400" class="svgd-canvas"/>
     <text x="30" y="40" class="svgd-title">Adoption</text>
     <polyline points="20,380 300,200 580,80" stroke-width="2" class="svgd-series-accent"/>
   </svg>
   ```

2. **Add the styling once** to `tailwind/site/svg-diagrams.css` (see "Centralized Styling" below).

3. **Reference it** anywhere with the helper:

   ```hbs
   {{ svgDiagram "svg/charts/adoption" class="max-w-3xl mx-auto" }}
   ```

That's it. The helper renders:

```html
<div class="svg-diagram max-w-3xl mx-auto">
  <svg viewBox="0 0 600 400" ...> ... </svg>
</div>
```

---

## Where SVG Files Live

Treat `src/_includes/svg/` like an images directory and **organize with subfolders**:

```
src/_includes/svg/
├── charts/
│   ├── adoption.hbs
│   └── revenue.hbs
├── diagrams/
│   └── architecture.hbs
└── illustrations/
    └── empty-state.hbs
```

- Each file is a Handlebars partial (`.hbs`) containing a **single `<svg>` element**.
  Do NOT wrap it in a `<div>` — the helper adds the themed wrapper.
- The **partial name** passed to the helper is the path under `_includes/`,
  without the extension: `src/_includes/svg/charts/adoption.hbs` → `"svg/charts/adoption"`.
- These are partials, so they receive the page context — you can use Handlebars
  variables inside an SVG (e.g. `<text>{{ stat }}</text>`) for data-driven diagrams.

---

## Using the Helper

```hbs
{{ svgDiagram "svg/charts/adoption" class="w-full max-w-3xl mx-auto mt-12 rounded-xl" }}
```

- **The name must be quoted.** `{{ svgDiagram "svg/charts/adoption" }}` is a string;
  unquoted `svg/charts/adoption` is parsed by Handlebars as a variable lookup and
  will fail.
- **`class`** is appended to the wrapper: `<div class="svg-diagram {your classes}">`.
  Use it for sizing, spacing, borders, radius, shadow, responsive visibility — anything Tailwind.
- The wrapper's child `<svg>` is automatically set to `block w-full h-auto`, so it
  fills the wrapper. Control the rendered size with `max-w-*` on the wrapper.

### Adding non-style attributes (id, Alpine, data-\*)

The helper only accepts `class`. For an `id`, Alpine directives (`x-show`,
`x-data`), or `data-*` attributes, wrap the shortcode in your own element:

```hbs
<div id="adoption-chart" x-show="selection === 1">
  {{ svgDiagram "svg/charts/adoption" class="max-w-3xl mx-auto" }}
</div>
```

---

## Centralized Styling

All diagram styling lives in **one** file: `tailwind/site/svg-diagrams.css`.
This is the key best practice — every diagram references the same semantic class
names, so the entire diagram look (and its light/dark behavior) is defined and
tuned in a single place.

### 1. Create and import the file

```css
/* tailwind/site.config.css */
@import "./site/svg-diagrams.css" layer(components);
```

### 2. Define a semantic system, scoped and prefixed

Two rules make this collision-proof:

- **Scope everything under the `.svg-diagram` wrapper** (the class the helper
  adds). This keeps the rules from leaking out to the rest of the page.
- **Prefix every child class `svgd-`.** Generic names like `.title`, `.text`,
  and `.label` are commonly defined elsewhere (e.g. `cards.css`, `blog.css`).
  Scoping alone isn't enough — if a diagram is ever nested inside such a context,
  equal-specificity rules collide and source order wins. The `svgd-` prefix makes
  every diagram class globally unique, so collisions are impossible in either direction.

Use `@apply` on the brand-token Tailwind names that `theme.css` maps in its `@theme inline` block (`bg`, `surface`, `fg`, `fg-muted`, `accent`; see the `site-patterns` skill, `../site-patterns/references/theming.md`), and reach the other brand tokens directly with `fill-(--brand-…)` / `stroke-(--brand-…)`. **Dark mode is automatic** because the tokens are redefined once under `prefers-color-scheme: dark` — no `dark:` variants here and none in the SVG markup.

```css
/* tailwind/site/svg-diagrams.css */
.svg-diagram {
  /* The contained <svg> fills the wrapper; a default fill keeps text legible. */
  svg { @apply block w-full h-auto font-sans fill-fg-muted; }

  /* Surfaces (fill) */
  .svgd-canvas { @apply fill-bg; }                      /* outermost background */
  .svgd-panel  { @apply fill-surface; }                 /* card / panel body */
  .svgd-chrome { @apply fill-(--brand-surface-muted); } /* title bars, toolbars */
  .svgd-inset  { @apply fill-(--brand-surface-muted); } /* sunken areas, plot bg */
  .svgd-dot    { @apply fill-(--brand-border-strong); } /* dots, decorative marks */

  /* Text (fill + size) */
  .svgd-title    { @apply fill-fg text-[12px] font-semibold; }
  .svgd-subtitle { @apply fill-fg-muted text-[9px]; }
  .svgd-text     { @apply fill-fg-muted text-[9px]; }
  .svgd-label    { @apply fill-fg-muted text-[7.5px]; }          /* axis ticks */
  .svgd-value    { @apply fill-fg text-[9.5px] font-bold; }      /* stats */

  /* Lines (stroke) */
  .svgd-gridline { @apply stroke-(--brand-border); }
  .svgd-divider  { @apply stroke-(--brand-border-strong); }
  .svgd-frame    { @apply stroke-(--brand-border-strong) fill-none; } /* outer border */
  .svgd-series   { @apply stroke-fg-muted fill-none; }               /* data series */

  /* Accent (brand) — tracks --brand-accent in light and dark */
  .svgd-accent        { @apply fill-accent; }
  .svgd-series-accent { @apply stroke-accent fill-none; }
}
```

Adapt the class set to your diagrams — the point is a small, named vocabulary
(surfaces, text, lines, accent) that every SVG reuses.

### Why these styling choices

- **`@apply` instead of raw CSS** — `font-size: 12px` becomes `text-[12px]`,
  `font-weight: 600` becomes `font-semibold`, `fill: none` becomes `fill-none`,
  `font-family` becomes `font-sans`. You stay in the Tailwind vocabulary and pick
  up theme tokens automatically.
- **Arbitrary sizes (`text-[12px]`)** — diagram type sizes (7.5/9/12 …) don't map
  to Tailwind's named scale, and the named sizes carry a `line-height` you don't
  want on SVG text. Arbitrary px values keep exact sizing in the viewBox's user units.
- **Accent via the brand accent token** (`fill-accent` → `--brand-accent`) — diagrams follow a rebrand for free.

---

## In the SVG File

```hbs
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" role="img" aria-label="Adoption trends">
  <rect width="600" height="400" class="svgd-canvas"/>
  <text x="30" y="40" class="svgd-title">Adoption Trends</text>
  <line x1="20" y1="380" x2="580" y2="380" stroke-width="1" class="svgd-gridline"/>
  <polyline points="20,360 300,220 580,90" stroke-width="2" class="svgd-series"/>
  <polyline points="20,380 300,300 580,180" stroke-width="2" class="svgd-series-accent"/>
  <text x="560" y="60" text-anchor="end" class="svgd-value svgd-accent">+112%</text>
</svg>
```

- Use only the `svgd-*` classes for color/size — **no per-element `dark:`**; the
  brand tokens handle light/dark.
- Size with `viewBox`, not `width`/`height` attributes. Keep diagrams on a
  consistent working canvas (e.g. ~`0 0 600 400`) so the shared font sizes stay
  proportional across diagrams.
- Add `role="img"` and `aria-label="..."` for accessibility.

---

## Build & Refresh Notes

- The `.svgd-*` classes are emitted because `@apply` pulls them in — they don't
  depend on Tailwind scanning the SVG markup.
- The wrapper `class` you pass (e.g. `max-w-3xl`) **is** scanned from the `.hbs`
  where you call the helper, so those utilities generate normally.
- Editing `svg-diagrams.css` is a Tailwind change: it auto-rebuilds and the browser
  picks up the new stylesheet automatically, without a page reload.
- Editing an SVG **partial** is a partial change: it is picked up live, no restart
  needed (see the dev server rules in SKILL.md).
