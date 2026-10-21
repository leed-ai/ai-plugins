# VitePress and Nextra to Leed

How a VitePress site, or a Nextra site (the Next.js docs theme), maps onto a Leed documentation set. Read it with `../SKILL.md`, which owns the order of the steps; this file owns what each construct becomes. The two systems are covered in one file because their sources look alike (Markdown or MDX, a JavaScript config, file-based routing); each section says which applies.

## Sources

VitePress:

- Markdown extensions (containers, GitHub-style alerts, code groups, includes): https://vitepress.dev/guide/markdown
- Routing, `srcDir`, `cleanUrls` and `rewrites`: https://vitepress.dev/guide/routing
- Sidebar: https://vitepress.dev/reference/default-theme-sidebar
- Nav: https://vitepress.dev/reference/default-theme-nav
- Footer: https://vitepress.dev/reference/default-theme-footer
- Front matter: https://vitepress.dev/reference/frontmatter-config
- Assets and `public/`: https://vitepress.dev/guide/asset-handling
- Vue in Markdown: https://vitepress.dev/guide/using-vue
- Brand colors: https://vitepress.dev/guide/extending-default-theme

Nextra:

- `_meta` files: https://nextra.site/docs/file-conventions/meta-file
- Docs theme configuration: https://nextra.site/docs/docs-theme/theme-configuration
- Markdown and GitHub alert syntax: https://nextra.site/docs/guide/markdown and https://nextra.site/docs/guide/github-alert-syntax
- Built-in components: https://nextra.site/docs/built-ins/callout, https://nextra.site/docs/built-ins/tabs, https://nextra.site/docs/built-ins/steps and https://nextra.site/docs/built-ins/cards
- Next.js redirects: https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects

## Layout and config

**VitePress**

| File | Holds |
|---|---|
| `.vitepress/config.js`, `.ts` or `.mts` | `base`, `srcDir`, `cleanUrls`, `rewrites`, `themeConfig` (`nav`, `sidebar`, `footer`, `socialLinks`, `logo`), `locales` |
| `.vitepress/theme/` | theme extension: `index.js` and `custom.css` |
| `*.md` under `srcDir` (default the project root) | the pages; `index.md` is its folder's page |
| `public/` | files served from the site root |

`guide/setup.md` is `/guide/setup.html`, or `/guide/setup` with `cleanUrls: true`; `guide/index.md` is `/guide/`.

**Nextra**

| File | Holds |
|---|---|
| `next.config.mjs` | the Nextra plugin, and Next.js `redirects()` |
| `content/` (Nextra 4) or `pages/` (Nextra 3 and earlier) | the pages, `.md` or `.mdx`; `app/` holds the Next.js routes |
| `_meta.js`, `_meta.ts`, `_meta.json` or `_meta.global.*` | per-folder titles, order and visibility |
| `app/layout.jsx` (Nextra 4) or `theme.config.jsx` (Nextra 3) | the navbar, footer, logo and primary color |
| `public/` | files served from the site root |

A page's URL is its path under `content/` or `pages/` without the extension; `index.mdx` is its folder's page.

## Navigation to menus

**VitePress.** `themeConfig.sidebar` is an array, or an object keyed by path prefix with one sidebar per section.

- Walk each sidebar in order. An item with `items` becomes a folder named by `text`; an item with `link` a page labeled by `text`. `base` on a group is prepended to its children's links.
- A keyed sidebar (`'/guide/'`, `'/reference/'`): make each key a top-level folder, in the order of the matching `nav` items.
- A group that also has a `link` is a landing page. Leed folders cannot be links: make it the first page in the folder and alias the group's URL to it. A link ending in `/` points at that folder's `index.md`.
- `collapsed` has no menu equivalent. Items linking to another host are reported, or put in the top menu.

**Nextra.** The `_meta` file in each folder sets the order and titles; pages not named come after, alphabetically, with `index` first.

