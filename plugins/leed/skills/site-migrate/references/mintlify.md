# Mintlify to Leed

How a Mintlify docs repository maps onto a Leed documentation set. Read it with `../SKILL.md`, which owns the order of the steps; this file owns what each Mintlify construct becomes.

## Sources

- Navigation in `docs.json` (groups, tabs, anchors, dropdowns, versions, languages): https://www.mintlify.com/docs/organize/navigation
- Global settings (`docs.json`, `mint.json` migration): https://www.mintlify.com/docs/organize/settings
- Navbar and footer settings: https://www.mintlify.com/docs/organize/settings-structure
- Page front matter: https://www.mintlify.com/docs/organize/pages
- Redirects: https://www.mintlify.com/docs/create/redirects
- Reusable snippets: https://www.mintlify.com/docs/create/reusable-snippets
- Callouts: https://www.mintlify.com/docs/components/callouts
- Code groups: https://www.mintlify.com/docs/components/code-groups
- Tabs, steps, accordions and cards: https://www.mintlify.com/docs/components/tabs, https://www.mintlify.com/docs/components/steps, https://www.mintlify.com/docs/components/accordions and https://www.mintlify.com/docs/components/cards

## Layout and config

| File | Holds |
|---|---|
| `docs.json` | `theme`, `name`, `colors` (`primary`, `light`, `dark`), `logo`, `favicon`, `navigation`, `navbar`, `footer`, `redirects`, `api` |
| `mint.json` | the older form of the same settings; `navigation` is a list of `{group, pages}`, with `tabs`, `anchors`, `topbarLinks`, `topbarCtaButton` and `footerSocials` beside it |
| `*.mdx`, `*.md` | the pages, anywhere in the repository |
| `snippets/` | reusable snippets; never pages |
| `images/`, `logo/` and similar | images and files, served from the repository root |
| `openapi.json` or `.yaml` | the API reference spec, when there is one |

A page's URL is its path without the extension (`guides/quickstart.mdx` is `/guides/quickstart`). A page reference in `navigation` is that same path.

## Navigation to menus

- `navigation` has one root pattern: `pages`, `groups`, `tabs`, `anchors`, `dropdowns`, `products`, `versions` or `languages`, nested in the order the file gives. Walk it in order.
- A **group** (`group` with `pages`) becomes a folder named by `group`; a nested group a nested folder. A page reference becomes a page, labeled with its front matter `sidebarTitle`, then `title`.
- **Tabs, anchors, dropdowns and products** each partition the sidebar. Make each one a top-level folder of the docs set, named by `tab`, `anchor`, `dropdown` or `product`, with its groups inside, unless the user wants a separate docs set per tab. A tab, anchor or dropdown with only an `href` is an external link: add it to the top menu, or report it.
- A group's `root` page is its landing page. Leed folders cannot be links: make it the first page in the folder and alias the group's URL to it.
- `expanded`, `icon` and `tag` on a group have no menu equivalent; report `tag` only when it carries meaning (a "Beta" tag).
- `versions` and `languages`: migrate the default (or first) only, and report the rest.

## Header and footer

- `navbar.links` become the **top** menu in order, each `label` with its `href`; `navbar.primary` (the call-to-action button) is better as the docs header button: set it on the migrated page type with `leed settings pagetype set <pageTypeId> --documentation-configuration.header.button.text` and `.href`, not on the company, which would change every docs set. A `github` or `discord` type link becomes a plain link. In `mint.json` the same are `topbarLinks` and `topbarCtaButton`.
- `footer.links` columns become the **bottom** menu: each `header` a parent item, its `items` the children. `footer.socials` become items named after the platform. In `mint.json`, `footerSocials`.
- `logo`, `favicon` and `banner`: point the user at Settings, General, for logos; report the banner.

## Markdown dialect

