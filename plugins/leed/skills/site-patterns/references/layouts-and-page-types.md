# Layouts, page types, and what can be customized

Details rules 8, 13 and 14 in this skill's `SKILL.md`.

## One layout per page type

A page type names its layout in the CMS, and `src/_data/pageTypeList.json` shows it (`"layout": "module.hbs"`). Every page of that type renders through that one file in `src/_layouts/`. That is what keeps a set of pages a set: change the layout and all of them change.

### The layout reads frontmatter; the page holds data

A page carries its content as frontmatter fields, and the layout decides the markup. Never hand-write a hero, a comparison table or a row of cards inside an individual page — add a field and let the layout render it, so the twentieth page reads like the first.

Open every layout with a comment listing the fields it expects, so the next page of the type can be written from it:

```hbs
{{!--
Module page layout — the shell for every page of the Modules page type.

Do NOT hand-write hero, install or section markup in an individual page.
Add frontmatter fields instead.

Expected frontmatter
  title           Auth
  summary         one line, for cards and meta
  icon            fa-fingerprint      — Font Awesome name without the style prefix
  installCommand  acme add auth       — omit for a capability not yet shipped
  whatFor         ["…", "…"]          — a list of sentences; the <p> belongs to this layout
  cost            { title, body, rows[{label, them, us}] }   — optional; no section renders without it
  docs            pageid:<uuid>       — never a path
--}}
{{#>site-template}}
  {{> hero title=title lead=summary }}
  {{#if whatFor}}<section>{{#each whatFor}}<p>{{{ this }}}</p>{{/each}}</section>{{/if}}
  {{#if cost}}{{> cost-table cost=cost }}{{/if}}
{{/site-template}}
```

An optional block renders only when its field is present, so a page without cost data simply has no cost section rather than an empty one.

### New page types start on `empty.hbs`

`empty.hbs` is the whole of `{{{ process content }}}` (`{appRoot}/static/templates/raw-content/src/_layouts/empty.hbs`). A posts page type created without `--layout` stores `empty.hbs`, and the CMS writes the file and a `src/<slug>-index.hbs` list page when the repo lacks them. Build the real layout afterwards, commit and push it, then point the page type at it with `leed settings pagetype set <id> --layout <name>.hbs` (the `/site-settings` skill).

`{appRoot}/static/templates/pages/PAGE_LAYOUT.hbs` is a starting point for that real layout.

### A page type may only name a layout that exists

The CMS refuses `pagetype create --layout` or `pagetype set --layout` for a file that is not in `src/_layouts/` on the site's `staging` branch, and `leed site validate` fails naming each page type whose layout is missing. Order the work accordingly: layout first, pushed; then the page type. Documentation and API types always use Leed's own documentation layout (`leed-documentation.hbs`), which the build supplies — it is not missing from the repo, and must not be created there.

### Pass-through pages: `layout: null` plus `{{#>site-template}}`

A one-off page that is its own markup — a contact page, a landing page, a list index whose cards it draws itself — sets `"layout": null` and wraps itself in the site template:

```hbs
---
{
  "pageTypeId": "<root page type id>",
  "layout": null,
  "title": "Contact",
  "pageId": "<uuid>",
  "publishedAt": "2026-09-01T12:00:00.000Z"
}
---
{{#>site-template}}
<main class="wrap">…</main>
{{/site-template}}
```

`site-template.hbs` is the site's master wrapper. Its body offset is the header-height contract, `<div class="grow mt-(--height-header)">` — see `references/css-layers.md`.

## Site-wide `<head>` content: `header-includes.hbs`

Leed's `<head>` partial, `leed/head`, opens with `{{> header-includes }}` when `src/_includes/header-includes.hbs` exists (`{appRoot}/static/site/_includes/leed/head.hbs`). Every page that has a Leed `<head>` calls `leed/head`: the pages `site-template.hbs` wraps, the unsubscribe pages, and the documentation and API pages. Those last render through Leed's own documentation layout (`leed-documentation.hbs` and the shell it calls), which does **not** wrap itself in `site-template.hbs`. So a tag that must be on every page goes in `header-includes.hbs`; written in `site-template.hbs` it silently misses the whole documentation set, and written in a layout it misses every other page type.

It needs no CMS flag and no plan tier: `leed/head` checks `templateExists "header-includes.hbs"`, so the file existing is what turns it on. Every new site is provisioned with one that holds only a comment (`{appRoot}/static/templates/raw-content/src/_includes/header-includes.hbs`), and `/leed:site-onboarding` replaces that with the starter's, which sets `theme-color`.

