# ReadMe to Leed

How a ReadMe project's guides map onto a Leed documentation set. Read it with `../SKILL.md`, which owns the order of the steps; this file owns what each ReadMe construct becomes.

**The source must be files.** Work from the repository ReadMe's bi-directional Git sync keeps, or from a folder of Markdown pages the user exported or pulled with ReadMe's `rdme` CLI. A project with neither has to be synced or exported by the user first. Each ReadMe version is a branch of that repository: migrate the one the user names, usually the stable version.

ReadMe has two Markdown dialects. Older projects use ReadMe-flavored Markdown (RDMD), including legacy `[block:...]` magic blocks; projects on ReadMe Refactored use MDX components. A project may hold both, so check each page.

## Sources

- Repository and page structure (`_order.yaml`, folders, front matter): https://docs.readme.com/main/docs/documentation-structure
- Bi-directional sync: https://docs.readme.com/main/docs/editing-with-bi-directional-sync
- The `rdme` CLI: https://docs.readme.com/main/docs/rdme
- MDX and built-in components: https://docs.readme.com/main/docs/mdx
- Custom MDX components: https://docs.readme.com/main/docs/building-custom-mdx-components
- Reusable content: https://docs.readme.com/main/docs/reusable-content
- ReadMe-flavored Markdown callouts: https://docs.readme.com/rdmd/docs/callouts
- ReadMe-flavored Markdown extensions (code tabs, embeds, variables): https://docs.readme.com/rdmd/docs/syntax-extensions
- Code blocks and code tabs: https://docs.readme.com/rdmd/docs/code-blocks

## Layout and config

| Path | Holds |
|---|---|
| `docs/` | the guides: one folder per category, each with an `_order.yaml` |
| `docs/<category>/_order.yaml` | the order of that folder's pages: a flat list of slugs, no extensions |
| `docs/<category>/<page>.md` | a page with no children |
| `docs/<category>/<page>/index.md` | a page with children; the children and another `_order.yaml` sit beside it |
| `reference/` | API reference pages, often generated from an OpenAPI file |
| `recipes/`, `changelogs/`, `custom_pages/`, `custom_blocks/` | recipes, changelog posts, custom pages and reusable blocks |

A page's slug is its file or folder name. Its URL is `/docs/<slug>`: ReadMe's guide URLs are flat, so the category is not in the path. Pages may nest up to five levels.

## Navigation to menus

- The category folders are the top-level sidebar sections. Their order comes from the `_order.yaml` at `docs/`, when there is one, and their titles from the category's own title; ask the user when a title is not in the files (a slugified folder name is a fallback, reported).
- Inside a category, walk `_order.yaml` in order: a slug matching a `.md` file is a page, a slug matching a folder is a page with children. Pages not listed come after the listed ones.
- **A page with children** has its content in `index.md`. Leed folders cannot be links: make a folder named after the page's title, put the `index.md` page first inside it, then the children, and alias the parent's old URL to that first page.
- A page with `hidden: true` is out of ReadMe's sidebar. A Leed docs page takes its URL from its place in the menu, so ask the user whether to migrate it into the menu or leave it out, and report the choice.
- `recipes/` and `changelogs/` are not part of the guides sidebar: migrate them only when the user asks (changelog posts suit a Leed blog), and report them.

## Header and footer

ReadMe keeps the project's header links, the landing page and the footer in the ReadMe dashboard, not in the repository. Ask the user for the header and footer links (or a screenshot), then build the **top** and **bottom** menus from what they give. The tabs ReadMe shows for Guides, API Reference, Recipes and Changelog become top-menu items only for the sections that were migrated.

## Markdown dialect

