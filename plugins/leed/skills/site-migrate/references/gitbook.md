# GitBook to Leed

How a GitBook space maps onto a Leed documentation set. Read it with `../SKILL.md`, which owns the order of the steps; this file owns what each GitBook construct becomes.

**The source must be files.** Work from a repository that GitBook's Git Sync writes, or from a Markdown export of the space. A space with no Git Sync has to be synced to a repository, or exported, by the user first. Each GitBook space is migrated on its own; a site that combines several spaces becomes one docs set with a top-level folder per space, or one set per space, as the user chooses.

## Sources

- Git Sync content configuration (`.gitbook.yaml`, `SUMMARY.md`, redirects): https://gitbook.com/docs/docs-as-code/git-sync/content-configuration
- Writing docs in GitBook Markdown (blocks, front matter, `.gitbook/assets/`, `.gitbook/includes/`): https://gitbook.com/docs/skill/write-docs.md
- Code blocks: https://gitbook.com/docs/create-content/blocks/code-block.md
- Tabs: https://gitbook.com/docs/create-content/blocks/tabs.md
- Embeds: https://gitbook.com/docs/create-content/blocks/embed-a-url.md
- Page links: https://gitbook.com/docs/create-content/blocks/page-link.md
- Reusable content: https://gitbook.com/docs/creating-content/reusable-content.md

## Layout and config

| File | Holds |
|---|---|
| `.gitbook.yaml` | `root` (the content folder, default the repository root), `structure.readme` (the first page, default `README.md`), `structure.summary` (the table of contents, default `SUMMARY.md`), `redirects` |
| `SUMMARY.md` | the navigation: `##` headings are page groups, list items are pages, indented items are child pages |
| `README.md` | the space's first page |
| `.gitbook/assets/` | images and files the space uses |
| `.gitbook/includes/` | reusable content blocks, one Markdown file each |
| `.gitbook/vars.yaml` | space variables |

All paths in `.gitbook.yaml` are relative to `root`. A page's URL is its path in `SUMMARY.md` order: the file path without `.md`, with `README.md` standing for its folder.

## Navigation to menus

- Walk `SUMMARY.md` top to bottom. Each `##` group heading becomes a top-level folder named by the heading; each list item a page, labeled with the link text (or the quoted link title, `[Page](page.md "Label")`, when one is given). An indented item is a child page.
- **A page with children.** In GitBook a page can have both content and child pages. Leed folders cannot be links: make a folder named after the page, put the page first inside it, then its children, and alias the parent's old URL to that first page.
- With no `SUMMARY.md`, GitBook infers the order from the folders: do the same, folders and files in name order, `README.md` first.
- A page whose front matter has `hidden: true` is out of GitBook's navigation. A Leed docs page takes its URL from its place in the menu, so ask the user whether to migrate it into the menu or leave it out, and report the choice.
- A list item linking to an external URL is reported, or added to the top menu when the user wants it.

## Header and footer

GitBook keeps the site header links, the site sections and variants and the footer in the GitBook app, not in the repository. Ask the user for the header links and footer links (or a screenshot of them), then build the **top** and **bottom** menus from what they give. Header links that point at another space become links to that space's migrated pages (`pageid:`) or full URLs. Report the space switcher, the variant switcher and the footer's copyright text.

## Markdown dialect

