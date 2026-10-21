# Sandbox move: the command for each kind

Each step of `plan.mjs` creates or looks up one kind of record. A record marked `done` is already in the id map, made by an earlier run: skip it, never create it again. Run every command from the real site checkout (`<site>`) with `--json`, read the id from the result, and add it to the id map before the next step. Payloads are read from the sandbox, which by then has been rewritten through the previous steps, so they already carry real ids.

## The id map

`<scratch>/move-map.json`, outside both trees. One key per placeholder, plus one per staged image:

```json
{
  "ph-pt-2": "k3x9qa",
  "ph-page-10": "6fc4bc11-a51a-4855-bd5b-fc1ef32c2dd1",
  "/static/images/tmp/hero.png": {
    "src": "/cdn-cgi/imagedelivery/<hash>/<imageId>/original",
    "assetId": "<assetId>",
    "markdown": "![Hero =1200x630](/cdn-cgi/imagedelivery/<hash>/<imageId>/original){data-assetid=\"<assetId>\"}"
  }
}
```

A placeholder maps to the real id string. `rewrite.mjs` refuses the whole map, writing nothing, when a value is not a plain id, when a key is neither a placeholder nor a staged-image path, or when an image entry has no `src`. It reports any key it found nowhere under `unused`: check the spelling before going on.

## The filled list

`<scratch>/move-filled.json`, beside the map: a JSON array of the `ph-page-*` ids whose content the move has imported, one added as each page is filled (`["ph-page-3", "ph-page-10"]`). `plan.mjs --map --filled` marks those pages `filled`, and `check.mjs --map --filled` fails on any page in the map that is not in it, other than a template page (the home page, or any page a `.hbs` file names, which has no CMS record). A template page is never filled, so it never goes in the list.

## Page types (`pt`)

An `existing` one is the site's root page type: read its id with `leed settings pagetype list --json` (the one whose slug is empty) and map it. For each other page type, check `leed settings pagetype list --slug <slug> --json` first and map an existing one rather than creating a second. Otherwise write its `src/_data/pageTypeList.json` entry, plus the `requiredFields` its recipe names, to `<scratch>/<placeholder>.json` and create it:

```bash
leed settings pagetype create --type posts --from-file <scratch>/ph-pt-2.json --json
leed settings pagetype create --type documentation --from-file <scratch>/ph-pt-3.json --json
```

`--type` is `documentation` for a page type whose layout is `leed-documentation.hbs` and `posts` otherwise. Map `data.pageTypeId`. For a documentation page type, read what it was bound to and map the records the plan marks `createdWith` it:

```bash
leed settings pagetype get <pageTypeId> --json
```

