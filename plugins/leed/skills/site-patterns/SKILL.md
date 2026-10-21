---
name: site-patterns
description: Leed's always/never rules for building a site — menus, forms, recommendations and CTAs, pagination, links, images, lists of pages, layouts and page types, theming and dark mode, CSS layers, Handlebars pitfalls, header height, and what can be customized or called unused. Use before building or reviewing any template, layout, partial or stylesheet on a Leed site, and whenever you are about to decide a file is unused.
---

# Site Patterns Skill

These are the rules a Leed site is built by. They live here once; the `site-builder` skill holds the mechanics and the helper reference (`../site-builder/SKILL.md`), and where an example there seems to disagree with a rule here, the rule wins. CMS changes go through the `/site-settings` skill.

Every rule names the Leed system that already does the job. Reaching past it — a hand-written nav list, a JavaScript filter, a hex value in a component — is what makes a site drift and break on the next Leed release.

To check a site against these rules, use the `/site-audit` skill (`../site-audit/SKILL.md`): it reports each departure with its rule number and file:line.

`{appRoot}` is the installed `@leed-ai/cli` package (`npm ls -g @leed-ai/cli --parseable`, then its `dist/`). The examples cited below are files there; read them when you need the exact markup.

## Rules

1. **Menus: always `leed/menu/builder`, one builder for desktop and mobile.** Style it in CSS through `.leed-menu__item--*` and `.leed-submenu--*`. Never hand-write nav links.
   - *Applies when:* any header, footer, sidebar or drawer shows navigation.
   - *Example:* `{appRoot}/static/site/_includes/leed/docs/docs-header.hbs`, which renders one builder that CSS shapes into the bar and the drawer. Copy its menu pattern only: its `href="/"` logo link and hand-drawn progress bar are what rules 4 and 5 replace.
   - *Detail:* `references/menus.md`.
2. **Forms: always `leed/form`.** Style it from outside through `.leed-form` selectors and the `--site-*` and `--form-*` variables.
   - *Applies when:* a page collects anything — contact, subscribe, gated download.
   - *Example:* `{appRoot}/static/site/_includes/leed/form.hbs` and its styles in `{appRoot}/static/tailwind/components/form.css`.
   - *Detail:* `references/forms-and-widgets.md`.
3. **Recommendations and CTAs: always `data-leed-recommendations` and `data-leed-cta`.** Recommendation cards come from the `data-leed-slot`s in `stub-template.hbs`. Both are Growth features: add them with `/leed:create recommendations` and `/leed:create cta`, which check the plan first, and write neither below Growth.
   - *Applies when:* a page shows related content or a CMS-managed call to action.
   - *Example:* `{appRoot}/static/site/_includes/leed/stub-template.hbs`.
   - *Detail:* `references/buttons-and-ctas.md`.
4. **Pagination, reading progress and docs search: use Leed's components.** They are `leed/components/pagination`, `leed/components/scroll-status-indicator-horizontal` and `leed/docs/document-search`.
   - *Applies when:* a list page pages, an article shows progress, or a docs header needs search.
   - *Example:* `{appRoot}/static/site/_includes/leed/components/pagination.hbs`, `{appRoot}/static/site/_includes/leed/components/scroll-status-indicator-horizontal.hbs`, `{appRoot}/static/site/_includes/leed/docs/document-search.hbs`.
   - *Detail:* `references/forms-and-widgets.md`.
5. **Links: internal links use `pageid:<uuid>`, or `pageid:list-<id>` for a paginated index. Never a path.** Every heading on every page gets an `id` generated from its text when the site builds, so never create one: no `{#id}`, `id="…"`, `<a id>` or `<a name>` (all dropped or refused). To link to a heading, add its slug as the fragment: `#<slug>` on the same page, `pageid:<uuid>#<slug>` on another.
   - *Applies when:* any `href` points at a page of this site.
   - *Example:* `uniquePageId` in `{appRoot}/static/site/_data/eleventyComputed.js`, which builds the `list-<id>` ids.
   - *Detail:* `references/links-and-images.md`.
6. **Images: asset-manager images use `ImageTag`, `FeatureImage` or `Image`, sized to the widest the container can ever be.** Never `original` or `xxl` for a card or thumbnail.
   - *Applies when:* a template renders a feature image, an author photo, a menu image or any asset-manager image.
   - *Example:* `data-leed-variant="medium"` in `{appRoot}/static/site/_includes/leed/stub-template.hbs`.
   - *Detail:* `references/links-and-images.md`.
7. **Lists of pages: always a Leed collection. Never filter by hand or in JavaScript.** That means `collections.pageTypeId-X:paged|unpaged|labels|authors` or `(collection "pageTypeId-X:labelId-Y")`. A custom loop is allowed only for a selection the built-ins cannot express, with a template comment saying why.
   - *Applies when:* a template lists, counts or groups pages.
   - *Example:* `{appRoot}/static/templates/pages/PAGINATED_PAGE_TYPE_LIST.hbs`, and the blog recipe's topic page `../../recipes/blog/files/features/labels/blog-topic-index.hbs`.
   - *Detail:* `references/collections-and-loops.md`, and `references/authors-and-label-pages.md` for author and label pages.
8. **Layouts: one layout per page type, driven by frontmatter, with a header comment listing the fields it expects.** Never hand-write hero, table or row markup in a page. Pass-through pages use `layout: null` plus `{{#>site-template}}`. New page types start on `empty.hbs`, and a page type may only name a layout that exists.
   - *Applies when:* adding a page type, a layout or a page.
   - *Example:* `{appRoot}/static/templates/raw-content/src/_layouts/empty.hbs`.
   - *Detail:* `references/layouts-and-page-types.md`.