| Source | Leed | Notes |
|---|---|---|
| `> 📘 Title` blockquote (or `ℹ️`) | `:::info Title` | The first line after the emoji is the title; the rest of the quote is the body |
| `> 👍 Title` | `:::tip Title` | |
| `> 🚧 Title` (or `⚠️`) | `:::warning Title` | |
| `> ❗️ Title` (or `🛑`) | `:::danger Title` | |
| A blockquote starting with any other emoji | `:::note` | Approximated: ReadMe shows it as a neutral callout |
| `<Callout icon="📘" theme="info">` | `:::info` | `theme` decides the type as above; the icon is dropped |
| `[block:callout]` JSON `{"type": "info", "title", "body"}` `[/block]` | `:::info Title` | Legacy magic block; `success` to `:::tip`, `warning` to `:::warning`, `danger` to `:::danger` |
| Consecutive fences with no blank line between them (code tabs), each titled `js Title` | `===tabs-container` with one `@tab Title` per fence, closed with `===` | The fence title is the tab label; a fence without one uses its language |
| `[block:code]` JSON with `codes[]` | `===tabs-container` with `@tab` per code, or one fence | Legacy magic block |
| A fence with a title, or options such as line numbers | fenced code with its language | Approximated: the title becomes the sentence before the block |
| `<Tabs>` with `<Tab title>` (Refactored) | `===tabs-container` with `@tab <title>` | |
| `<Accordion title>` | `+++ Title` | |
| `<Cards>` with `<Card title href>` | a list of links | Approximated; report it |
| `<Columns>` | the columns one after another | Approximated; report it |
| `<Image src caption>` or `[block:image]` | the uploaded image's `markdown`, with the caption as its title | |
| `[Title](https://... "@embed")` or `<Embed url>` or `[block:embed]` for a YouTube video | `{% youtube videoId="..." %}` | |
| The same for anything else | `{% iframe src="..." %}` or a plain link | |
| `[block:html]` and raw HTML | Leed Markdown for what it shows, or nothing | Raw HTML is shown as typed in a CMS page body; report it |
| `[block:parameters]` (a table block) | a Markdown table | |
| `[block:api-header]` | a `##` heading | |
| `[text](doc:slug)` and `[text](ref:slug)` internal links | a link to `pageid:<uuid>` | Written as a link in step 4 and rewritten in step 6; a `ref:` target that was not migrated is reported |
| `<<variable>>` | the value, written in | Ask the user for user variables (an API key placeholder); report each |
| `<<glossary:term>>` | the term, as plain text | Approximated; report it |
| `<Recipe>` and custom MDX components | a link to the migrated page, or nothing | Report each |
| A `mermaid` fence | a `mermaid` fence | |
| `$$...$$` math | a `math` fence | |

## Includes and reusable content

Reusable content blocks are managed in the ReadMe dashboard; in a sync they appear as a component tag named after the block (`<MyBlock />`) with its source in `custom_blocks/`, and in an export they arrive as plain copied Markdown. Inline the block's content where the tag stands, convert it with the same table, and list each in the report with the pages that now hold a copy. A block whose source is not in the files cannot be inlined: report it.

## Frontmatter to page fields

| ReadMe | Leed |
|---|---|
| `title` | the page title; a leading `#` heading is removed from the body (SKILL.md step 4) |
| `excerpt` (or `summary` in some syncs) | `summary` |
| `metadata.description` | `summary` when there is no excerpt |
| `metadata.keywords` | dropped by the bulk import, which stores only `title` and `summary`; report each page's values so the user can set them in the CMS |
| `metadata.title`, `metadata.robots` | dropped; report a `noindex` robots value |
| `hidden` | the user's choice (see Navigation to menus); report it |
| `deprecated: true` | a `:::warning` at the top of the page saying it is deprecated; report it |
| `icon` | dropped |
| `next` (what's-next links) | a short "Next" list of links at the end of the page |
| `category`, `parentDoc`, `order` (`rdme` exports) | the menu position |
| `slug` | not stored: it makes the old URL, which becomes a path alias |
| `api` (reference pages) | see Known gaps |

## Assets

ReadMe stores images on its own file host and pages reference them by full URL; the repository holds no image files. This skill does not download them. Ask the user to download them into the copy (a ReadMe project export includes them), then upload them with `leed asset upload` and write the returned markdown in place of each URL. An image left on ReadMe's host stays a link and is reported, because it disappears when the ReadMe project is closed.

## Redirects and old URLs

- Every guide's old URL: `/docs/<slug>`, under the project's domain (and `/v<version>/docs/<slug>` for a versioned link). Alias each to its page.
- ReadMe's own redirects are set in the dashboard, not in the files. Ask the user for them, alias each whose target is a migrated page, and report the rest.
- `reference/` page URLs (`/reference/<slug>`) become aliases only when the API reference is migrated into Leed.

## Theme

The brand colors, the theme and custom CSS live in the ReadMe dashboard. Ask the user for the main brand color (a hex value). When tailoring is allowed, map it to the brand accent token; otherwise choose the nearest built-in `color-theme-*`. Custom CSS and custom JavaScript are not migrated: report them.

## Known gaps

- API reference pages: the user can import their OpenAPI spec into a separate Leed API docs set with `leed import openapi`; otherwise report each page.
- Header links, footer, landing page, theme and redirects, which live in the ReadMe dashboard and must come from the user.
- Images on ReadMe's file host that the user has not downloaded.
- Cards, columns, recipes, the glossary, user variables and custom MDX components.
- Legacy `[block:html]` blocks and other raw HTML.
- Code block titles and options.
- Recipes, changelogs and custom pages, unless the user asks for them.
- Versions other than the one migrated.