`documentationConfiguration.menus.left` is its left menu (the sandbox's `navMenuId` and `menus.left`), and `documentationConfiguration.searchIndexId` its search index.

## Labels and authors (`label`, `author`)

```bash
leed settings label list --json
leed settings label create --name "<name>" --slug <slug> --json
leed settings user list --json
```

This step comes before the pages, so a page is created with its real labels. Map a label to an existing one with the same slug, else create it and map `data.labelId`. Map each author to the existing user with the same email. The CLI cannot create users: when nobody matches, ask the person (see the skill).

## Pages (`page`)

An `existing` page is the site's home page, the one `src/index.hbs` defines: map it to the `pageId` in the frontmatter of `<site>/src/index.hbs`, which the CMS minted when it provisioned the site, and never create it. A template page gets a local id instead ("Template pages" below). Each other `ph-page-*`, a Markdown page, is created now as a placeholder, so menus, autolinks and other pages have a real id to link to. Its content is filled in the last step. Labels and authors were mapped in the steps before this one, so the page is created with its real labels. Create documentation pages one at a time, never in parallel:

```bash
node "<skill dir>/scripts/page-fields.mjs" --root <sandbox> --file src/docs/install.md
leed page create --page-type-id <pageTypeId> --file <scratch>/ph-page-10.md --json
```

`page-fields.mjs` must exit 0. Write its `create.document` (a placeholder body under frontmatter holding the page's `title`, `slug`, `summary`, `labels` and `keywords`) to `<scratch>/<placeholder>.md` and create the page from it; the page type id is the real one its `pageTypeId` names. Map `data.pageId`. Everything else in the page's frontmatter is in `metadata.fields`, applied with `update_page_metadata` after the page is filled (the skill's step 5): `leed page create` drops those keys, and its warning naming them is expected. Creating a documentation page also appends it to its set's left menu, so the menu step only adds what is still missing there. Once a documentation set's starting page exists, set it:

```bash
leed settings pagetype set <pageTypeId> --documentation-configuration.starting-page <pageId> --json
```

### Template pages

A page the plan marks `template` is defined by a Handlebars file (`src/about.hbs`, `src/company/team.hbs`), not by Markdown. The template is the page: `copy-site.mjs` copies it into the checkout at its full path, and it renders at the URL that path gives (`/about/`, `/company/team/`). Leed handles it as provisioning does the pages it writes: its `pageId` is a v4 UUID minted locally, and **the CMS holds no record for it**. The build resolves a `pageid:` link, a menu item or an autolink to it from the pages it rendered, so nothing in the CMS is needed. Mint the ids before the first page is created:

```bash
node "<skill dir>/scripts/template-ids.mjs" --root <sandbox> --map <scratch>/move-map.json --dry-run
node "<skill dir>/scripts/template-ids.mjs" --root <sandbox> --map <scratch>/move-map.json
```

It writes the ids into the map; a page already mapped keeps its id. Never run `leed page create`, `reserve_page` or any other page write for a template page, in this step or the last. The home page is the exception the plan marks `existing`: it maps to the CMS home page, as above.

## Images and assets (`asset`)

Upload each staged image from the sandbox, one call per file:

```bash
leed asset upload <sandbox>/src/static/images/tmp/hero.png --json
```

Map its site path to `{ "src", "assetId", "markdown" }` from the result: `markdown` exactly as returned, `src` the link target inside `markdown` (the `/cdn-cgi/imagedelivery/…/original` path, never `url`), and `assetId`. A duplicate fails with `validation_failed` naming the existing asset: use that one. A `ph-asset-*` id maps to the `assetId` of the image the same record names (a menu item's `image.src`).

## Menus and menu items (`menu`, `menuitem`)

An `existing` menu is the site's Header or Footer menu, and a `createdWith` menu was made by its documentation page type: map both from `leed settings menu list --json`. Create any other menu by its name, and map `data.menuId`:

```bash
leed settings menu create --name "<name>" --json
leed settings menu get <menuId> --json
```

Add the items in order, parents before children, each with the revision the last write returned. An item whose `href` the menu already holds (a documentation page the CMS appended) is mapped to that item instead of added; move it under its folder with `leed settings menu move` when the sandbox nests it.

```bash
leed settings menu add <menuId> --base-revision <revision> --top-level --name "<name>" --href "<href>" --json
leed settings menu add <menuId> --base-revision <revision> --parent <menuItemId> --name "<name>" --href "<href>" --json
leed settings menu move <menuId> <menuItemId> --base-revision <revision> --parent <menuItemId> --json
```

Pass each `href` through the id map first: `pageid:ph-page-3` becomes `pageid:<the mapped pageId>`. A path that points at a moved page (`/`, `/blog/`) becomes that page's `pageid:` too, so the menu follows the page if its path changes; only external URLs keep their `href` as written. Map each `ph-menuitem-*` to the result's new item id. Items carry the sandbox's `title`, `target`, `description` and `icon` when they have them.

## Forms, search indexes, calls to action and autolinks

```bash
leed settings form list --json
leed settings form create --from-file <scratch>/ph-form-1.json --json
leed settings searchindex create --name "<name>" --page-type-ids '["<pageTypeId>"]' --json
leed settings autolink create --text "<text>" --page-id <pageId> --json
```

A form's payload starts from its `src/_data/leedForms.json` entry, but that is the shape the CMS publishes, not the one it creates from: add the two keys it leaves out, or the create answers 400 naming them in `error.issues`. They are `formName`, the name the form is listed under in the CMS (its `heading`, else its `formPrototype`), and a `formFieldId` on every field, unique within the form (the field's `name` serves). For the sandbox's subscribe form:

```json
{
  "formName": "Our Newsletter",
  "formPrototype": "subscribe-blog",
  "button": "Subscribe",
  "successCallback": "",
  "failureCallback": "",
  "leedAutofill": false,
  "heading": "Our Newsletter",
  "details": "Subscribe to receive our latest updates",
  "fields": [
    { "formFieldId": "email", "name": "email", "placeHolder": "Email", "required": true, "type": "email", "value": "" }
  ]
}
```

Map `data.formId`, and publish it with `leed settings form publish <formId> --json` once it is right. A search index the plan marks `createdWith` a page type is already mapped. Map `data.searchIndexId` and `data.autolinkId`. A `ph-cta-*` has no CLI command: ask the person to recreate it in the CMS, then map its id.

## Publishing what the steps left pending

Every create above leaves a pending change. Read them and publish only the ones this move made:

```bash
leed settings pending --json
leed settings publish <pendingId> --json
```

Never `--all`: other people's unpublished changes may be pending.
