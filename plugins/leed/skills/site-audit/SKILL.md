---
name: site-audit
description: Audits a Leed site against the site-patterns rules and proposes a fix for every finding, each naming its rule and file:line (or CMS record). Read-only — it never changes a file or a setting without the user's go-ahead. Use when asked to audit, review or check a Leed site, before publishing, when site-publish asks for an audit of changed files, or before deciding a file is unused.
---

# Site Audit Skill

You check a Leed site against the rules in `../site-patterns/SKILL.md` and report what breaks them, with a concrete fix for each finding. The rules live there; this skill only finds where a site departs from them. Cite a rule by its number and bold title, and read its detail file in `../site-patterns/references/` before you explain or fix it. Where this skill seems to disagree with site-patterns, site-patterns wins.

## The audit is read-only

- **Never change anything while auditing.** No file edits, no `leed settings … create|set|delete`, no CMS write tools, no `leed site commit` or `push`.
- **Propose, then wait.** Every finding carries a proposed fix. Apply one only after the user says yes to that fix (or to a list of them that they have seen), and apply it through the normal route: templates and CSS with the `/site-builder` skill, CMS records with the `/site-settings` skill.
- **A page whose body the CMS manages is changed in the CMS**, not in its `.hbs` file: the next publication overwrites a repo edit. The script marks findings in page files (outside `_includes` and `_layouts`, with a `pageId`) `"where": "page"`; before proposing a file edit for one, check whether the CMS manages that page's body.

## Out of scope

Two kinds of file are never audited, by the script or by your own judgment checks, and never reported, not even as unreferenced:

- **`leed-*.hbs` templates, at any depth** (`src/leed-sitemap.hbs`, `src/_layouts/leed-documentation.hbs`), and everything in `src/_includes/leed/`. The CLI copies them in for each build and removes them afterwards; the site does not own them, and a fix there would be overwritten by the next build. A `leed-*.md` page is not one of them: it is the site's own content.
- **Everything in an `_archive` folder, at any depth.** Eleventy ignores `**/_archive/**`, so nothing there is built. A partial or layout that only archived files use counts as unreferenced.

## Choose the mode

| Mode | When | What it checks |
|---|---|---|
| Repo | The working directory is a site checkout: it has `src/`, and `identity.json` is in it or in a folder above it | Templates and CSS (the script, then the judgment checks), plus the CMS checks |
| CMS only | No checkout, but the Leed CMS MCP tools or the `leed` CLI are available | The CMS checks only. Say that templates and CSS were not checked |
| Changed files | `site-publish` asks for an audit of the files a push changed | The script's per-file checks on those files only |

## Repo mode

### 1. Run the script

`scripts/audit.mjs` sits in this skill's directory (the base directory this file was loaded from). It is plain Node with no dependencies and no network access, it only reads files, and it runs with `node` or `bun`. Run it from the site root:

```bash
# {appRoot}: resolve it exactly as ../site-patterns/SKILL.md says (the installed CLI's dist/)
leed site eject --json | node "<skill dir>/scripts/audit.mjs" --app-root "<appRoot>" --eject-json - --json
```

- `--eject-json -` reads `leed site eject --json` from stdin. That listing is the site's plan tier (rule 13): suggest ejecting only templates it lists, as `ejectable` in the output. If the command fails (not signed in, offline), run the script without `--eject-json`, and say that the tier was unknown so no eject suggestion was made.
- `--app-root` lets the script check every `--site-*` name against Leed's token reference and the layouts Leed provides. Without it those checks are skipped with a note; say so.
- Exit status: `0` no `error` finding, `1` at least one, `2` a usage error (not a site repo, unreadable eject JSON).

The JSON has `findings` (each with `rule`, `title`, `check`, `severity`, `file`, `line`, `lines`, `message`, `fix`), `justified`, `ejectable`, `tier`, `notes` and `summary`. A `line` of `0` means the finding is about the whole file. What each `check` matches, and how to mark a justified exception, is in `references/checks.md`.

### 2. Judge what the script cannot settle

The script finds patterns. These need you to read the code:

