---
name: site-sandbox-move
description: Moves a sandbox site — one built locally with `leed site init --sandbox`, before there was a Leed account — into a real Leed site. Creates the page types, labels, authors, pages, images, menus, forms, search indexes and autolinks the sandbox holds in the CMS in dependency order, replaces every ph-<kind>-<n> placeholder with the real id, copies the templates and CSS into the real site checkout, imports the content, and fails loudly if any placeholder is left. Use when someone has a sandbox site and now has a Leed account, or when a command answers sandbox_site.
---

# Site Sandbox Move Skill

You move a sandbox site into a real Leed site. A sandbox is a local copy of a Leed site with no CMS behind it, so someone could build and preview a whole site before they had an account. It is made by `leed site init --sandbox`, and you can tell one by its `identity.json`: `{"companyId":"non-cms-company","environment":"dev"}`. Every command that needs the CMS refuses in it with the code `sandbox_site`.

Every record in a sandbox — page type, page, label, author, menu, menu item, form, search index, call to action, autolink, asset — is named with a placeholder, `ph-<kind>-<n>` (`ph-pt-2`, `ph-page-10`). Images are files staged under `src/static/images/tmp/`, which the sandbox's `.gitignore` excludes, and pages and templates refer to them as `/static/images/tmp/<file>`. The move creates each record in the CMS, replaces each placeholder with the id the CMS returned, uploads each image and replaces its references, and only then copies the site's own files into the real checkout. **Nothing of the sandbox may reach the real site:** a placeholder left behind is a link, author or menu pointing at a record that does not exist.

The order is the CMS's own: page types, labels and authors, then a placeholder page per Markdown `ph-page-*` (a template page gets a local id instead), images, menus and their items, forms, search indexes, calls to action, autolinks — then the templates and CSS, then the content. `references/move-steps.md` has the command for every kind and the id map format.

## Before you start

1. **Signed in.** `leed auth status --json` must show a session for the company the site is moving into. If not, hand the person `! leed auth login` and wait.
2. **A real site checkout.** The move copies into the `raw-content` checkout of the company's site, which `/leed:setup` (`../setup/SKILL.md`) creates. Its `identity.json` names a real company. Never move into another sandbox, and never turn the sandbox itself into the checkout.
3. **Two paths:** the sandbox directory (`<sandbox>`) and the checkout (`<site>`). Find both with `leed site list --json`: the sandbox is the entry with `sandbox: true` (its `name` is its folder name, so the person can name it), the checkout the entry for the company with `sandbox: false`, and each `path` to use is the first in its `paths` with `exists: true`. `/leed:setup` records the real site there when it sets the site up; when the list has no real site, the person has not set one up yet. When the person names a sandbox that is not listed (one made by an older CLI), any `leed site` command run inside it, such as `leed --json site eject`, records it. Keep a scratch directory outside both for the move's record of its progress, the id map (`<scratch>/move-map.json`) and the filled list (`<scratch>/move-filled.json`), and for request payloads. Both files outlive every rewrite, and they are how a stopped move resumes. Run every `leed settings`, `leed page` and `leed asset` command from inside `<site>`, where it takes that site's company and environment: outside a checkout the CLI defaults neither, and refuses without `--company` and `-e`.
4. **The plan tier.** The sandbox unlocked every paid-plan template and style locally; the real company's plan applies from now on. Run `leed site eject --json` in `<site>` and keep the list: a template the sandbox ejected that is not in it cannot be kept, and the person must be told before you copy it (`../site-patterns/SKILL.md`, rule 13).

The scripts sit in this skill's `scripts/` directory (the base directory this file was loaded from). They are plain Node with no dependencies and no network access, print one JSON document, never follow a symlink, and write only inside the directories you name.

## 1. Inventory and plan

```bash
node "<skill dir>/scripts/inventory.mjs" --root <sandbox>
node "<skill dir>/scripts/plan.mjs" --root <sandbox>
```

`inventory.mjs` lists every placeholder and staged image: where it is defined and every file and line that uses it. `plan.mjs` puts them in steps. Both read only the site itself, `src/`, `tailwind/` and `leed-import/`, so a README or note beside it that mentions a placeholder does not change the plan. **Stop if `plan.mjs` exits 1**: each entry in `problems` is a placeholder nothing defines or a record that needs one created after it, and the move cannot satisfy either. Show the person the plan — how many of each kind, and which records are `existing` — before you create anything.

Four flags in the plan change what a step does:

- **`existing`**: every Leed site already has a root page type (slug `""`), a home page (`src/index.hbs`) and a Header and a Footer menu. Map these to the real ones; never create a second. The home page's real id is the `pageId` in the frontmatter of `<site>/src/index.hbs`.
- **`createdWith`**: creating a documentation page type creates its left menu and its search index. Map those from the new page type; never create them.
- **`template`**: a page defined by a Handlebars template (`src/about.hbs` naming a `ph-page-*` id) rather than by Markdown, other than the home page. The template is the page: it is copied into the checkout in step 4 and renders at its own URL. Leed handles it as provisioning does the pages it writes: its `pageId` is a UUID minted locally, and the CMS holds no record for it, because the build resolves `pageid:` links and menu items to it from the pages it rendered. Mint the ids in step 3 with `template-ids.mjs`; never create a CMS page for one and never fill one. A `.md` page is content: it is created in the CMS and filled in step 5.
- **`notes`**: a page's images, assets and forms are content, applied in the last step; a documentation page type's starting page is set once that page exists. A page's labels and authors are never in its notes: they are created before it.

