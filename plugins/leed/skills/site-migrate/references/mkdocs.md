# MkDocs and Material for MkDocs to Leed

How an MkDocs site, usually with the Material for MkDocs theme and the PyMdown Extensions, maps onto a Leed documentation set. Read it with `../SKILL.md`, which owns the order of the steps; this file owns what each MkDocs construct becomes. Read `markdown_extensions` in `mkdocs.yml` first: a construct below exists in the source only when its extension is enabled.

## Sources

- Configuration (`nav`, `docs_dir`, `use_directory_urls`, `extra_css`): https://www.mkdocs.org/user-guide/configuration/
- Writing docs and file layout: https://www.mkdocs.org/user-guide/writing-your-docs/
- Admonitions and collapsible blocks: https://squidfunk.github.io/mkdocs-material/reference/admonitions/
- Content tabs: https://squidfunk.github.io/mkdocs-material/reference/content-tabs/
- Code blocks: https://squidfunk.github.io/mkdocs-material/reference/code-blocks/
- Colors: https://squidfunk.github.io/mkdocs-material/setup/changing-the-colors/
- Footer: https://squidfunk.github.io/mkdocs-material/setup/setting-up-the-footer/
- Navigation features: https://squidfunk.github.io/mkdocs-material/setup/setting-up-navigation/
- Snippets: https://facelessuser.github.io/pymdown-extensions/extensions/snippets/
- Redirects plugin: https://github.com/mkdocs/mkdocs-redirects

## Layout and config

| File | Holds |
|---|---|
| `mkdocs.yml` | `site_url`, `docs_dir` (default `docs`), `nav`, `theme` (name, `features`, `palette`, `logo`), `extra` (`social`), `extra_css`, `copyright`, `markdown_extensions`, `plugins` (`redirects`, `awesome-pages`, `i18n`) |
| `docs/` | the pages, `.md`; images and other files live beside them |
| `docs/stylesheets/*.css` | listed in `extra_css`; color overrides |
| `overrides/` | theme template overrides (`custom_dir`); not migrated |
| `.pages` files | navigation for the `awesome-pages` plugin, when used |

With `use_directory_urls: true` (the default) `guide/setup.md` is served at `/guide/setup/`, and `guide/index.md` (or `README.md`) at `/guide/`. With `false` they are `/guide/setup.html` and `/guide/index.html`.

## Navigation to menus

- **`nav` present.** Walk it in order. A section (`- Guide:` with a list under it) becomes a folder named by its title; `- Title: path.md` a page with that menu label; a bare `- path.md` a page labeled by its title. An entry whose value is a URL is an external link: report it, or add it to the top menu when the user wants it.
- **No `nav`.** MkDocs lists every Markdown file alphabetically, folder by folder, with index files first. Mirror that order, and labels from each page's title. When the `awesome-pages` plugin is enabled, its `.pages` files set the order and titles instead.
- **Section index pages.** With the Material `navigation.indexes` feature, a section's `index.md` is the section's own page. Leed folders cannot be links: make it the first page in the folder and alias the section URL to it.
- `navigation.tabs` puts top-level sections in a tab bar: they stay top-level folders of the docs menu. Report it only if the user wants the tabs as the top menu instead.

## Header and footer

- MkDocs has no navbar of links apart from `navigation.tabs` and `repo_url`. Offer a top-menu item for `repo_url` (the repository link the header shows) when the user wants it.
- `extra.social` links (icon and link) become the **bottom** menu, one item each, named from `name` or the link's domain; the icon is not carried. `copyright` is not a menu item: report it.
- `navigation.footer` (previous and next links) needs nothing: Leed's docs layout renders its own. `extra.generator` has no equivalent.

## Markdown dialect