| Goes in `header-includes.hbs` | Stays where it is |
|---|---|
| A preload for a self-hosted web font (`.woff2` in `src/static/webfonts/`, declared with `@font-face`), for a family Leed does not install itself. Never a font host: its URLs log every visitor | `<title>`, written by `site-template.hbs` |
| Site verification metas (`google-site-verification`, `msvalidate.01`, `facebook-domain-verification` and the like) | The description, canonical URL, Open Graph and Twitter cards: `leed/head` writes them from the page |
| Analytics and any other script every page runs, with `defer` | The SVG favicon: `leed/head` writes it from the company favicon set in the CMS |
| `<meta name="theme-color">`, light and dark, holding `--brand-bg` (`references/theming.md`) | A tag only one page type needs (a structured-data block, a page-specific preload): that page type's layout |
| `<link rel="manifest">`, PNG icon fallbacks and `apple-touch-icon` | Anything visible: it is `<head>` |

Name the files these tags load with the site's own prefix: the build deletes any `leed-*.png` under `src/`, and `src/static/images/favicon-*` and `logo-*` belong to the CMS, so `leed site validate` refuses them. A script of the site's own under `src/static/js/` is not fingerprinted, so bump a `?v=` query on its tag when it changes.

### Documentation hooks

Like `header-includes.hbs`, these are found by file lookup, so the file existing is what turns each on:

| File | Renders | Plan |
|---|---|---|
| `src/_includes/docs-page-cta.hbs` | Directly above a documentation page's Previous/Next links | Any. The documentation recipe's `page-cta` feature writes it |
| `src/_includes/api-page-cta.hbs` | Above an API reference page's Previous/Next links, **twice** (once per breakpoint copy of the links, with the same context), so it carries no id and its stylesheet shows one copy per width | Any. Written by the same feature when the site has API pages |
| `src/_includes/docs-header.hbs`, `docs-footer.hbs` | The documentation set's header and footer | Starter and above, by `leed site eject` |

The recommendations and the dynamic CTA are not hooks: they are Growth features added with `/leed:create recommendations` and `/leed:create cta` (rule 3).

The `/site-audit` skill reports a link to a font host wherever it is, `header-includes.hbs` included, with self-hosting as the fix. It reports a verification meta, an analytics script, `theme-color`, a manifest or an icon link in `site-template.hbs` (an error) or in a layout (for review: it may be needed by that page type alone), pointing here.

## What can be customized

### Read it, never hard-code it

Some of Leed's own templates can be ejected: copied into the repo as an override the site then owns. Which ones depends on the plan tier and its features, so the list is never written down in a template or a skill — ask the CLI:

```bash
leed site eject --json
```

Each row has `name` (what to eject by), `description`, `destination` (where the override is written, e.g. `src/_includes/docs-header.hbs`) and `customized` (`true` when that file already exists, so the site has taken ownership). A gated template does not appear below its tier, because an override the renderer ignores is worse than none.

### Customize only by ejecting

```bash
leed site eject docs-footer           # writes the current Leed default into the repo
leed site eject docs-footer --force   # overwrite an existing customization
```

Ejecting gives the real starting point (for `docs-footer`, a byte-identical copy of `{appRoot}/static/site/_includes/leed/docs/docs-footer.hbs`). Never edit files under `src/_includes/leed/` — the build replaces them — and never hand-write an override from memory. Delete the ejected file and Leed's default renders again.

## Files the build uses that nothing references

A site has files no template includes and no stylesheet imports, that the build still reads. A search for references finds nothing; the file is not unused. Never call one of these unused, and never delete one to "clean up":

| File | Why it is used |
|---|---|
| `src/_layouts/<name>.hbs` named in `src/_data/pageTypeList.json` | Every page of that type renders through it; `leed site validate` fails without it |
| `src/_includes/site-template.hbs` | Called as a block, `{{#>site-template}}`, from layouts and pass-through pages — a search in `_includes` alone will not find the caller |
| `src/_includes/stub-template.hbs` | Found by file lookup; cloned for every recommendation card |
| `src/_includes/header-includes.hbs` | Found by `templateExists` in Leed's `<head>` partial |
| `src/_includes/docs-header.hbs`, `docs-footer.hbs` | Rendered by the documentation layouts when present and the plan allows |
| `src/_includes/docs-page-cta.hbs`, `api-page-cta.hbs` | Found by `templateExists` above the docs and API pagers |
| `src/_includes/unsubscribe.hbs`, `unsubscribed.hbs` | Rendered as the unsubscribe pages when present |
| `src/_includes/*-DISABLED.hbs` | Leed's starter scaffold for the unsubscribe pages, in every site. Not rendered, and not the site's to delete; customize with `leed site eject unsubscribe` instead |
| Any ejected override `leed site eject --json` reports as `customized` | It replaces Leed's default |
| `tailwind/site.config.css`, and everything it imports | The build compiles it |
| A docs `@utility color-theme-<name>` file | Its class arrives from the documentation configuration in the CMS, which Tailwind scans as text |
| `src/static/js/mermaid.theme.json`, `src/static/js/hljs-<language>.js` | Read by the build for diagrams and extra highlight languages |

The longer table of overridable templates, with the contract each one must meet, is in `../site-builder/references/handlebars-reference.md` under "Customer-Overridable Templates".
