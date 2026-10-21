# Buttons, CTAs and recommendations

Details rule 3 in this skill's `SKILL.md`: recommendations and CMS-managed calls to action always use `data-leed-recommendations` and `data-leed-cta`, and recommendation cards come from the `data-leed-slot`s in `stub-template.hbs`.

**Both need the Growth plan.** Add them with the recipes, which read the plan from `leed site eject --json` and refuse below Growth: `/leed:create recommendations` turns `allowRecommendations` on, puts the slot in the chosen layouts, writes the card and an offline preview of the cards for local builds; `/leed:create cta` writes `cta.hbs` and puts the slot in the chosen layouts and on the home page. Below Growth, write neither attribute: the plan renders nothing into them.

A documentation page's own call to action is different: `docs-page-cta.hbs` and `api-page-cta.hbs` render on any plan, and the documentation recipe's `page-cta` feature writes them (see `layouts-and-page-types.md`, "Documentation hooks").

## Recommendations

### Why

Recommendations are chosen per page and per visitor by Leed's engine and served live as JSON. The attribute is the whole API: Leed's client finds every `[data-leed-recommendations]` element, fetches the page's recommendations, clones the stub template once per card, fills its slots and appends the cards. When there is nothing to show it hides the element, heading and all. There is no helper call, no id to keep in sync and no inline script, so a strict Content-Security-Policy needs no `unsafe-inline`.

### The pattern

Put the attribute on the wrapper, heading included — cards are appended after what the element already holds:

```hbs
<section data-leed-recommendations class="read-next">
  <h2 class="eyebrow">Read next</h2>
</section>
```

The `{{{ Recommendations "id" }}}` helper and the `id` + `id-container` convention are deprecated. Do not write them in new templates, and replace them when you touch a template that still has them.

### The card: `stub-template.hbs`

The card is markup with holes in it, not a Handlebars template — it is cloned in the browser, where there is no page context. Each hole is a `data-leed-slot`:

| Slot | Filled with |
|---|---|
| `url` | The page link (on an `<a>`, sets `href`) |
| `title` | The page title |
| `publishedAt` | The date (on a `<time>`, sets `datetime` and the text in `data-leed-date-format`) |
| `readingTime` | Reading time |
| `summary` | The summary |
| `featureImage` | The feature image (on an `<img>`, sets `src` at the `data-leed-variant` size) |
| `name`, `fullName` | Inside a `data-leed-each="labels"` or `data-leed-each="authors"` `<template>`, one per label or author |

A falsy value removes its element rather than leaving it empty. Set `data-leed-variant` on the image to the size the card can actually reach — `medium` is the default and right for most cards; see `references/links-and-images.md`.

Working example: `{appRoot}/static/site/_includes/leed/stub-template.hbs`. To change the card, run `leed site eject stub-template` (it is gated on recommendations being in the plan — see `references/layouts-and-page-types.md`) and edit the copy in `src/_includes/stub-template.hbs`. Keep it small: it is inlined into every page that hosts a widget.

## CMS-managed CTAs

```hbs
<section data-leed-cta class="article-cta"></section>
```

The CTA is chosen in the CMS by page type and label, served live, and appended into the element. Editing the CTA in the CMS changes the published site without a republish. When the plan has no dynamic CTAs, or none matches, the element is left as it is. `/leed:create cta` adds it on Growth, as `{{> cta }}` holding this element. `{{{ CTA "id" }}}` is deprecated, as above.

## Links inside both

Leed adds the `data-reason` tracking string (`utm_campaign=leed&utm_source=internal&utm_medium=recommendation|cta…`) to every link it injects. Do not add your own to the stub or the CTA.

## Buttons

Buttons a template writes itself (a hero's "Get started", a header CTA) follow the same rules as any other link and color:

- **Defined once.** One stylesheet, `tailwind/site/buttons.css`, imported into `layer(components)`, holds `.btn` and its variants. Pages use the classes; they never restyle a button inline.
- **Colored from brand tokens.** `background: var(--brand-accent)`, never a hex value or a Tailwind palette color — see `references/theming.md`.
- **Linked by `pageid:`.** `<a href="pageid:<uuid>" class="btn btn-primary">`, with a `data-reason` saying where the click came from:

```hbs
<a href="pageid:b4d72a41-0b65-4825-b6f1-c7ae3b74f137" class="btn btn-primary"
   data-reason="utm_campaign=leed&utm_source=internal&utm_medium=hero&utm_term=get-started">Get started</a>
```

- **Leed's form submit is a button too.** It holds several stacked state labels (`.leed-form-button-label`), which inherit the body's line height and make it taller than `.btn`. Restate `.btn`'s line height on the form's button in the same file rather than giving forms a third button style.

## Anti-examples

- A related-posts block built from `collections.all` in the layout — that is a hand-built recommendation, frozen at build time and blind to the visitor.
- `<a href="/pricing/?utm_source=hero">` — a path, and tracking in the URL.
- `.btn-primary { background: #d4a017 !important; }`.
