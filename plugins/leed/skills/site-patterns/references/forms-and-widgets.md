# Forms and widgets

Details rules 2 and 4 in this skill's `SKILL.md`: forms are always `leed/form`, styled from outside; pagination, reading progress and docs search are Leed's components.

## Forms

### Why

A Leed form is a CMS record (`src/_data/leedForms.json`). The partial renders its fields, the Turnstile check, the welcome-back state for a known visitor, the gated-download spinner and the success and error labels, and Leed's client script hooks its submit. A hand-written `<form>` does none of that, and its submissions never reach the CMS.

### The call

```hbs
{{!-- A form chosen by the template --}}
{{> leed/form formId="ne9omfp7" }}

{{!-- The form named in the page's own frontmatter (a landing page an editor sets up in the CMS) --}}
{{> leed/form }}
```

Take the id from `src/_data/leedForms.json`. Create or change a form with `leed settings form ...` (the `/site-settings` skill), never by editing that file.

### Styling from outside

The partial owns the markup; the site dresses it. These are the classes it emits — style only these:

| Class | What it is |
|---|---|
| `leed-form-container` | The outer wrapper, plus `<formPrototype>-container` when the form names a prototype |
| `leed-form-heading` | The heading, when the form has one |
| `leed-form-details` | The details line under the heading |
| `leed-form` | The `<form>` itself, plus `<formPrototype>` when set |
| `leed-form-block` | One per field |
| `leed-form-group-option` | One option in a radio or checkbox group |
| `leed-form-button-label`, `leed-form-button-spinner` | The submit button's state labels |
| `leed-form-spinner` | The download spinner |
| `leed-form-welcome-back` | Shown to a visitor the site already knows |

The full markup is `{appRoot}/static/site/_includes/leed/form.hbs`; Leed's base styles are `{appRoot}/static/tailwind/components/form.css`.

Put the site's form CSS in its own file imported into `layer(components)`, after Leed's. Within one layer specificity is compared first, so an override must match or exceed the specificity of Leed's selector and then wins by coming later. Leed styles text inputs with `.leed-form-container .leed-form input[type="text"]` (0,3,1), so prefix the same chain with the site's own scope class:

```css
/* tailwind/partials/contact-form.css, imported into layer(components) */
.contact .leed-form-container { @apply grid gap-4; }
.contact .leed-form-container .leed-form :is(input[type="text"], input[type="email"], input[type="tel"]) { border-radius: 9px; }
```

Read the selector in `{appRoot}/static/tailwind/components/form.css` before overriding a property, and copy its chain rather than guessing a shorter one.

### The form variables

Forms read the `--site-*` colors like every other component, and three bare `--form-*` variables as well. **Two of them are read with no fallback** — `--form-border-color` on the submit button's border, and `--form-download-spinner-text` on the download spinner — so an unset one is not "Leed's default": the button border falls back to `currentColor` and the spinner inherits the text color. (Field borders go through `--component-form-border-color`, which has a fallback.) Set all three:

```css
:root {
  --form-border-color: var(--brand-border);
  --form-border-color-hover: var(--brand-border-strong);
  --form-download-spinner-text: var(--brand-accent);
}
```

Set all three in `tailwind/site/theme.css`, pointing at brand tokens — see `references/theming.md`.

### Anti-examples

- A `<form action="...">` written by hand, or a copy of the partial's markup pasted into a layout.
- `!important` on `.leed-form` rules to beat Leed's — put the file in `layer(components)` instead (see `references/css-layers.md`).

## Pagination

```hbs
{{> leed/components/pagination }}              {{!-- uses @root/list --}}
{{> leed/components/pagination data=list }}    {{!-- explicit --}}
```

The parameter is `data=`, the pagination object (`PageData`) of a `:paged` or `:labels` list. The component renders nothing when there is one page, and emits `.pagination-page-range`, `.pagination-list`, `.pagination-inactive` and, from `SmartPaginationLinks`, `.pagination-active` and `.pagination-ellipsis` for styling. The colors come from `--site-pagination-icon-color` and `--site-pagination-icon-color-hover`.

Working example: `{appRoot}/static/site/_includes/leed/components/pagination.hbs`. A site that wants different markup (a newer/older pager, say) may build its own from `SmartPaginationLinks`, `PaginationRange` and `pagination.href.*` — those are Leed's paging primitives, so it is still Leed's pagination, not a hand-rolled one. It must never compute page ranges itself.

## Reading progress

```hbs
{{!-- In the site header, passed through from the layout --}}
{{> leed/components/scroll-status-indicator-horizontal scrollBarId=scrollBarId }}

{{!-- In the layout --}}
{{#>site-template scrollBarId="post-body" }} … <article id="post-body"> … {{/site-template}}
```

The partial renders nothing without a `scrollBarId`, so a header can always include it and let each layout opt in. It finds the nearest scrollable parent of the target, which a hand-written bar measuring only the window does not. Color it with three tokens pointed at brand tokens:

```css
:root {
  --scroll-status-indicator-horizontal-start-bg: transparent;
  --scroll-status-indicator-horizontal-partial-bg: var(--brand-accent);
  --scroll-status-indicator-horizontal-complete-bg: var(--brand-accent-hover);
}
```

Working example: `{appRoot}/static/site/_includes/leed/components/scroll-status-indicator-horizontal.hbs`.

## Docs search

Inside a custom `docs-header.hbs` (see `references/layouts-and-page-types.md`, on ejecting), keep Leed's search trigger:

```hbs
{{#if showDocsSearch}}
{{> leed/docs/document-search compact=true }}
{{/if}}
```

`compact=true` is the icon-only button for a crowded bar. The trigger sets `headerSearchShow`, which is Alpine state owned by the docs shell, so it works only on documentation pages — render it there and nowhere else. Bind `@click="headerSearchShow = true"` on your own element if you want a different trigger; `Ctrl+K` is bound on the modal and works either way.

Working example: `{appRoot}/static/site/_includes/leed/docs/document-search.hbs`, used by `{appRoot}/static/site/_includes/leed/docs/docs-header.hbs`.
