# Styling & Interactivity Reference

## Tailwind CSS v4.1.18

The site-management build compiles Tailwind CSS automatically when `tailwind/site.config.css` exists.

**ALL custom CSS should go in the `tailwind/` directory** and be imported through `site.config.css`. The build system tree-shakes Tailwind CSS to only include classes and styles actually used in the generated site. This means the output CSS is fully optimized — unused styles are automatically removed. Do NOT create separate CSS files in `src/static/` — put everything through Tailwind for optimal performance.

### Entry Point Setup

```css
/* tailwind/site.config.css */
@import "tailwindcss" source("../src");

/* Tokens only — brand tokens, the --site-* contract, @theme. See site-patterns rule 9 */
@import "./site/theme.css";

/* Base layer — resets, typography */
@import "./site/base.css" layer(base);

/* Components layer — reusable patterns */
@import "./site/icons.css" layer(components);
@import "./site/images.css" layer(components);
@import "./site/components.css" layer(components);
@import "./site/buttons.css" layer(components);

/* Layout-specific styles; /leed:create blog adds the blog.css line */
@import "./layouts/blog.css" layer(components);
@import "./layouts/centered.css" layer(components);

/* Partial component styles */
@import "./partials/cards.css" layer(components);
@import "./partials/menu.css" layer(components);
@import "./partials/forms.css" layer(components);
```

### Key Points

- **Tailwind v4 syntax** — uses `@import "tailwindcss"` (not `@tailwind` directives)
- **Source directive** — `source("../src")` tells Tailwind to scan all `.hbs` files for class usage
- **Cascade layers** — use `layer(base)` and `layer(components)`. This is not
  cosmetic: Leed's own CSS is in `layer(components)`, so a site file imported
  into the same layer overrides it on ordinary cascade rules with no
  `!important`. A file imported with no layer at all outranks every layered
  rule regardless of specificity, which is usually not what you want. See
  `css-conventions.md`.
- **Brand tokens** for theming (see below, and site-patterns rule 9)
- All `.hbs` files in `src/` are automatically scanned for Tailwind classes

### Provided Fonts (Auto-Installed on Build)

The build system automatically detects font usage in compiled CSS and downloads/installs the font files into `static/webfonts/`. You do NOT need to manually download fonts.

**Available fonts:**

| Tailwind Class        | CSS Variable            | Font Family    |
| --------------------- | ----------------------- | -------------- |
| `font-noto-sans`      | `--font-noto-sans`      | Noto Sans      |
| `font-open-sans`      | `--font-open-sans`      | Open Sans      |
| `font-inter`          | `--font-inter`          | Inter          |
| `font-jetbrains-mono` | `--font-jetbrains-mono` | JetBrains Mono |
| `font-geist`          | `--font-geist`          | Geist          |
| `font-geist-mono`     | `--font-geist-mono`     | Geist Mono     |

**How it works:**
1. Use a font class in your template: `<body class="font-noto-sans">`
2. Or reference the CSS variable: `font-family: var(--font-noto-sans)`
3. The build detects `--font-*` references in the compiled CSS
4. Font WOFF2 files are automatically downloaded and installed to `static/webfonts/{font-name}/`
5. `@font-face` declarations are included in the built CSS automatically

**You do not need to:**
- Download font files manually
- Create `@font-face` declarations
- Add font CSS imports

Just use the Tailwind class or CSS variable and the build handles everything.

**Font Awesome is not auto-installed.** Every site uses Font Awesome Free 7.3.1 by default, installed once with `leed site init --font-awesome`; a site with its own Pro license installs Pro instead (see the Font Awesome section below).

### CSS Custom Properties (Theme Variables)

**The rules are site-patterns rule 9, detailed in `../site-patterns/references/theming.md`; `css-conventions.md` has the variable chain.** The short version:

