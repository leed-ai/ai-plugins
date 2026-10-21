# Recipe format

A recipe is a folder under the plugin's `recipes/` directory (`../../recipes/` from the create skill's directory), named after the recipe:

```
recipes/<name>/
├── recipe.json     the page type, the steps and the file list
├── files/          starter files, copied into the site checkout
└── styles.css      optional: the recipe's stylesheet, brand tokens only
```

Every file in the folder is named by `recipe.json`; nothing else is copied.

## `recipe.json`

| Key | What it holds |
|---|---|
| `name` | The recipe's name, the same as its folder. `/leed:create <name>` runs it |
| `title`, `description` | What the no-argument listing shows |
| `requires` | What the recipe needs: `cli` (the Leed CLI), `site-repo` (the site checkout as the working directory), or `cli-or-mcp` (the CLI or the CMS MCP tools, no checkout), and optionally `tier:<plan>` (see below) |
| `pageType` | Optional: omitted by a recipe that changes existing page types rather than creating one |
| `pageType.type` | The page type's kind (`posts`, `documentation`). It goes in `--type`, not in the payload |
| `pageType.payload` | Every other field of the page type, set explicitly. It is written to a file and passed with `leed settings pagetype create --from-file`, or sent as the `create_page_type` arguments |
| `constants` | Fixed values the steps and files use, e.g. `separator` for `###SEPARATOR###` |
| `placeholders` | Optional. Placeholders this recipe uses beyond the three common ones, as `{ "###NAME###": "what replaces it" }` |
| `styles` | Optional. `source` (in the recipe), `target` (in the site), `importInto` (the stylesheet that imports it) and `import` (the exact line to add, once) |
| `files[]` | Starter files: `source` in the recipe, `target` in the site (or `null` for a file a step reads rather than copies), and `phase`: `before-create`, `after-create` or `snippet` (see Phases) |
| `features` | Optional parts the user can choose. Each has a `description`, a `default` (`true` means it is included unless the user says no), its own `files[]` and, optionally, its own `styles` (the same shape as the top-level key) |
| `companyDocumentationDefaults` | Documentation recipes only: the company `documentationConfiguration` keys to fill in when the company has none |
| `steps[]` | The steps, in the order they run |

### Steps

| Key | What it holds |
|---|---|
| `id` | The step's name. Other steps refer to it (`skip create-page-type`) |
| `title` | One line to tell the user |
| `needsRepo` | `true` when the step reads or writes the site checkout, so the working directory must be its root |
| `cli` | The commands the step runs, in order. `<…>` marks a value an earlier step returned |
| `mcp` | The CMS MCP tool or tools that do the same, or `null` when the step writes repo files and needs the CLI |
| `do` | What to do, in order, including when to skip the step. This is the whole of the step: do nothing it does not say |
| `feature` | Optional: the feature the step belongs to. It runs only when that feature is chosen. When such a step's `mcp` is `null` and the run has no CLI or no checkout, the feature is turned off with a note to the user instead of stopping the recipe |

### Plan requirement: `tier:<plan>`

A recipe for a feature that only some plans include lists `tier:<plan>` in `requires`, e.g. `tier:growth`. The plans, lowest first, are `free`, `starter`, `growth` and `enterprise`. The site's plan is `data.tier` from `leed site eject --json`, run in the checkout; `null` counts as Free, and so does a run over MCP with no checkout. Below the required plan the recipe does not run at all: `/leed:create` says what the plan includes and stops before the first step, writing nothing.

### Phases

`before-create` files are what the page type needs to exist first, such as the layout the CMS checks for on the staging branch. They are written, committed and pushed before the page type is created, and on a re-run against an existing page type they are still written when missing, because its list pages need them too.

`after-create` files need the new page type's id, so they are written after `create-page-type`, with the placeholders replaced.

A recipe that creates no page type has no `create-page-type` step, so every file it copies is `before-create`.

`snippet` files are never copied. A step reads one and inserts its text into a file the site already has, such as a layout or `header-includes.hbs`, once, at the place its `do` list names.

## Placeholders

Three placeholders are common to every recipe, and a recipe may declare more in its `placeholders` key. No other placeholder appears in recipe files, in a file's content or in a `target`:

| Placeholder | Replaced with |
|---|---|
| `###PAGE_TYPE_ID###` | The `pageTypeId` that `create-page-type` returned, or the existing page type's id on a resumed run |
| `###NEW_SHORT_ID###` | A fresh 8-character lowercase hex id, a different one for each file. It is the page's `pageId`, which must be unique across the site |
| `###SEPARATOR###` | `constants.separator` |

The page type's name and slug are written out in the files, not substituted: a recipe makes one page type with a known slug.

## Adding a recipe

Write the payload in full, field by field, rather than relying on the CMS's create defaults. Follow every site-patterns rule in the starter files and the stylesheet (`../site-patterns/SKILL.md`): colors from tokens only, Leed's components for pagination and recommendations, `pageid:` links, and Leed collections for every list.