- A key's value is its title (a string, or `{ title }`). A folder becomes a menu folder with that title.
- `type: 'page'` puts an item in the navbar instead of the sidebar: build the **top** menu from those, and make each such section a top-level folder of the docs menu. `type: 'menu'` with `items` is a navbar dropdown: a top-menu item with children.
- `type: 'separator'` has no menu equivalent: a separator with a `title` becomes a folder grouping the items after it, or is reported.
- `display: 'hidden'`: ask the user whether to migrate the page into the menu, since a Leed docs page's URL comes from the menu, and report it.
- `href` items are external links: top menu, or report them.
- A folder's `index` page, or a page with `asIndexPage: true` in its front matter, is the folder's landing page: make it the first page in the folder and alias the folder URL to it.

## Header and footer

**VitePress.** `themeConfig.nav` becomes the **top** menu: `text` with `link`, and an item with `items` a dropdown (an item with children). `socialLinks` (`icon`, `link`) become items named after the platform, in the top menu where VitePress shows them. `footer.message` and `footer.copyright` are text, not menus: report them, and build a **bottom** menu only from links the user wants there.

**Nextra.** The navbar items come from `_meta` `type: 'page'` and `type: 'menu'` entries (see above), plus the `projectLink` and `chatLink` of the navbar: those become top-menu items. The footer is a component (`<Footer>` in Nextra 4, `footer` in `theme.config.jsx`): read its links into the **bottom** menu and report its text.

## Markdown dialect

| Source | Leed | Notes |
|---|---|---|
| `::: info`, `::: tip`, `::: warning`, `::: danger` | `:::info`, `:::tip`, `:::warning`, `:::danger` | Same closing `:::` |
| `::: tip Title` | `:::tip Title` | |
| `::: details Title` | `+++ Title` | `{open}` after the title becomes `++> Title` |
| `::: danger {no-title}` | `:::danger` | Approximated: Leed always shows a heading |
| Nested containers with `::::` | `::::tip` around `:::info` | Leed nests the same way |
| `> [!NOTE]` | `:::note` | GitHub-style alert, in VitePress and in Nextra |
| `> [!TIP]` | `:::tip` | |
| `> [!IMPORTANT]` | `:::info` | Approximated |
| `> [!WARNING]` | `:::warning` | |
| `> [!CAUTION]` (and VitePress `[!DANGER]`) | `:::danger` | |
| `::: code-group` with fences titled `js [config.js]` | `===tabs-container` with one `@tab config.js` holding each fence, closed with `===` | The bracketed title becomes the tab label |
| A fence with `{1,4-6}`, `:line-numbers`, or `// [!code highlight]`, `focus`, `++`, `--`, `error` comments | fenced code with its language | Dropped: remove the comments from the code |
| `<<< @/snippets/file.js` (code import) | fenced code holding the file | Inlined; a `#region` takes that region only |
| `[[toc]]` | nothing | Leed's docs layout renders its own table of contents |
| `:tada:` emoji shortcodes | the emoji character | |
| `{#custom-id}` on a heading | heading | Dropped: Leed headings take their generated slug. Fix links to the old anchor |
| `<Badge type text>` and other Vue components | the text, or nothing | Report each component |
| Vue template syntax `{{ $frontmatter.x }}`, `v-for` | the value, written in, or nothing | Report it |
| `<Callout type="info">` (Nextra) | `:::info` | `warning` to `:::warning`, `error` to `:::danger`, `important` to `:::info`, `default` to `:::note` |
| `<Tabs items={['pnpm', 'npm']}>` with `<Tabs.Tab>` (Nextra) | `===tabs-container` with `@tab pnpm` and `@tab npm` | Labels come from `items` by position; `storageKey` becomes `{data-tabs-groupId="..."}` |
| `<Steps>` with `###` headings (Nextra) | the `###` headings, numbered by hand | Approximated; report it |
| `<Cards>` with `<Cards.Card title href>` (Nextra) | a list of links | Approximated; report it |
| `<FileTree>` (Nextra) | a `text` fence drawing the tree | Approximated |
| `<details><summary>Title</summary>` | `+++ Title` | |
| `import` lines and other JSX components (Nextra MDX) | nothing | Convert their text by hand or report each |
| `<iframe>` or a YouTube embed | `{% youtube videoId="..." %}` or `{% iframe src="..." %}` | |
| A `mermaid` fence (plugin) | a `mermaid` fence | |
| `$...$` and `$$...$$` math (plugin) | inline math and a `math` fence | Leed writes inline math in double backticks starting `math`, and block math as a fence whose language is `math` |