| Source | Leed | Notes |
|---|---|---|
| `<Note>` | `:::note` | |
| `<Info>` | `:::info` | |
| `<Tip>` | `:::tip` | |
| `<Warning>` | `:::warning` | |
| `<Danger>` | `:::danger` | |
| `<Check>` | `:::tip` | Approximated |
| `<Callout icon color>` | `:::note` | Approximated: the icon and color are dropped |
| `<Tabs>` with `<Tab title="...">` | `===tabs-container` with `@tab <title>`, closed with `===` | |
| `<CodeGroup>` around fences titled `js file.js` | `===tabs-container` with one `@tab file.js` holding each fence | The fence title becomes the tab label |
| `<CodeGroup dropdown>` | `===tabs-container` | The dropdown becomes tabs |
| A fence with a title (`js file.js`), `{1,3}` highlights, `lines`, `wrap`, `expandable` | fenced code with its language | Approximated: the title becomes the sentence before the block; the rest is dropped |
| `<Steps>` with `<Step title="...">` | a numbered list, or one `###` heading per step | Approximated; report it |
| `<Accordion title="...">` | `+++ Title` | `defaultOpen` becomes `++> Title` |
| `<AccordionGroup>` | the collapsibles one after another | |
| `<Expandable title>` | `+++ Title` | |
| `<Card title href>` | a link to the page, with its text | Approximated; report it |
| `<CardGroup cols>` or `<Columns>` | a list of links | Approximated; report it |
| `<Frame caption>` around an image | the image with a caption title | |
| `<ParamField>`, `<ResponseField>` | a table, or a list with the name in code | Approximated; report it |
| `<Tooltip tip>` | the text, with the tip in brackets after it | Approximated |
| `<Update label>` | a `##` heading per update, newest first | Approximated; report it |
| `<Icon icon="...">` | `{% icon fa-solid fa-<name> %}` | Mintlify icons are Font Awesome by default; a Lucide or Tabler icon may not match, so report it |
| `<Badge>`, `<Tile>`, `<Panel>`, `<Color>`, `<Tree>`, `<View>` and custom JSX components | nothing | Convert their text by hand, or drop and report |
| `<iframe>` or a YouTube URL | `{% youtube videoId="..." %}` or `{% iframe src="..." %}` | |
| `<video>` | an uploaded video's `markdown` from `leed asset upload` | Leed embeds uploaded video through the asset manager |
| A `mermaid` fence | a `mermaid` fence | |
| `$...$` and `$$...$$` math | inline math and a `math` fence | Leed writes inline math in double backticks starting `math`, and block math as a fence whose language is `math` |
| JSX expressions `{variable}` | the value, written in | |

## Includes and reusable content

Snippets live in `snippets/` and are imported into a page (`import Intro from "/snippets/intro.mdx";`, then `<Intro />`, or a named export such as `{ version }`). Inline the snippet where it is used, substituting the props passed to it (`<Greeting product="X" />`) and exported values, then convert it with the same table. A `.jsx` snippet is a component: convert its text by hand or report it. List each inlined snippet in the report with the pages that now hold a copy. Delete the `import` lines.

## Frontmatter to page fields

| Mintlify | Leed |
|---|---|
| `title` | the page title; a leading `#` heading is removed from the body (SKILL.md step 4) |
| `sidebarTitle` | the menu entry's name, set in the staged `menu.json` |
| `description` | `summary` |
| `keywords` | dropped by the bulk import, which stores only `title` and `summary`; report each page's values so the user can set them in the CMS |
| `hidden: true` | ask whether to put it in the menu, since a Leed docs page's URL comes from the menu; report it |
| `noindex` | report it |
| `icon`, `tag`, `mode` | dropped; report `tag` when it carries meaning |
| `url` | the entry is an external link: top menu, or report it |
| `openapi` | an API reference page: see Known gaps |

## Assets

Images and files are in the repository, referenced from the root (`/images/x.png`) or relatively. Upload each with `leed asset upload` and write the returned markdown in its place. An `<img>` `width` is dropped and reported, and the image keeps the file's own width and height from the returned markdown; a `<Frame>` caption becomes the image's caption title. A `noZoom` attribute and light and dark image pairs (`className="block dark:hidden"`) are not carried: keep the light image and report the dark one.

## Redirects and old URLs

- Every page's old URL is its path without the extension. Alias each to its page.
- `redirects` entries (`source`, `destination`, `permanent`): alias `source` to the page `destination` became. A source with a wildcard (`:slug*`) or a partial wildcard (`/old/article-*`) cannot be an alias: expand it to the fixed paths it covers among the migrated pages when that is clear, otherwise report it. A destination on another host is reported.

## Theme

`colors.primary` is the brand color, with `colors.light` and `colors.dark` its variants for dark and light mode. When tailoring is allowed, map `primary` to the brand accent token and `light` and `dark` to the accent's dark-mode and hover tokens; otherwise choose the nearest built-in `color-theme-*`. `theme` (the Mintlify layout theme), `fonts`, `background` and custom CSS or JavaScript files are not migrated: report them.

## Known gaps

- `<Steps>`, cards and card groups, columns, `<ParamField>` and `<ResponseField>`, `<Update>`, tooltips, badges and custom components.
- Code block titles, highlights and other fence options.
- `<Callout>` icons and colors, and non-Font-Awesome icons.
- `openapi` pages and the API playground: the user can import their OpenAPI spec into a Leed API docs set with `leed import openapi`; otherwise report each page.
- Wildcard redirects and redirects to other hosts.
- Versions and languages beyond the default.
- `navbar.primary` when the docs header button is already set, the banner, `fonts`, `background` and custom CSS.
- Dark-mode image pairs.
