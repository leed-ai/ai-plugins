# The content model

What a Leed site is made of besides its templates. Every one of these is a CMS record: the build reads it from a `src/_data/` file, but the file is written by the CMS, and the next settings publish overwrites any edit made to it in the repo. Change them through the `/site-settings` skill (`leed settings …`), then `leed settings publish`.

Editing a `_data` file to preview a change locally is fine; revert it before committing.

| Record | What it is | Read it in | Change it with |
|---|---|---|---|
| Page type | A kind of page (posts, documentation, API, root): its slug, its layout, its labels, whether it renders, its documentation configuration | `src/_data/pageTypeList.json` | `leed settings pagetype create`, `set` |
| Label | A tag on pages; can be a series. Also used for assets | `src/_data/labelList.json` | `leed settings label create`, `set` |
| Autolink | A phrase the build links to a page wherever it appears in content | `src/_data/autolink.json` | `leed settings autolink create`, `set`, `delete`, `reorder` |
| Search index | The page types one search covers | `src/_data/searchIndexList.json` | `leed settings searchindex create`, `set` |
| Docs set | A documentation (or API) page type with its configuration — theme, layout, header, left-nav menu | `src/_data/pageTypeList.json` | `leed settings pagetype create --type documentation`, then `pagetype set` |
| Menu | A tree of items, each with a `pageid:` target, a name, an optional icon, image and description | `src/_data/menu.json`, keyed by menu name | `leed settings menu create`, then `add`, `set`, `move`, `remove`, `reorder` |
| Form | Fields, buttons, callbacks, follow-up email | `src/_data/leedForms.json`, keyed by form id | `leed settings form create`, `set`, `publish` |
| Author | A user's public profile | `src/_data/userList.json` | `leed settings user set` |
| Company settings | Site title, locale, timezone, date format, paging size, highlighter languages, documentation defaults | `src/src.11tydata.json` | `leed settings company set` |

## How templates use them

- **Page types** are named by **id** in collection names (`collections.pageTypeId-<id>:paged`) — an id never changes, a slug can. See `references/collections-and-loops.md`.
- **Labels** are ids on a page (`this.data.labels`); render them with `{{#Labels this true}}`, look one up with `{{ label <id> 'name' }}`. A label's archive page comes from the `:labels` collection, never a hand-made page per label. See `references/authors-and-label-pages.md`.
- **Autolinks** need no template work: the build applies them to content. Do not hand-link a phrase an autolink already covers.
- **Search indexes**: creating a documentation or API page type makes one named after it. Create one only for a second index or one spanning several sets. A docs header renders search with `leed/docs/document-search` (see `references/forms-and-widgets.md`).
- **Docs sets**: a docs page's URL comes from its place in the set's left-nav menu, so that menu cannot be deleted while it is bound. The set's color theme names a `color-theme-<name>` utility the site may define (see `references/theming.md`).
- **Menus** render only through `leed/menu/builder`, by name. See `references/menus.md`.
- **Forms** render only through `leed/form`, by id. See `references/forms-and-widgets.md`.

## New sites

A new site starts with only the Root page type, laid out with `empty.hbs`. Every further page type — a blog, a documentation set — is created in the CMS, and its layout must exist in the repo before the page type can name it. See `references/layouts-and-page-types.md`.

The full command reference, with flags and the JSON each returns, is `../site-builder/references/cli-commands.md` under "CMS Settings".