## 2. Push the layouts

The CMS refuses a page type whose layout is not on the site's staging branch, so the layouts go first:

```bash
node "<skill dir>/scripts/copy-site.mjs" --from <sandbox> --to <site> --layouts
```

Then publish them from `<site>` with the site-publish workflow (`../site-publish/SKILL.md`): validate, build, commit and push. A layout listed under `held` still names a placeholder; it is copied with the rest in step 4.

## 3. Create the records, step by step

For each step in the plan, in order, skipping any record marked `done`: create (or, for `existing` and `createdWith`, look up) each record with the command `references/move-steps.md` gives for its kind, add `"<placeholder>": "<real id>"` to the id map, then rewrite the sandbox:

```bash
node "<skill dir>/scripts/rewrite.mjs" --root <sandbox> --map <scratch>/move-map.json --dry-run
node "<skill dir>/scripts/rewrite.mjs" --root <sandbox> --map <scratch>/move-map.json
```

Rewrite after every step, not once at the end: the next step's payloads are read from the sandbox, and they must already carry real ids (a menu item's `pageid:` link, a page type's `pageTypeIds`). The map only grows, and a rewrite is safe to repeat.

Work one record at a time and read each result before the next. A write that fails stops the move: report it, keep the map and the filled list, and once the cause is fixed resume from the first record not in the map. **Every plan after the first rewrite is run with both files:**

```bash
node "<skill dir>/scripts/plan.mjs" --root <sandbox> --map <scratch>/move-map.json --filled <scratch>/move-filled.json
```

A rewrite replaces each placeholder with its real id, so a plan without `--map` cannot tell a record an earlier run created from one still to create, and lists no page to fill. With it, every record the map names stays in its step marked **`done`**, with its `placeholder` and `realId`: **skip every `done` record, never create it again**, and start from the first record in the plan that is not `done`. Every page created in the page step is still in `import-content`, and a page already filled is marked `filled`. Never create a record twice: before each create, check whether an earlier run made it (the list commands in `references/move-steps.md`).

**A page carries its metadata in two parts.** `leed page create` applies only the `title`, `slug`, `summary`, `labels` and `keywords` of a piped document and drops every other key, and `leed page update` writes the body alone. So create each page from the document `page-fields.mjs` prints, never from a bare placeholder body:

```bash
node "<skill dir>/scripts/page-fields.mjs" --root <sandbox> --file <file>
```

It must exit 0: its `create.unresolved` lists any label or page type not yet mapped. Write `create.document` to `<scratch>/<placeholder>.md` and pass it with `--file` (`references/move-steps.md`, "Pages"). The rest of the page's frontmatter, its authors among it, is applied in step 5. It refuses a `template` page (exit 2): that page has no CMS record. Before the first page is created, give every template page its id:

```bash
node "<skill dir>/scripts/template-ids.mjs" --root <sandbox> --map <scratch>/move-map.json
```

It adds a v4 UUID to the map for each template page the map does not name yet, the id format provisioning uses, and leaves a mapped one as it is, so a re-run adds nothing. The rewrite after the page step writes the ids into the templates.

**Authors are users, and the CLI cannot create users.** Map each `ph-author-*` to an existing user by email from `leed settings user list --json`. When nobody matches, ask the person whether to invite them in the CMS (Team Members) first or to credit an existing user instead. Never invent a user id.

## 4. Check, then copy the site

```bash
node "<skill dir>/scripts/check.mjs" --root <sandbox>
```

**It must exit 0.** Exit 1 lists every placeholder and staged-image reference still in the sandbox, with its file and line: map each one and rewrite again. Do not copy anything while it fails. Then:

```bash
node "<skill dir>/scripts/copy-site.mjs" --from <sandbox> --to <site> --dry-run
node "<skill dir>/scripts/copy-site.mjs" --from <sandbox> --to <site>
```

It copies the Handlebars templates, `tailwind/` and the site's own `src/static/` files, and nothing the CMS owns: never `identity.json`, `src/_data/`, a `*.11tydata.json`, page content, the staged images, or Leed's generated files. Show the person the `overwritten` list from the dry run first: the sandbox's design replaces the starter templates. `held` must be empty. A template that replaces one naming a `pageId` keeps the real `pageId` and is listed under `keptPageId`; after the home page was mapped, that list should be empty, so report any entry to the person.

## 5. Import the content

The plan's `import-content` step lists two sets:

- **`pageFiles`**: pages that were created as placeholders in step 3; `pages` gives each one's file with its placeholder `id`. Fill each one not marked `filled`: `leed page update <pageId> --file <sandbox>/<file> --json`. The page has never been published, so the whole body can be replaced, unless someone has commented on it since the move created it (a resumed move): check first, by the rule below. That writes the body only, and its warning that the frontmatter was not applied is expected: the page's title, slug, summary and labels were set when it was created. Then run `page-fields.mjs` on the file again and apply its `metadata.fields` (`authors`, a `featureImage`, a `formId` and any other field) with the CMS MCP tool `update_page_metadata`, passing the `pageId` and those fields as they are. `metadata.unresolved` must be empty first. No `leed` command sets these fields: when the CMS MCP tools are missing, `leed mcp add --cms` adds them (`../setup/SKILL.md`, step 5); if the person declines, list each page with the authors and fields still to set in the page editor, and tell them before you finish. Once a page's body is written and its fields applied (or listed for the person), add its placeholder `id` to `<scratch>/move-filled.json`, a JSON array (`["ph-page-3"]`); create the file with the first page. Record each page as it is done, never in a batch at the end: it is what tells a resumed move, and the final check, which pages are still empty.
- **`importFiles`**: Leed Markdown waiting under `leed-import/`. Import each directory into its page type from `<site>`: `leed import markdown <sandbox>/leed-import/<dir> --page-type-id <pageTypeId> --json`, review it with `leed site build`, then `leed import apply --page-type-id <pageTypeId> --json`. `../site-builder/references/cli-commands.md` has the import workflow.

**Once a page has comments, write only suggestions.** Before writing to a page that already exists, read its open comment count: over MCP, `openCommentCount` from `get_page`; with the CLI, `data.counts.comments` from `leed page review <pageId> --include-types text,emoji --json`. Above zero, the person has read the draft and is reviewing it, so write only tracked suggestions, with `update_page_body` and `mode: "suggest"` or with `leed page update <pageId> --block <dataId> --suggest`, or stop and offer `/leed:review`. Never write in `direct` mode, never call `set_page_body` with `overwrite`, and never replace the whole body with `leed page update` without `--block`.

## 6. Finish

```bash
node "<skill dir>/scripts/check.mjs" --root <site> --map <scratch>/move-map.json --filled <scratch>/move-filled.json
```

It must exit 0: the real checkout holds no placeholder and no staged-image reference, and every page the map says was created is in the filled list. Its `unfilled` lists each page created as a placeholder that was never filled, an empty page in the CMS that no placeholder gives away: fill it as step 5 says, record it, and check again. A template page is never filled, so it is not counted: the home page, which is mapped, and every page a `.hbs` file in the checkout names, which has no CMS record. Then run `leed site build` in `<site>`, publish the settings each step left pending with `leed settings pending --json` and `leed settings publish <id>` (the ids this move created, never `--all`), and hand over to the site-publish skill to validate, commit, push and check staging. The sandbox stays where it was; tell the person it is no longer needed and that deleting it is theirs to do.

End with the review handoff for the pages the move filled:

**When the pages are written, hand them over for review.** This applies to pages written to the CMS; a sandbox has no editor. Tell the user:

1. Which pages were written, each with its editor link, `<CMS origin>/pages/<pageId>`, built from the page ids the writes returned. The CMS origin is the environment the site is on: `https://app.leed.ai` for production and `https://staging.app.leed.ai` for staging, read from `environment` in the CLI's results; over MCP alone, it is the origin of the CMS MCP server's URL.
2. That they can read and edit each page there, in the editor built for writing, and leave a comment on anything they want changed.
3. That they then say "review the comments on <page>", or run `/leed:review <page>`, and each comment is answered as a tracked suggestion they accept or reject in the editor.
4. For a user in more than one company: the link opens in the company that is active in their browser, so they switch to this site's company first.

## If Cloudflare blocks a request

Cloudflare's firewall sits in front of the Leed CMS and now and then mistakes legitimate content for an attack. When it does, the request never reaches Leed.

1. **Recognize it.** The CLI fails with `request_blocked` (exit `5`). An MCP tool call, or any other request to the CMS, comes back with a 403 and an HTML page ("Just a moment…" or "Attention Required"), `server: cloudflare` or a `cf-ray` value, and no JSON error. It is not a permissions problem: do not ask for a different role or sign in again.
2. **Stop.** Retry the same write at most once. Never alter, encode, split or obfuscate the user's content to get past the filter: the content is theirs, and the false positive is Leed's to fix.
3. **Report it.** From the CLI, run the `leed feedback blocked` command in the error's `hint`; it carries the ray id, method, path and time (add `--excerpt-base64` from `error.request` when it is there). From MCP, call `report_blocked_request` with the `rayId`, the time as `occurredAt`, the method and path if you know them, the tool name and its argument names written as `name=` with no value as `command` (for example `update_page_body pageId= ops=`), and at most 2 KB of the body base64-encoded as `excerptBase64`. Never put the blocked text itself in `command` or `note`: the report crosses the same firewall.
4. **Tell the user.** Say what was blocked (which page, setting or asset, and which command or tool) and give the ray id, then continue with the rest of the work.
