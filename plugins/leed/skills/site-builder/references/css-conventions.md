# CSS Conventions — layers, tokens, and how overriding works

How Leed's own CSS is organized, which variables a site is meant to set, and
why an override sometimes appears to be ignored.

Read this before writing a rule that fights a Leed component.

## The cascade layers

Everything Leed ships is imported into a layer, and the layer order is declared
before anything is imported:

```css
@layer theme, base, components, utilities;
```

| Layer | What is in it |
|---|---|
| `theme` | Tailwind's own theme values |
| `base` | Resets, element defaults, `scroll-padding` |
| `components` | Every Leed component: forms, code blocks, tables, pagination, docs |
| `utilities` | Tailwind utilities and Leed's `@utility` declarations |

A site's own CSS goes into the same layers, imported after Leed's:

```css
@import "./site/base.css" layer(base);
@import "./site/components.css" layer(components);
```

Because both sides are in `components`, a site rule that **matches or exceeds the specificity** of Leed's selector wins by coming later — no `!important` needed. Within one layer specificity is compared first, so copy the chain from Leed's selector rather than writing a shorter one (see `../site-patterns/references/css-layers.md`).

### Why an override can look ignored

Two rules, in this order:

1. **An unlayered rule beats every layered rule**, regardless of specificity. A
   three-class selector inside `layer(components)` loses to a one-class
   selector outside any layer. If a site imports a stylesheet *without*
   `layer(...)`, that stylesheet outranks everything in a layer — including
   rules the author meant it to cooperate with.
2. **`!important` inverts layer order.** An `!important` declaration in an
   earlier layer beats an `!important` declaration in a later one. Reaching for
   `!important` to win a layer fight usually starts an arms race.

So: put site CSS in a layer, and reserve unlayered files for the rare case where you genuinely need to outrank a layer — overriding Leed's documentation styles (scoped under `.leed-documentation`), or the typography plugin's `.prose` values, which the plugin defines in a layer of its own. The one exception runs the other way: a rule answering an `!important` Leed wrote must sit *inside* `layer(components)`, in one small file kept for that. See site-patterns rule 10, `../site-patterns/references/css-layers.md`.

### `@utility` cannot be nested