Leed components read `--component-X`, which resolves `var(--docs-X, var(--site-X, var(--default-X)))`. A site sets `--site-*` — and sets each one to a **brand token**, never to a color value. Color values live once, in a brand block in `tailwind/site/theme.css`, and dark mode redefines the same brand names:

```css
/* tailwind/site/theme.css */
:root {
  --brand-bg: #fafaf6;
  --brand-fg: #111111;
  --brand-accent: #d4a017;
  --brand-border: rgba(17, 17, 17, 0.12);
}

@media (prefers-color-scheme: dark) {
  :root {
    --brand-bg: #14110d;
    --brand-fg: #fafaf6;
    --brand-border: rgba(250, 250, 246, 0.12);
  }
}

:root {
  --site-bg-color: var(--brand-bg);
  --site-text-color: var(--brand-fg);
  --site-primary-color: var(--brand-accent);
  --site-border-color: var(--brand-border);
  /* … every other --site-* name … */

  /* Not a color: the fallback height of a fixed header. */
  --site-header-height: 68px;
}
```

Use in Tailwind classes: `text-(--site-text-color)`, `bg-(--site-primary-color)`, `border-(--site-border-color)` (for a tinted ground, a muted token rather than an opacity modifier; see **Light / Dark Mode** below) — or map the brand tokens to Tailwind names with `@theme inline` (names that differ from the source names) and write `bg-bg`, `text-fg`.

**Every `--site-*` variable, with its light and dark default, is listed in `tailwind/site-tokens.reference.css` in the installed package.** Set every one; an unset name falls back to Leed's default color. A name that is not in that file is not read by anything — define your own tokens for your own CSS under your own names, but a Leed component will not pick them up.

### Header height

`--height-header` is the header's height, **measured at runtime** — by Leed's documentation script on docs pages, and by the site's own header script elsewhere. Layouts read it. `--site-header-height` is the fallback the author sets. The two strings every site uses, exactly:

```hbs
<div class="grow mt-(--height-header)">
```

```css
scroll-padding-top: calc(var(--height-header, var(--site-header-height, 0px)) + var(--height-toc, 0px));
```

Leed's `defaults.css` already applies the `scroll-padding-top` rule to `html`. Never set `--height-header` by hand — no literal, no constant, no value computed from paddings — and never size the header from it. See site-patterns rule 12 and `../site-patterns/references/css-layers.md`.

### Responsive Design (MANDATORY)

All templates must be fully responsive using Tailwind's breakpoint prefixes. Design mobile-first — base styles are for the smallest screens, then add breakpoint overrides for larger screens.

**Breakpoints (Tailwind v4 defaults):**

| Prefix | Min Width | Target                       |
| ------ | --------- | ---------------------------- |
| (none) | 0px       | Mobile (base)                |
| `sm:`  | 640px     | Large phones / small tablets |
| `md:`  | 768px     | Tablets                      |
| `lg:`  | 1024px    | Desktops                     |
| `xl:`  | 1280px    | Large desktops               |
| `2xl:` | 1536px    | Extra-large screens          |

```hbs
{{!-- Mobile: 1 col, tablet: 2 cols, desktop: 3 cols --}}
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

{{!-- Mobile: stacked, desktop: side by side --}}
<div class="flex flex-col lg:flex-row gap-8">

{{!-- Hide on mobile, show on desktop --}}
<nav class="hidden lg:block">

{{!-- Different padding per breakpoint --}}
<section class="px-4 sm:px-6 lg:px-8">
```

### Light / Dark Mode (MANDATORY)

The Leed build system automatically supports light and dark mode via Tailwind's `dark:` variant and CSS custom properties. All templates MUST work in both modes.

**Read brand tokens** — they are redefined under `prefers-color-scheme: dark`, so a template that reads them adapts with no `dark:` variant:
```hbs
<div class="text-(--site-text-color) bg-(--site-bg-color) border-(--site-border-color)">
<div class="bg-surface text-fg-muted border-(--site-border-color)">   {{!-- Tailwind names mapped with @theme inline --}}
```

