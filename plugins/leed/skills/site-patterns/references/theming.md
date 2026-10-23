# Theming

Details rule 9 in this skill's `SKILL.md`: brand tokens are defined once, every Leed token points at one, and dark mode is the same names redefined.

## The architecture

Three layers, all in `tailwind/site/theme.css`, in this order.

1. **Brand tokens** — the only place a color value is written. The complete light palette on `:root`, then the same names redefined in one `@media (prefers-color-scheme: dark)` block. A color never gets its only definition inside the media query.
2. **Leed's contract** — every `--site-*` (and the bare `--form-*` and reading-progress tokens) set to a brand token. Leed's components read these, so this is what puts the search modal, code blocks, forms and pagination in the brand instead of Leed's blue defaults.
3. **Tailwind names** — `@theme inline` maps the brand tokens onto Tailwind color names, so templates can write `bg-surface` and `text-fg-muted`.

Because layers 2 and 3 only point at layer 1, dark mode needs nothing beyond layer 1's media query: every component follows.

```css
/* tailwind/site/theme.css */

/* 1. Brand tokens: values live here and nowhere else. */
:root {
  --brand-bg: #fafaf6;
  --brand-surface: #ffffff;
  --brand-surface-muted: #f2f1eb;
  --brand-fg: #111111;
  --brand-fg-muted: #5f5d57;
  --brand-border: rgba(17, 17, 17, 0.12);
  --brand-border-strong: rgba(17, 17, 17, 0.24);
  --brand-accent: #d4a017;
  --brand-accent-hover: #b88912;
  --brand-accent-muted: #f5e7b8;
}

@media (prefers-color-scheme: dark) {
  :root {
    --brand-bg: #14110d;
    --brand-surface: #1c1813;
    --brand-surface-muted: #221d17;
    --brand-fg: #fafaf6;
    --brand-fg-muted: #a09c90;
    --brand-border: rgba(250, 250, 246, 0.12);
    --brand-border-strong: rgba(250, 250, 246, 0.24);
    --brand-accent: #d4a017;
    --brand-accent-hover: #e0ac1e;
    --brand-accent-muted: #3d2e0a;
  }
}

/* 2. Leed's contract: every name, each pointing at a brand token. */
:root {
  --site-bg-color: var(--brand-bg);
  --site-text-color: var(--brand-fg);
  --site-border-color: var(--brand-border);
  --site-primary-color: var(--brand-accent);
  --site-primary-color-hover: var(--brand-accent-hover);
  --site-primary-light: var(--brand-accent-muted);
  --site-anchor-text-color: var(--brand-accent);
  /* … every other name in site-tokens.reference.css … */

  --form-border-color: var(--brand-border);
  --form-border-color-hover: var(--brand-border-strong);
  --form-download-spinner-text: var(--brand-accent);

  --scroll-status-indicator-horizontal-start-bg: transparent;
  --scroll-status-indicator-horizontal-partial-bg: var(--brand-accent);
  --scroll-status-indicator-horizontal-complete-bg: var(--brand-accent-hover);

  --site-header-height: 68px;   /* not a color: the fallback header height, see css-layers.md */
}

/* 3. Tailwind names. DIFFERENT from the source names — see the trap below. */
@theme inline {
  --color-bg: var(--brand-bg);
  --color-surface: var(--brand-surface);
  --color-fg: var(--brand-fg);
  --color-fg-muted: var(--brand-fg-muted);
  --color-accent: var(--brand-accent);
}
```

Use a prefix that is the brand's own (`--acme-*`), not `--site-*`: `--site-*` is Leed's contract, and a site token under that prefix that Leed does not read is a name nobody will find.

## Leave no `--site-*` unset

Every `--site-*` name, with Leed's light and dark default, is listed in `{appRoot}/static/tailwind/site-tokens.reference.css`. Set every one. An unset name does not inherit the brand; it falls back to Leed's default — usually a Leed blue or slate — and that component is the one off-brand thing on the page, often only in dark mode. The file is a reference, not an import: copy its names into layer 2.

A name that is not in that file is read by nothing Leed ships. Setting `--primary-color` or `--site-brand` does nothing for a Leed component.

## No hex values anywhere else

Color values (`#…`, `rgb()`, a Tailwind palette class like `bg-white` or `text-slate-600`) appear only in the brand block. Everything else — components, buttons, menus, alerts, docs overrides, layouts — reads a brand token (`var(--brand-fg)`) or a Tailwind name mapped to one (`text-fg`). A `dark:` variant is then almost never needed: the token already changed.

The one place literals are unavoidable is `src/static/js/mermaid.theme.json` (below). It holds the same values as the brand block, in `light` and `dark` keys.