## Includes and reusable content

- **VitePress** `<!--@include: ./parts/intro.md-->` includes another file, optionally a line range (`{3,}`), a `#region` or a heading section. Inline it where it stands, convert it with the same table, and list it in the report. An HTML comment is otherwise stripped on import, so an include left unconverted would vanish silently.
- **Nextra** MDX imports of another `.mdx` file (`import Intro from './intro.mdx'`, then `<Intro />`) are inlined the same way.

## Frontmatter to page fields

| VitePress or Nextra | Leed |
|---|---|
| `title` | the page title; a leading `#` heading is removed from the body (SKILL.md step 4) |
| `description` | `summary` |
| `sidebarTitle` (Nextra) | the menu entry's name, set in the staged `menu.json` |
| `layout`, `hero`, `features` (VitePress home page) | not a docs page: report it; a marketing home page is built with `site-builder` |
| `outline`, `aside`, `prev`, `next`, `lastUpdated`, `editLink`, `navbar`, `sidebar`, `footer`, `pageClass`, `head` | dropped; report `head` entries |
| `asIndexPage` (Nextra) | the folder's first page |

## Assets

Images in `public/` are referenced from the root (`/logo.png`, with `base` in front on the built site); others sit beside the page and are referenced relatively. Nextra may also use `next/image` or imported images (`import shot from './shot.png'`). Resolve each to its file, upload it with `leed asset upload`, and write the returned markdown in its place.

## Redirects and old URLs

- Every page's old URL from its path, `base` and `cleanUrls` (VitePress), or its path under `content/` or `pages/` (Nextra). Alias each to its page; add both the `.html` and the clean form when the old site served both.
- VitePress `rewrites` change a page's URL from its file path: the old URL is the rewritten one. A parameter rule (`:pkg/:slug*`) is applied to each file to work out its URL.
- Nextra: `redirects()` in `next.config.mjs` returns `{ source, destination, permanent }` objects. Alias each fixed `source` to the page `destination` became. A source with a parameter or a pattern, and a destination on another host, are reported.
- Redirects set in the host (a `_redirects` or `vercel.json` file) are read the same way when they are in the copy.

## Theme

**VitePress.** The brand color is `--vp-c-brand-1` (with `--vp-c-brand-2` for hover and `--vp-c-brand-3`), set in `.vitepress/theme/custom.css`, sometimes with a `.dark` block. **Nextra.** The primary color is a hue and saturation: `color` on the `<Head>` component in Nextra 4, `color.hue` and `color.saturation` in Nextra 3's `theme.config.jsx`.

When tailoring is allowed, map the brand color to the brand accent token and its hover shade to the hover token; otherwise choose the nearest built-in `color-theme-*` (a Nextra hue of 212 is close to `color-theme-blue`). Custom Vue or React layouts, fonts and the rest of the custom CSS are not migrated: report them.

## Known gaps

- Code line highlighting, focus, diff and error markers, and line numbers.
- Untitled (`{no-title}`) containers and `[!IMPORTANT]` alerts, which become a titled info alert.
- Vue components and template syntax, and Nextra JSX components other than those mapped above.
- Nextra `<Steps>`, `<Cards>`, `<FileTree>` and separators in `_meta`.
- Custom heading ids and links to them.
- The VitePress home page layout (`hero`, `features`).
- Footer message and copyright text.
- Parameter and pattern redirects and rewrites that cannot be resolved to fixed paths, and redirects to other hosts.
- `locales` and i18n: only the default locale migrates.
