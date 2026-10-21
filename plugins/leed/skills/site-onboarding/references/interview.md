# The interview and the content-model proposal

What to ask a new Leed customer, and the proposal that turns the answers into CMS records. Each record is one of the rows in `../../site-patterns/references/content-model.md`; the proposal names which.

## Questions

Ask a few at a time, in plain words. Skip any the user has already answered.

1. **The business.** What does it do, in one sentence? That sentence becomes the home page's tagline.
2. **The audience.** Who is the site for, and what should they do first (book a call, start a trial, read the docs)? That decides the home page's button and which section it opens.
3. **The sections.** Which pages does the site need besides the home page (About, Pricing, Contact, Customers)? Which belong in the header, and which only in the footer?
4. **The content.** Will the site publish posts (news, articles, a changelog)? Product documentation? Anything else that comes in a series of similar pages?
5. **Topics.** Do those posts or pages fall into topics a reader would browse by?
6. **Search.** Should visitors be able to search the site? Leed's search runs on documentation pages, so a yes means a documentation set; without one, say there will be no search yet, and why.
7. **The brand.** The accent color, and whether the brand is light, dark or both. Hex values if the user has them; otherwise a description to pick from.
8. **The font.** One of Leed's bundled fonts: Inter (`font-inter`), Open Sans (`font-open-sans`), Noto Sans (`font-noto-sans`), Geist (`font-geist`), Geist Mono (`font-geist-mono`) or JetBrains Mono (`font-jetbrains-mono`).
9. **The site title**, when it should differ from what the company already has.
10. **After a docs page**, when the site gets documentation: What should a reader do after a docs page? A sign-up, a contact page or a star link, with the page or URL it opens. Skip it when there is no answer.

## From answers to records

| Answer | Record | Made by |
|---|---|---|
| A plain section (About, Pricing) | A draft Root page, and a menu item linking it by `pageid:` | `settings.json` `create-pages`, `add-menu-items` |
| Header sections | Items in the **Header Menu**, the company's top menu | `add-menu-items` |
| Footer columns | Folders in the **Footer Menu**, each holding its pages; the menu's own `expanded` flag set so every column renders open | `configure-menus`, `add-menu-items` |
| Posts | A blog | `/leed:create blog` |
| Product documentation | A documentation set, with its own left menu and search index | `/leed:create documentation` |
| What a reader does after a docs page | One line above each documentation page's Previous/Next links (`docs-page-cta.hbs`, and `api-page-cta.hbs` when there are API reference pages), any plan. No answer: none | `/leed:create documentation`, feature `page-cta` |
| Posts, on Growth or above, and the user says yes to "Add recommendations and a CTA to your posts?" (asked by `/leed:create` once the blog recipe finishes, not by onboarding) | `allowRecommendations` on the blog, the recommendation and CTA slots in its layout | `/leed:create recommendations`, `/leed:create cta` |
| Another kind of repeated page | A page type, starting on `empty.hbs` (site-patterns rule 8) | `create-page-types`, then its layout with `site-builder` |
| Topics | Labels | `create-labels` |
| Search | None from onboarding. Leed's search UI exists only on documentation pages, so search comes with a documentation set, whose recipe makes its index. Without one, the proposal says there is no search, and why | `search-index` (decides only), `/leed:create documentation` |
| Brand colors | The brand tokens in `tailwind/site/theme.css`, light and dark | the starter templates |
| Font | The site template's font class, and `documentationConfiguration.font` | the starter templates, `company-settings` |
| Documentation colors | `documentationConfiguration.colorTheme`: `color-theme-site` (mapped to the brand tokens) on Starter or above, set only after the promote puts its CSS on production; otherwise the built-in theme closest to the accent, set with the other company settings | `docs-color-theme` (Starter or above), `company-settings` (below) |

## Brand tokens

Fill all eleven brand tokens in `theme.css`, in light and dark, from the answers: `--brand-bg`, `--brand-surface`, `--brand-surface-muted`, `--brand-fg`, `--brand-fg-muted`, `--brand-border`, `--brand-border-strong`, `--brand-accent`, `--brand-accent-hover`, `--brand-accent-muted` and `--brand-on-accent` (the text color on an accent button). Derive the ones the user did not give from the accent and the light or dark ground, and check that text on each ground and on the accent is readable. The starter's neutral palette is the fallback when the user has no brand yet. Color values go nowhere else (site-patterns rule 9), except that the light and dark `--brand-bg` are repeated in the two `theme-color` metas of `header-includes.hbs`, because a meta cannot read a CSS variable (rule 14).

## The proposal

Show it in this shape, and ask for a yes before applying anything:

```
Site: <site title>  ·  Plan: <tier>  ·  Surface: CLI | MCP  ·  Checkout: <path> | none

Pages (drafts, Root page type)
  - About        → Header Menu, Footer Menu › Company
  - Pricing      → Header Menu
  - Contact      → Footer Menu › Company

Recipes
  - /leed:create blog            → Header Menu "Blog", Footer Menu › Resources
  - /leed:create documentation   → Header Menu "Docs"; after a docs page: "Start a free trial" → pageid:<Pricing>
  - /leed:create recommendations, /leed:create cta   (Growth or above, when the user said yes)

Labels: Product, Engineering
Other page types: none
Search: the documentation set makes its own index (none without one: Leed's search UI exists only on documentation pages)
Menus: Header Menu (exists, bound as the top menu); Footer Menu (exists, bound as the bottom menu; set expanded)
Company settings: siteTitle "Acme" (was "acme.com"); documentation font font-inter
After the promote: documentation color theme color-theme-site (was color-theme-indigo)
Theme: accent #0f766e, light and dark; font Inter
Home page button: none until About is published (it is a draft; a link to a draft does not render)

Templates (checkout)
  - replace: src/_includes/site-template.hbs, header-includes.hbs, header.hbs, footer.hbs, src/index.hbs (still provisioned)
  - write: tailwind/site/theme.css, buttons.css, partials/menu.css, partials/site.css, docs/color-theme-site.css,
           src/static/js/site-header.js, docs-header.hbs, docs-footer.hbs
  - add to tailwind/site.config.css: the import lines it lacks
  - keep: <any file the user changed>
```

Name every change to a value the company already has, with its old value, as the site title above does.