## The `@theme inline` trap: names must differ

```css
/* WRONG */
:root     { --color-bg: #fafaf6; }
@theme inline { --color-bg: var(--color-bg); }   /* a custom property that refers to itself */
```

`--color-bg: var(--color-bg)` is a cyclic custom property, which is invalid at computed-value time. Nothing errors; every rule that reads it silently gets its initial value, and the usual symptom is dark mode that half works — cards stay white. Source tokens and Tailwind names must be different names (`--brand-bg` → `--color-bg`).

Constants that never change with the theme (a font, a fixed brand color used for a logo) go in a plain `@theme` block, not `@theme inline`.

## Documentation: `@utility color-theme-<name>`

A documentation set's color theme is chosen in its CMS configuration. A site theme for it is an `@utility` named after that theme, setting `--docs-*` names to brand tokens.

**Name a site theme for the company: `color-theme-<shortCompanyName>`**, for example `color-theme-row64` for Row64. Take the company's name from `leed settings company get --json`, lowercase it, drop everything outside `[a-z0-9]` and cut it to 32 characters, the most the CMS accepts after the prefix. Read the page type's `documentationConfiguration.colorTheme` first (`src/<slug>/<slug>.11tydata.json`, or `leed settings pagetype get <pageTypeId> --json`): when it already names a custom theme, write the utility under that name rather than choosing another. Never name a site theme after a built-in color (`color-theme-blue`, `color-theme-indigo` and the rest): the class would collide with Leed's own.

```css
/* tailwind/docs/color-theme-acme.css — imported in site.config.css with NO layer() */
@utility color-theme-acme {
  --docs-primary-color: var(--brand-accent);
  --docs-primary-color-hover: var(--brand-accent-hover);
  --docs-bg-color: var(--brand-bg);
  --docs-text-color: var(--brand-fg);
  --docs-border-color: var(--brand-border);
  /* … */
}
```

- **No dark block.** Leed's built-in themes repeat their whole list inside a `prefers-color-scheme` query. A site theme maps onto brand tokens, which already swap, so light and dark are one definition and cannot drift.
- **Unlayered.** An `@utility` cannot be nested in a layer, so its import has no `layer(...)`.
- It looks unused — no template names the class. The class arrives from the documentation configuration; see the build-used files in `references/layouts-and-page-types.md`.

Only `--docs-*` names whose value differs from the `--site-*` one strictly need setting, because components read `var(--docs-X, var(--site-X, var(--default-X)))`. Keeping the list whole is fine, as long as every value is a brand token.

## Alerts

Leed's five alerts (`note`, `tip`, `info`, `warning`, `danger`) read `--alert-<type>-border`, `-bg`, `-text`, `-code-bg` and `-code-border`. Set those on `:root` to brand tokens; the alerts then follow dark mode with no dark block of their own.

- Use a muted brand token for a tinted ground (`--brand-accent-muted`), never `color-mix()`. Tailwind compiles a mix into an `@supports` guard whose fallback is the mix's first color — a solid accent background, unreadable, in any browser without `color-mix`.
- No `!important`. An alert file in `layer(components)` after Leed's wins on order. See `references/css-layers.md`.

## Mermaid

Diagrams take their palette from `src/static/js/mermaid.theme.json`: a `shared` Mermaid config (usually `theme: "base"` plus `themeVariables`), with `light` and `dark` keys merged over it where the schemes differ. Mermaid passes a `var(--brand-*)` through to the SVG for a variable it uses as-is, so put brand tokens in `shared`. But Mermaid derives colors from some variables (`primaryColor` among them) and throws on a `var()` in those — and then no diagram on the page renders. Give those literal values, copied from the brand block, under `light` and `dark`. Leed redraws every diagram when the color scheme changes.

## The browser chrome: `theme-color`

The color a browser gives its own chrome (the mobile title bar) comes from `<meta name="theme-color">`, one per color scheme, in `src/_includes/header-includes.hbs` (rule 14) so that documentation pages get it too. A meta cannot read a CSS variable, so its `content` is the literal value of `--brand-bg` in each mode, copied from the brand block. That pair is the other place a brand color is written out: change `--brand-bg` and change the two metas with it.

## Delete what nothing reads

A token no rule reads, or an override rule for markup the site no longer has, is noise that the next person will be afraid to remove. Delete it in the same change that made it dead.

## Anti-examples

- `:root { --site-primary-color: #6366f1; }` — a hex value in Leed's contract, which then needs its own dark copy.
- `<div class="bg-white dark:bg-slate-900">` — two palette colors where one token would do.
- A `--docs-*` theme with a `@media (prefers-color-scheme: dark)` block repeating its values.
