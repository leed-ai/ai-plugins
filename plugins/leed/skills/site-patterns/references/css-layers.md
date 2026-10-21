# CSS layers and header height

Details rules 10 and 12 in this skill's `SKILL.md`.

## The layers

Leed declares the order before importing anything (`{appRoot}/static/tailwind/leed.css`):

```css
@layer theme, base, components, utilities;
```

and puts its own components — forms, code blocks, tables, pagination, the documentation styles — in `components`. A site's stylesheets go into the same layers, imported after Leed's, so a site rule beats a Leed rule on ordinary cascade order with no `!important`:

```css
/* tailwind/site.config.css */
@import "tailwindcss" source("../src");

@import "./site/theme.css";                              /* tokens only: :root, @theme */
@import "./site/base.css" layer(base);                   /* element defaults */
@import "./site/components.css" layer(components);
@import "./site/buttons.css" layer(components);
@import "./partials/menu.css" layer(components);
@import "./partials/alerts.css" layer(components);
@import "./layouts/blog.css" layer(components);        /* added by /leed:create blog */

/* Documentation overrides: unlayered on purpose — see below. */
@import "./docs/color-theme-acme.css";
@import "./docs/components.css";

/* The only layered docs file: rules that answer a Leed !important. */
@import "./docs/layered.css" layer(components);
```

Import `theme.css` **unlayered**. It holds only custom properties and `@theme` blocks, but Leed sets some of its own tokens (the alert colors, for example) on `:root` inside `layer(components)`. A layered `theme.css` in `layer(base)` loses to those, and the brand values are silently ignored; unlayered, the site's tokens win. Everything that styles an element is in `base` or `components`.

### Three cascade facts that decide everything

1. **For normal declarations, unlayered rules beat every layered rule, and a later layer beats an earlier one**, whatever the specificity. That is why Leed's documentation styles — in `layer(components)` — can be overridden at all from a site file: put the override outside any layer.
2. **Within one layer, specificity is compared first and source order only breaks ties.** A rule in the same layer wins by being more specific, or by being equally specific and coming later — either is enough.
3. **`!important` reverses layer order**: an `!important` in an earlier layer beats one in a later layer, and unlayered `!important` ranks lowest of all. A Leed rule that writes `!important` inside `layer(components)` therefore cannot be beaten from outside a layer at any specificity. Answer it with `!important` of your own inside `layer(components)` (then fact 2 applies: out-specify it, or match its specificity and come later), or in an earlier layer such as `layer(base)`.

### Documentation overrides: unlayered, scoped under `.leed-documentation`

The documentation shell puts `leed-documentation` on `<html>`. Scope every docs override under it, so a rule meant for the docs cannot leak onto marketing pages:

```css
/* tailwind/docs/components.css — imported with no layer() */
.leed-documentation #leed-toc .leed-nav-toc a { border-left-color: transparent; }
```

### Use a layer only where Leed writes `!important`

Keep one small file, imported into `layer(components)`, for the handful of rules that answer an `!important` Leed wrote. A rule belongs there only when you have found the `!important` in Leed's CSS (`{appRoot}/static/tailwind/`); say which one in a comment beside it.

```css
/* tailwind/docs/layered.css — imported into layer(components).
   Leed writes `color: var(--component-text-color) !important` on these. */
.leed-documentation #leed-toc .leed-nav-toc a { color: var(--brand-fg-muted) !important; }
```

Outside that file, `!important` is only for beating an inline `style` attribute a library writes and no selector can reach (Mermaid writes a few onto its SVGs), with a comment naming it.

### Alerts: no `!important`, no `color-mix()`

An alert stylesheet in `layer(components)` imported after Leed's wins on order. It sets Leed's `--alert-<type>-*` tokens to brand tokens (see `references/theming.md`) and restyles structure only where the brand needs it. `!important` is never needed there, and `color-mix()` must not be used for alert grounds: its compiled fallback is a solid color.

### Delete what nothing reads

When a template or component goes, its rules and tokens go in the same change. A selector that matches nothing and a token nothing reads are both silent, and both make the next override harder to reason about.

### `@utility` cannot be nested

An `@utility` must sit at the top level of a file, so a file holding one cannot be imported into a layer. Docs color themes (`@utility color-theme-<name>`) are imported unlayered for that reason.

## Header height

Two variables, two jobs. Do not merge them.

| Variable | Who writes it | What it is |
|---|---|---|
| `--height-header` | A script that **measures** the rendered header, at runtime | The header's real height. What layouts read |
| `--site-header-height` | The site author, once, in `theme.css` | A fallback, used only while `--height-header` is unset |
| `--height-toc` | Leed's documentation script | The docs mini bar's height on small screens |

### What layouts read

The site template offsets its body by the measured height, exactly as Leed's documentation shell does (`{appRoot}/static/site/_includes/leed/docs/shell.hbs`):

```hbs
<div class="grow mt-(--height-header)">
{{> @partial-block}}
</div>
```

Leed already ships the anchor offset on `html`, in `{appRoot}/static/tailwind/defaults.css`:

```css
scroll-padding-top: calc(var(--height-header, var(--site-header-height, 0px)) + var(--height-toc, 0px));
```

A site does not need to repeat it. If a site writes its own `scroll-padding-top`, it uses that same expression; a bare `calc(var(--height-header) + var(--height-toc))` is invalid wherever either is unset, and the whole declaration is dropped.

### Who measures

- **On documentation pages** Leed's documentation script measures `#docs-header-wrapper` and publishes `--height-header` (and `--height-toc`), and recalculates on resize.
- **On every other page** nothing measures unless the site does. A site with a fixed header measures it itself — a `ResizeObserver` on the header element, writing its `getBoundingClientRect().height`:

```js
const header = document.querySelector("#menu-container");
const publish = () =>
  document.documentElement.style.setProperty("--height-header", `${Math.round(header.getBoundingClientRect().height)}px`);
new ResizeObserver(publish).observe(header);
publish();
```

Do not run it on documentation pages, where Leed's script already owns the variable; two writers fight. A header partial shared with the docs (through `docs-header.hbs`) can take a flag from the docs side and skip its own measuring there.

Until it runs, `mt-(--height-header)` resolves to no margin, so a fixed header with no measuring script covers the top of the page. `--site-header-height` does not fill that gap — it feeds only `scroll-padding-top`.

Set `--site-header-height` to the header's resting height so anchors land correctly before the script runs, and on pages that never load one:

```css
:root { --site-header-height: 68px; }
```

### Never set `--height-header` by hand

"By hand" means any value that is not a measurement: a literal in CSS (`--height-header: 73px`, in `:root` or `@theme`), a constant in a script, or a value reconstructed from padding and logo sizes. Each one drifts from the real header the first time the header changes, and the page content slides under it or floats below it.

A literal in `@theme` is worse: Tailwind mints an `h-header` utility from it.

### Never size the header from it

`--height-header` is an output of measuring the header, never an input to it. A header wrapper given `h-header`, `h-(--height-header)` or `height: var(--height-header)` is sized from the value its own measurement writes: measure, resize, re-measure. With a `transition` on the header the height animates towards each new value and the measurement samples it mid-flight, so it settles at a different wrong height on every load. Let the header take its content's height.

### Anti-examples

- `x-effect="document.documentElement.style.setProperty('--height-header', headerHeight + 'px')"` where `headerHeight` is a number the component computed rather than measured.
- `<div class="grow pt-17">` — a hard-coded offset that is right for one header height only.
- `@theme { --height-header: 6rem; }`, and `<div class="fixed h-header">` on the header wrapper.