Tailwind's `@utility` must sit at the top level of a file. A stylesheet
containing one cannot be imported into a layer. Keep `@utility` declarations in
a dedicated file (`utils/utilities.css` in Leed's tree) and the rules that use
them in the layered component file.

## The theme variables

Three names exist for every themeable value, and only one of them is yours.

```css
--component-X: var(--docs-X, var(--site-X, var(--default-X)))
```

| Prefix | Who sets it | Who reads it |
|---|---|---|
| `--component-*` | Nobody | Every Leed component |
| `--docs-*` | A documentation theme | The chain, first |
| `--site-*` | **A site — this is your surface** | The chain, second |
| `--default-*` | Leed | The chain, last |

**Set `--site-*` and nothing else.** Setting a `--component-*` value directly
appears to work and is overwritten the moment the chain is re-evaluated in
another context; setting `--default-*` is worse, because it changes the floor
for components you were not thinking about.

The full list of `--site-*` variables, with their light and dark defaults, is generated into `tailwind/site-tokens.reference.css` in the installed package. It is a reference, not an import: copy its names into your own `:root` and set **every one**, because an unset name falls back to Leed's default color.

Set each `--site-*` to a **brand token**, never to a color value. The values live once, in a brand block on `:root` in `tailwind/site/theme.css`, and dark mode redefines the same brand names — so the `--site-*` mapping is written once and needs no dark copy:

```css
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
  --site-primary-color: var(--brand-accent);
  --site-text-color: var(--brand-fg);
  --site-bg-color: var(--brand-bg);
  --site-border-color: var(--brand-border);
}
```

The full architecture — the `--form-*`, alert, docs and Mermaid tokens, and the `@theme inline` naming trap — is site-patterns rule 9, `../site-patterns/references/theming.md`.

A variable Leed does not read does nothing. If a value is not in
`site-tokens.reference.css`, no Leed component consumes it — define your own
tokens under a name of your choosing for your own CSS, but do not expect a Leed
component to pick them up.

### Header height: one variable that is not a color

```css
:root { --site-header-height: 68px; }
```

`--site-header-height` is the fallback the author sets: the header's resting height, used while nothing has measured the header. `--height-header` is the header's real height, **measured at runtime** — by Leed's documentation script on docs pages, and by the site's own header script elsewhere — and it is what layouts read. The two strings every site uses, exactly:

```hbs
<div class="grow mt-(--height-header)">
```

```css
scroll-padding-top: calc(var(--height-header, var(--site-header-height, 0px)) + var(--height-toc, 0px));
```

Leed's `defaults.css` already applies that `scroll-padding-top` to `html`, in `layer(base)`. Never set `--height-header` by hand (a literal, a constant, a value computed from paddings), and never size the header from it — a header sized from its own measurement loops. See site-patterns rule 12, `../site-patterns/references/css-layers.md`.

## Class naming

| Pattern | Belongs to |
|---|---|
| `leed-*` | Runtime-generated markup — forms in particular |
| `code-*`, `pagination-*`, `table-*` … | Site-level components |
| `docs-*`, and anything under `#documentation` | The documentation layout |

`pagination-*` is the site's numbered pager; `docs-pagination__*` is the
previous/next pager on a documentation page. They are different components and
their stylesheets say so at the top of each file.

Site CSS should not reuse a Leed class name for a different purpose. Prefix your
own components (`.acme-card`, `.acme-hero`) or use names Leed does not ship.

## Component hooks

Some components expose a variable rather than expecting you to fight a rule:

| Variable | Component | What it does |
|---|---|---|
| `--code-copy-clearance` | Code block | Top padding reserved for the copy button. Set `0` if you place the button yourself. |
| `--code-copy-anchor` | Code block | `static` hands the button's positioning context to your own chrome. |

Prefer a hook over an override. If a component needs one and has none, that is
worth raising — a variable is a supported seam, an `!important` is not.

### Turning off the documentation nav filter

The documentation left navigation ships with a filter box above the menu. It is
on by default and there is no config field for it; a site turns it off with one
rule:

```css
#docs-nav-filter { display: none; }
```

No `!important`, and it works whether your stylesheet is imported into
`layer(components)` or unlayered. Leed's own `#docs-nav-filter` rule is written
at the top level of its stylesheet and declares no `display` of its own, which is
what keeps a one-id site rule able to win. The menu itself is unaffected — the
filter clears itself the moment the box stops being visible, so hiding it at one
breakpoint cannot strand the navigation in a filtered state.

One correction goes with it on the `alpha` and `bravo` layouts. Those two give
the mobile drawer no top padding of its own, because the filter box supplies
that 1rem itself while it is there. Hide the box and the first menu row sits
against the drawer's top edge, so put the padding back:

```css
/* alpha */
.docs-layout-alpha .docs-sidebar #docs-navigation { @apply md:pt-4; }

/* bravo */
.docs-layout-bravo .docs-sidebar #docs-navigation { @apply pt-4 lg:pt-0; }
```

`charlie` needs nothing — its drawer keeps its own padding at every width.

## Checklist

- [ ] Site CSS imported with `layer(base)` / `layer(components)`
- [ ] No `!important` used to beat a Leed component — if it seems necessary, check the layer first
- [ ] Every `--site-*` in `site-tokens.reference.css` set, each to a brand token — no color values outside the brand block
- [ ] Dark mode redefines the brand tokens; a brand token never gets its only definition inside the media query
- [ ] `--site-header-height` set if the site has a fixed header; `--height-header` only ever written by a script that measures the header
- [ ] Own components use own class names