**Tint with a muted token, not an opacity modifier.** `bg-(--site-primary-color)/10` compiles to `color-mix()`, and Tailwind's `@supports` fallback for it is the solid color, so in a browser without `color-mix` the tinted ground becomes the full accent and its text disappears. Define a muted brand token for the ground and read that:
```hbs
<div class="bg-(--brand-accent-muted) text-(--brand-accent)">
```
See `../site-patterns/references/theming.md` for where the muted tokens are defined.

**Never write a palette color in a template** (`bg-white`, `text-slate-600`, a hex value). It is correct in one mode only, and a `dark:` pair beside it is a second copy of a decision the brand block already made. Always verify both light and dark appearances. See site-patterns rule 9.

### HTML Tag: Font & Code Theme

The `<html>` tag in your site template is where you set the **site-wide font** and **code syntax highlighting theme**. These are applied as CSS classes:

```hbs
<html lang="en" class="scroll-smooth js-focus-visible code-theme-atom-fruit font-noto-sans">
```

- **Font class** — sets the font family for all content (e.g., `font-noto-sans`, `font-inter`, `font-open-sans`)
- **Code theme class** — sets the highlight.js theme for all code blocks (e.g., `code-theme-atom-fruit`)

**Available code highlighting themes (14):**

| Theme Class                 | Style                           |
| --------------------------- | ------------------------------- |
| `code-theme-a11y`           | Accessible contrast             |
| `code-theme-atom-fruit`     | Atom-inspired with fruit colors |
| `code-theme-atom-one`       | Atom One theme                  |
| `code-theme-default`        | Default highlight.js            |
| `code-theme-github`         | GitHub style                    |
| `code-theme-google-code`    | Google Code style               |
| `code-theme-grayscale`      | Monochrome grayscale            |
| `code-theme-gruvbox-hard`   | Gruvbox hard contrast           |
| `code-theme-gruvbox-medium` | Gruvbox medium contrast         |
| `code-theme-gruvbox-soft`   | Gruvbox soft contrast           |
| `code-theme-papercolor`     | PaperColor theme                |
| `code-theme-qt-creator`     | Qt Creator style                |
| `code-theme-summerfruit`    | Summer Fruit colors             |
| `code-theme-tomorrow`       | Tomorrow theme                  |

All themes automatically support light and dark mode.

### Common Tailwind Patterns

**Text truncation:**
```hbs
<p class="line-clamp-2">Long text...</p>
```

**Group hover effects:**
```hbs
<a class="group">
  <h3 class="group-hover:text-primary transition-colors">Title</h3>
</a>
```

### Inline SVG Diagrams (centralized, theme-aware)

For hand-built SVG charts, diagrams, and illustrations, use the `svgDiagram`
helper together with a single Tailwind file that defines the whole diagram look.

- Put all diagram styling in `tailwind/site/svg-diagrams.css`, imported under
  `layer(components)`. Scope rules under the `.svg-diagram` wrapper and prefix
  child classes `svgd-` so they never collide with other CSS (e.g. `.title`).
- Define styling with `@apply` on the brand-token Tailwind names (`fill-surface`, `fill-fg-muted`, `stroke-(--brand-border)`, `fill-accent`). Dark mode comes from the tokens themselves, redefined once in `theme.css` — no `dark:` variants in the CSS or the SVG markup.
- Reference SVGs with `{{ svgDiagram "svg/charts/name" class="..." }}`; the files
  live in `src/_includes/svg/` organized like an images directory.

**See `references/svg-diagrams.md` for the complete pattern and worked examples.**

---

## Font Awesome

Every Leed site gets **Font Awesome Free 7.3.1** by default. A site whose owner holds a Font Awesome **Pro** license installs their own Pro fonts, and then every Pro family is available. Leed supplies the Tailwind CSS for whichever edition and version is installed, so either way you only write classes.

### Installing the fonts