| Source | Leed | Notes |
|---|---|---|
| `{% hint style="info" %}` ... `{% endhint %}` | `:::info` ... `:::` | |
| `{% hint style="success" %}` | `:::tip` | Approximated |
| `{% hint style="warning" %}` | `:::warning` | |
| `{% hint style="danger" %}` | `:::danger` | |
| A first `**bold**` line in a hint | `:::<type> Title`, keeping the type the hint's `style` maps to above | Used as the alert title when it reads like one; a `danger` hint stays `:::danger Title` |
| `{% tabs %}` with `{% tab title="Windows" %}` ... `{% endtab %}` ... `{% endtabs %}` | `===tabs-container` with `@tab Windows`, closed with `===` | The tab `icon` is dropped |
| `{% code title="index.js" overflow="wrap" lineNumbers="true" %}` around a fence ... `{% endcode %}` | fenced code with its language | Approximated: the title becomes the sentence before the block; `overflow` and `lineNumbers` are dropped |
| `{% stepper %}` with `{% step %}` blocks | a numbered list, or one `###` heading per step | Approximated; report it |
| `<details><summary>Title</summary>` (expandable) | `+++ Title` | |
| `{% embed url="..." %}` for a YouTube video | `{% youtube videoId="..." %}` | Take the id from the URL |
| `{% embed url="..." %}` for anything else | `{% iframe src="..." %}` or a plain link | A page that refuses framing (most sites) is better as a link with its caption; report it |
| `{% content-ref url="page.md" %}` ... `{% endcontent-ref %}` | a link to `pageid:<uuid>` | Written as a link in step 4 and rewritten in step 6 |
| `{% file src=".gitbook/assets/x.pdf" %}` | a link to the uploaded document | Use the `markdown` `leed asset upload` returns |
| `<figure><img src alt><figcaption>Caption</figcaption></figure>` | `![alt](...)` with a caption title | Leed's caption is the image title |
| `<table data-view="cards">` | a list of `pageid:` links, or a plain table | Approximated; report it |
| `{% columns %}` with `{% column %}` | the columns one after the other | Approximated; report it |
| `<a class="button">` | a plain link | Approximated |
| `{% updates %}` | plain sections, newest first | Approximated; report it |
| `<code class="expression">space.vars.x</code>` | the variable's value, written in | Read it from `.gitbook/vars.yaml` or the page's `vars`; report it |
| `$$...$$` math | a `math` fence | |
| A `mermaid` fence | a `mermaid` fence | |
| OpenAPI blocks (`{% openapi %}`, `{% openapi-operation %}`) | nothing | Report it: an API reference goes into a Leed API docs set with `leed import openapi` when the user has the spec |

## Includes and reusable content

`{% include "../.gitbook/includes/name.md" %}` places a reusable block. The path is relative to the page. Inline the block's file where the include stands, convert it with the same table, and list each in the report with the pages that now hold a copy. Reusable content synced across spaces is inlined the same way.

## Frontmatter to page fields

| GitBook | Leed |
|---|---|
| The page's first `#` heading | the page title: write it to front-matter `title` and remove the heading from the body, or the page shows its title twice |
| `description` | `summary` |
| `icon` | dropped; report it |
| `hidden` | the user's choice (see Navigation to menus); report it |
| `layout` (`width`, `title`, `description`, `tableOfContents`, `outline`, `pagination`) | dropped |
| `vars` | substituted into the text where used |
| `cover`, `coverY` | dropped; report the cover image |

## Assets

Images and files are in `.gitbook/assets/`, referenced from pages with relative paths (`../.gitbook/assets/image.png`), often with spaces or `(1)` suffixes in their names. Upload the folder with `leed asset upload` (prepare with `--type image --recursive`, then `--save`), map each referenced file to its returned markdown, and leave unreferenced files out unless the user wants them. A `<img>` `width` is dropped and reported: the image keeps the file's own width and height from the returned markdown.

## Redirects and old URLs

- Every page's old URL from its path (`folder/page.md` is `/folder/page`, `folder/README.md` is `/folder`), under the space's or site section's prefix, which the user gives you. Alias each to its page.
- `.gitbook.yaml` `redirects` maps an old path to a file, relative to `root`: alias the old path to the page that file became.
- Site-level redirects set in the GitBook app are not in the repository: ask the user for them, and report any whose target is not a migrated page.

## Theme

GitBook's primary color, tint, theme and fonts are site customization settings held in the GitBook app, and which of them a space can set depends on its GitBook plan. Ask the user for the primary color (a hex value). When tailoring is allowed on Leed, map it to the brand accent token; otherwise choose the nearest built-in `color-theme-*`. Fonts, the header style and the logo are not migrated by this skill: report them.

## Known gaps

- Header links, site sections, variants and the footer, which live in the GitBook app and must come from the user.
- `{% stepper %}`, `{% columns %}`, card tables, buttons and `{% updates %}`.
- Code block titles, wrapping and line numbers.
- Embeds of sites that refuse framing.
- Expressions and variables, which are written in as fixed text.
- OpenAPI blocks.
- Page icons, covers and layout options.
- Site-level redirects held in the GitBook app.
- Spaces other than the one migrated, and GitBook's per-variant content.