| Source | Leed | Notes |
|---|---|---|
| `!!! note`, `!!! tip`, `!!! info`, `!!! warning`, `!!! danger` | `:::note`, `:::tip`, `:::info`, `:::warning`, `:::danger` | Unindent the four-space body; close with `:::` |
| `!!! note "Custom title"` | `:::note Custom title` | Markdown in the title becomes plain text |
| `!!! note ""` (no title) | `:::note` | Approximated: Leed always shows a heading |
| `!!! abstract`, `!!! example`, `!!! quote` | `:::note` | Approximated; report the type |
| `!!! success`, `!!! question` | `:::tip` | Approximated; report the type |
| `!!! failure`, `!!! bug` | `:::danger` | Approximated; report the type |
| `!!! tip inline`, `inline end` | `:::tip` | The float is dropped |
| `??? note "Title"` | `+++ Title` | Collapsible; the note type and its color are lost, so report it |
| `???+ note "Title"` | `++> Title` | Collapsible, open by default |
| `=== "Tab"` blocks | `===tabs-container` with `@tab Tab` | Unindent each tab's body; close the group with `===` |
| Linked tabs (`content.tabs.link`) | `===tabs-container {data-tabs-groupId="..."}` | Give every group with the same labels one group id |
| Fenced code with a language | fenced code with the same language | |
| `title="file.py"` in the fence | fenced code | Approximated: the title becomes the sentence before the block |
| `hl_lines="2 3"`, `linenums="1"`, code annotations `# (1)` | fenced code | Dropped: remove annotation markers and turn their list into prose after the block |
| `pymdownx.superfences` `mermaid` fence | a `mermaid` fence | Same |
| `pymdownx.arithmatex` `$...$`, `$$...$$` | inline math and a `math` fence | Leed writes inline math in double backticks starting `math`, and block math as a fence whose language is `math` |
| `pymdownx.details` `<details>` HTML | `+++ Title` | |
| `==mark==`, `^^insert^^`, `~~del~~`, `H~2~O`, `x^2^` | `==mark==`, `~~del~~`, `H~2~O`, `x^2^` | Same, except `^^insert^^`: write it as plain text and report it |
| `++ctrl+alt+del++` (`pymdownx.keys`) | `[[Ctrl]] + [[Alt]] + [[Del]]` | |
| `:material-check:`, `:fontawesome-brands-github:` icons and `:smile:` emoji | `{% icon fa-brands fa-github %}` or the emoji character | An icon with no Font Awesome match is dropped; report it |
| `- [ ]`, `- [x]` task lists | `- [ ]`, `- [x]` | Same |
| `{ .class }` and `{ #id }` (`attr_list`) | nothing | Classes are dropped from a CMS page body, and ids everywhere |
| `markdown="1"` blocks and grids (`md_in_html`, `.grid.cards`) | a list of `pageid:` links, or plain sections | Approximated; report it |
| Footnotes `[^1]` | numbered notes at the end of the page | Approximated; report it |
| Abbreviations `*[HTML]: ...` | nothing | Dropped; report it |
| `<iframe>` (YouTube or other) | `{% youtube videoId="..." %}` or `{% iframe src="..." %}` | |

## Includes and reusable content

- **Snippets** (`pymdownx.snippets`): a line `--8<-- "path"` (or a block of paths between two `--8<--` lines) includes another file, resolved against the `base_path` list. Inline the file, honoring line ranges (`file.md:4:6`) and named sections, then convert it. A path starting with `;` is commented out: skip it. A URL snippet is not fetched: report it.
- `extra` variables with the macros plugin (`{{ config.extra.x }}`) are substituted by hand from `mkdocs.yml` and reported.
- An abbreviations glossary auto-appended with `snippets.auto_append` is dropped and reported.

## Frontmatter to page fields

| MkDocs | Leed |
|---|---|
| `title` | the page title; a leading `#` heading is removed from the body (SKILL.md step 4) |
| `description` | `summary` |
| `tags` (tags plugin) | dropped by the bulk import, which stores only `title` and `summary`; report each page's tags so the user can set them as keywords or labels in the CMS |
| `hide: [navigation, toc, footer]`, `template`, `icon`, `status`, `search: exclude` | dropped; report each |

## Assets

Images are files under `docs/`, referenced relative to the page (`../img/x.png`) or to the docs root. Resolve each to its file, upload it with `leed asset upload`, and write the returned markdown in its place. `{ width="300" }` after an image becomes Leed's size (`![alt =300x](...)`); `align=left` and `loading=lazy` are dropped. An image followed by a `<figcaption>` (Material's figure pattern) becomes an image with a caption title.

## Redirects and old URLs

- Every page's old URL from its path and `use_directory_urls`, under `site_url`'s path. Alias each to its page; with directory URLs add the form with a trailing slash.
- `plugins: redirects: redirect_maps:` maps an old `.md` path to a new `.md` path or an external URL. Turn the old path into its URL form and alias it to the page the new path became. An external target cannot be an alias: report it.

## Theme

Material's `theme.palette` names `primary` and `accent` colors (`indigo` by default) per `scheme` (`default` light, `slate` dark). With `primary: custom`, the colors are `--md-primary-fg-color` and `--md-accent-fg-color` in an `extra_css` file. When tailoring is allowed, map primary to the brand accent token and accent to its hover token; otherwise the named Material color usually has a built-in Leed theme of the same name (`indigo`, `teal`, `amber`), so choose `color-theme-<that name>`. `theme.font`, `overrides/` templates and the rest of `extra_css` are not migrated: report them.

## Known gaps

- Admonition types other than the five Leed alert types, untitled admonitions and inline admonitions.
- The note type of a collapsible `???` block.
- Code block titles, line highlighting, line numbers and code annotations.
- `attr_list` classes and ids, `md_in_html` blocks, grids and card grids.
- Footnotes, abbreviations, `^^insert^^` and icons with no Font Awesome equivalent.
- URL snippets, macros and auto-appended snippets.
- External `nav` entries, `copyright`, social icons, `overrides/` templates and fonts.
- Redirects to external URLs.
- Translations (the `i18n` plugin) and versions (`mike`): only the default locale and current version migrate.