- **Justified entries.** An entry whose `check` is `hand-filtered-collection` is a custom loop (rule 7), with the comment above it in `comment`. Read the comment against `../site-patterns/references/collections-and-loops.md`: a selection the built-in collections cannot express (iterating a page's own list of label ids from its frontmatter, for example) is fine; a comment that only restates the loop is not, so report it as a rule 7 finding. Any other entry comes from a `site-audit: allow <check>` comment: judge its reason against that check's rule the same way.
- **Image sizes (rule 6).** For each `image-variant` finding, and each `ImageTag`, `FeatureImage` or `Image` in a card, grid or loop, work out the widest the container can ever be and check the variant against `../site-patterns/references/links-and-images.md`.
- **Header height (rule 12).** The script flags hand-set and self-sized headers. Also check that a fixed header has the measuring script and that layouts offset with `mt-(--height-header)`, per `../site-patterns/references/css-layers.md`.
- **Cascade layers (rule 10).** For each `important` and `unlayered-import` finding marked `review`, find the Leed `!important` or inline style it answers in `{appRoot}/static/tailwind/`. If there is none, it is a finding.
- **Layouts (rule 8).** Each layout in `src/_layouts/` should open with a comment listing the frontmatter fields it reads, and no page should hand-write hero, table or row markup.
- **Forms, CTAs, recommendations, pagination and search (rules 2–4).** Look for hand-built forms, CTA blocks, recommendation lists, pagers, progress bars and search boxes where the Leed component exists.
- **Head content (rule 14).** A `site-wide-head` finding in a layout is for review: keep the tag there only when that page type alone needs it, and otherwise propose moving it to `src/_includes/header-includes.hbs`. Also look in `site-template.hbs` and the layouts for any other tag every page needs that the script does not recognize (a consent manager, a chat widget loaded on every page): it belongs in `header-includes.hbs` too, per `../site-patterns/references/layouts-and-page-types.md`.
- **Unreferenced files (rule 13).** An `unreferenced` finding means nothing in the repo or the build names the file. It is never proof the file is unused: say "nothing references this", and never propose deleting it without the site owner's say-so. Rule 13 lists the files the build uses that nothing references; the script already keeps those out.

### 3. Run the CMS checks

Run the checks in "CMS-only mode" below too. In a checkout the same records are in `src/_data/` (see `../site-patterns/references/content-model.md`), but those files can be behind the CMS, so prefer the CMS tools or `leed settings … list --json`.

## CMS-only mode

Use read tools only: the Leed CMS MCP tools `list_page_types`, `get_page_type`, `list_labels`, `list_menus`, `get_menu`, `list_pages`, `list_search_indexes` and `list_autolinks`, or their CLI equivalents `leed settings pagetype list`, `label list`, `menu list`, `menu get`, `searchindex list` and `autolink list`, each with `--json`. When the MCP tools are missing, use the CLI and tell the user once that `leed mcp add --cms` adds them.

| Check | How | Rule |
|---|---|---|
| A page type without labels | For each `posts` page type, `list_pages` with its `pageTypeId`: when none of its pages carries a label, it has no topic pages to group by. Report it for review: suggest labels, or confirm the type needs none | 7 |
| A menu item pointing at a page that is gone | Every `pageid:<uuid>` in `get_menu` whose page is not in `list_pages`; also any item whose `href` is a path rather than `pageid:` | 1, 5 |
| A docs set with no search index | A page type whose `type` is `documentation` or `api` that no index's `pageTypeIds` includes | 4 |
| Missing autolinks | A page type with `autolink` on (`get_page_type`, or `src/_data/pageTypeList.json`) and no autolink pointing at any of its pages; an autolink whose target is unset (`list_autolinks` with `unlinked: true`) | 5 |
| A page type naming a missing layout | A `layout` from `get_page_type` that is not in `src/_layouts/` (repo mode) and is not one Leed provides | 8 |

Every CMS finding names the record (`pageTypeId`, `menuId` and `menuItemId`, `searchIndexId`, `autolinkId`) instead of a file:line, and its fix is the `leed settings` command (or MCP tool) the user would run after saying yes.

## Changed-files mode (for site-publish)

`site-publish` runs this after a push, with the files the push changed:

```bash
node "<skill dir>/scripts/audit.mjs" --app-root "<appRoot>" --json --changed <file> [<file> ...]
```

It runs the per-file checks on those files only and skips the repo-wide ones (missing layouts, unset tokens, unreferenced files), saying so in `notes`. **An audit failure is any finding of severity `error`** (exit status `1`). That blocks the promote offer. `review` findings and `justified` entries are reported but do not block. Report the result in site-publish's table as `passed` or as the list of findings.

## Report

Group findings by rule, in rule order, then list what was not checked:

```markdown
## Site audit: <site or repo>

Mode: repo | CMS only | changed files · Tier: <tier or unknown> · <n> errors, <n> to review

### Rule 5 — Links: internal links use `pageid:<uuid>`, or `pageid:list-<id>` for a paginated index. Never a path.

| Where | Severity | Finding | Proposed fix |
|---|---|---|---|
| `src/_layouts/legal.hbs:28` | error | links to the path /legal/ | `href="pageid:<uuid of the legal index>"` |
| menu `Header Menu` / item `a1b2c3d4` | error | points at a deleted page | `leed settings menu set …` to a live page, or remove the item |

### Justified exceptions
- `src/_includes/<file>.hbs:<line>` — rule 7 — <the comment's reason>, accepted / not accepted because <why>

### Not checked
- <check>: <reason, e.g. no --app-root, so --site-* names were not checked; tier unknown, so no eject suggestions>
```

Every finding names its rule number and title, its file:line (or CMS record) and a proposed fix. Then ask which fixes to apply. Do nothing until the user answers.