9. **Color: brand tokens are defined once on `:root` in `tailwind/site/theme.css`, and dark mode redefines the same names.** Every `--site-*`, `--docs-*` and alert token points at a brand token, and no `--site-*` is left unset. Two exceptions: the variables Mermaid derives colors from (`primaryColor` among them) must be literal values kept in sync with the brand tokens, because Mermaid throws on `var()` there and no diagram renders; and the `theme-color` metas in `header-includes.hbs` (rule 14) repeat `--brand-bg` in light and dark, because a meta cannot read a CSS variable. `@theme inline` names must differ from the source variable names.
   - *Applies when:* any color, theme or dark-mode work.
   - *Example:* the full list of `--site-*` names in `{appRoot}/static/tailwind/site-tokens.reference.css`.
   - *Detail:* `references/theming.md`.
10. **CSS layers: site styles go in `layer(base)` or `layer(components)`.** Overrides of Leed's docs styles stay unlayered and are scoped under `.leed-documentation`. Docs overrides use a layer only where Leed writes `!important`. Never use `!important` or `color-mix()` for alerts, and delete tokens and rules nothing reads.
    - *Applies when:* adding or importing a stylesheet, or overriding a Leed style.
    - *Example:* the layer order declared in `{appRoot}/static/tailwind/leed.css`.
    - *Detail:* `references/css-layers.md`.
11. **Handlebars: never use a bare name that collides with a global helper.** `{{ label }}` renders empty, so write `this.label`. Put `{{> code-block}}` at column 0.
    - *Applies when:* reading a field inside a loop or a `with` block, or calling a whitespace-sensitive partial.
    - *Example:* `{{{ this.label }}}` in `{appRoot}/static/site/_includes/leed/form.hbs`, a field read through `this`; and `{{label list.name 'name'}}` in the blog recipe's `../../recipes/blog/files/features/labels/blog-topic-index.hbs`, which is the `label` helper, not a field.
    - *Detail:* `references/collections-and-loops.md`.
12. **Header height: `--height-header` is measured at runtime and is what layouts read; `--site-header-height` is the fallback the author sets.** Layouts use `<div class="grow mt-(--height-header)">` and `scroll-padding-top: calc(var(--height-header, var(--site-header-height, 0px)) + var(--height-toc, 0px));`. Never set `--height-header` by hand, and never size the header from it.
    - *Applies when:* the site has a fixed header, or a layout offsets content below one.
    - *Example:* `{appRoot}/static/tailwind/defaults.css` (the `scroll-padding-top` rule) and `{appRoot}/static/site/_includes/leed/docs/shell.hbs` (the `mt-(--height-header)` body).
    - *Detail:* `references/css-layers.md`.
13. **What can be customized depends on the plan tier: read it from `leed site eject --json`, never hard-code it.** Customize a Leed template only by ejecting it. Files the build uses are never "unused": ejected overrides, `stub-template.hbs`, `header-includes.hbs`, the docs header and footer, `site-template.hbs`, and any layout named in `pageTypeList`.
    - *Applies when:* changing a Leed-rendered template, or deciding whether a file can be deleted.
    - *Example:* `{appRoot}/static/site/_includes/leed/docs/docs-footer.hbs`, which `leed site eject docs-footer` copies byte for byte.
    - *Detail:* `references/layouts-and-page-types.md`.
14. **Site-wide `<head>` content goes in `src/_includes/header-includes.hbs`, never in `site-template.hbs` or a layout.** `leed/head` renders it first in `<head>` on every page, documentation and API pages included, which `site-template.hbs` does not wrap. A preload for a self-hosted font (never a font host, which logs every visitor), verification metas, analytics and other site-wide scripts, `theme-color`, the web manifest and icon fallbacks belong there. A tag only one page type needs stays in that page type's layout. No CMS flag or tier: the file existing turns it on, and `leed/head` already writes the description, canonical URL, social cards and the SVG favicon from the company's settings.
    - *Applies when:* adding a font, a verification tag, an analytics or other site-wide script, or any tag that must be in every page's `<head>`.
    - *Example:* `{appRoot}/static/site/_includes/leed/head.hbs`, which opens with `{{> header-includes }}` behind `templateExists "header-includes.hbs"`, and `{appRoot}/static/templates/raw-content/src/_includes/header-includes.hbs`, the file every new site starts with.
    - *Detail:* `references/layouts-and-page-types.md`.

## The content model

Page types, labels, autolinks, search indexes, docs sets and menus are CMS records, not repo files. What each one is, which `_data` file shows it, and the command that changes it are in `references/content-model.md`.

Page content is the person's to review in the Leed editor once it is written. Every skill that writes it ends with the same handoff and switches to suggestions once a page has comments; the shared text is in `references/review-handoff.md`, and `/leed:review` (`../review/SKILL.md`) answers the comments.

## References

| File | Rules |
|---|---|
| `references/menus.md` | 1 |
| `references/forms-and-widgets.md` | 2, 4 |
| `references/buttons-and-ctas.md` | 3 |
| `references/links-and-images.md` | 5, 6 |
| `references/collections-and-loops.md` | 7, 11 |
| `references/authors-and-label-pages.md` | 7 |
| `references/layouts-and-page-types.md` | 8, 13, 14 |
| `references/theming.md` | 9 |
| `references/css-layers.md` | 10, 12 |
| `references/content-model.md` | Where each CMS record lives and how it changes |
| `references/review-handoff.md` | The review loop: the handoff every skill that writes page content ends with, and suggest mode once a page has comments |