The build installs no fonts and downloads nothing. Fonts reach `src/static/webfonts/` only through `leed site init`, run in the site's checkout:

```bash
leed site init --font-awesome                       # Free — only when no Font Awesome fonts are installed
leed site init --font-awesome-pro ~/Downloads/fontawesome-pro-7.3.1-web.zip   # the customer's own Pro web package
```

- `--font-awesome` never overwrites anything: if `src/static/webfonts/` already holds `fa-*.woff2` files or an `fa-version.txt`, it does nothing and says so.
- `--font-awesome-pro <zip>` reads the edition and version from the zip itself, installs Pro 7.0.0 or 7.3.1, and upgrades in place when run again with a newer zip. Pro+ zips install as Pro. A Free zip, or a version the CLI has no CSS for, is refused with the supported list.
- Both write `src/static/webfonts/fa-version.txt` (`free 7.3.1` or `pro 7.3.1`). The build reads it to pick the stylesheet. A bare version such as `7.3.1`, which older sites have, means Pro. With no file the build uses Free, so a site with no fonts still builds — its icons just render empty until the fonts are installed.
- The Leed CI build runs `leed site init --font-awesome` before every published build, so a site that has committed no Font Awesome is published with Free even if nobody installed it locally. Install and commit the fonts anyway, so local previews show the icons too.

Never copy Pro font files into a site yourself, and never install Pro without the site owner's own licensed zip.

### Using icons

Write icon classes with a full style prefix. On a Free site the styles are `fa-solid`, `fa-regular` (a few hundred icons only) and `fa-brands`:

```hbs
<i class="fa-solid fa-check"></i>                 {{!-- Solid: every Free icon has it --}}
<i class="fa-regular fa-star"></i>                {{!-- Regular: only icons Free draws in regular --}}
<i class="fa-brands fa-github"></i>               {{!-- Brand icons --}}
<i class="fa-solid fa-arrow-right fa-fw"></i>     {{!-- Fixed width --}}
```

**Check the style exists in Free.** Free declares a class for every icon whatever its style, so a magnifying glass written with `fa-regular` compiles and draws nothing — Free has no regular magnifying glass. Use `fa-solid` unless you know the icon has a Free regular form (e.g. `star`, `heart`, `clock`, `copy`, `circle`, `envelope`). The CLI's `static/tailwind/font-awesome/free-7.3.1/icons.json` lists the styles Free has for each icon.

**IMPORTANT: Always use full style prefixes.** Do NOT use shorthand aliases like `fas`, `far`, `fab`. Always use the full form: `fa-solid`, `fa-regular`, `fa-brands`.

Size modifiers: `fa-xs`, `fa-sm`, `fa-lg`, `fa-xl`, `fa-2xl`, `fa-2x` through `fa-10x`. Animation: `fa-spin`, `fa-beat`, `fa-fade`, `fa-bounce`, `fa-shake`.

<!-- font-awesome-pro-example -->
**Only on a site with Pro installed** (`fa-version.txt` says `pro …`) are the Pro styles and families available — `fa-light`, `fa-thin`, `fa-semibold`, `fa-duotone`, `fa-sharp`, `fa-sharp-duotone` and the rest:

```hbs
<i class="fa-light fa-arrow-right"></i>
<i class="fa-duotone fa-solid fa-rocket"></i>
<i class="fa-sharp fa-regular fa-star"></i>
```

Never use them on a Free site, and never in anything meant for more than one site: on Free they render nothing, and an `@apply` of one fails the build.
<!-- /font-awesome-pro-example -->

### Leed's own icons

Every icon Leed's components draw — the menu button, search, close, chevrons, arrows, the copy button, alert icons, the loading spinner — goes through a named utility, `leed-icon-<role>`, that sets the glyph from `--site-icon-<role>`, falling back to `--default-icon-<role>`, like the color tokens. Change any of them from CSS, without touching a template:

```css
:root {
  --site-icon-menu: "\f0c9";   /* the glyph's codepoint, as Font Awesome lists it */
  --site-icon-search: "\f002";
}
```

The roles are `menu`, `close`, `search`, `chevron-right`, `chevron-left`, `chevron-down`, `caret-right`, `arrow-left`, `arrow-right`, `arrow-right-long`, `external`, `external-square`, `ellipsis`, `hashtag`, `clock`, `copy`, `check`, `list`, `home`, `sort`, `spinner`, `panel-toggle` and the alert icons `alert-note`, `alert-tip`, `alert-info`, `alert-warning`, `alert-danger`; their defaults are in the CLI's `static/tailwind/defaults.css`. Use them in your own templates too, e.g. `<i class="fa-solid leed-icon-menu"></i>`. An override changes the glyph only; the style class stays on the component.

---

## Alpine.js 3.15.0

Alpine.js is pre-loaded on every page for lightweight interactivity.

### Common Patterns

**Component state:**
```hbs
<div x-data="{ open: false, count: 0 }">
  <button @click="open = !open">Toggle</button>
  <div x-show="open" x-transition>
    Content shown/hidden
  </div>
</div>
```

**Tab selection:**
```hbs
<div x-data="{ selection: 1 }">
  <button @click="selection = 1" :class="selection === 1 && 'active'">Tab 1</button>
  <button @click="selection = 2" :class="selection === 2 && 'active'">Tab 2</button>
  <div x-show="selection === 1">Panel 1</div>
  <div x-show="selection === 2">Panel 2</div>
</div>
```

**Modal dialog:**
```hbs
<div x-data="{ showModal: false }">
  <button @click="showModal = true">Open</button>
  <div x-show="showModal" @click.self="showModal = false"
       @keydown.escape.window="showModal = false"
       class="fixed inset-0 z-50 bg-black/50">
    <div class="modal-content">
      <button @click="showModal = false">Close</button>
    </div>
  </div>
</div>
```

**Scroll-reactive header (from reference site):**
```hbs
<header x-data="headerComponent({ scrollBarId: '{{ scrollBarId }}' })"
        @scroll.window.debounce.50ms="updateScrollState();"
        @resize.window.debounce.50ms="handleResize();">
  <nav :class="{ 'pt-4 pb-4': !shrink, 'pt-2 pb-2': shrink }">
    ...
  </nav>
</header>
```

### Alpine.js Directives Available

| Directive          | Purpose                                |
| ------------------ | -------------------------------------- |
| `x-data`           | Component state                        |
| `x-show`           | Toggle visibility                      |
| `x-if`             | Conditional render (with `<template>`) |
| `x-for`            | Loop rendering (with `<template>`)     |
| `x-text`           | Set text content                       |
| `x-html`           | Set HTML content                       |
| `x-bind` / `:attr` | Dynamic attributes                     |
| `x-on` / `@event`  | Event listeners                        |
| `x-model`          | Two-way binding                        |
| `x-transition`     | CSS transitions                        |
| `x-effect`         | Reactive side effects                  |
| `x-init`           | Run code on init                       |
| `x-cloak`          | Hide until Alpine loads                |

### Registering Alpine Components

For reusable components, register in a JS file:

```js
document.addEventListener("alpine:init", () => {
  Alpine.data("componentName", (params = {}) => ({
    // reactive state
    open: false,
    // methods
    toggle() { this.open = !this.open; },
    // lifecycle
    init() { /* runs on mount */ },
  }));
});
```

---

## JavaScript Modules

Custom JS files go in `src/static/js/`. Use ES module imports:

```js
// main.js — entry point
import { initMobileNav } from './modules/mobile-nav.js';
import { initDropdown } from './modules/dropdown.js';

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initDropdown();
});
```

**Loading:** Scripts in `src/static/js/` are NOT auto-loaded. Reference them in your site-template partial:

```hbs
<script type="module" src="/static/js/main.js"></script>
```
