---
name: create
description: Sets up a complete page type on a Leed site from a recipe in one step — `/leed:create blog` or `/leed:create documentation`, and on Growth plans `/leed:create recommendations` and `/leed:create cta` — creating the page type, its menus, search index and starter templates through the Leed CLI or the CMS MCP tools, without duplicating anything that already exists. Run with no argument to list the recipes. Use when a user wants to add a blog, a documentation set, recommendations, a CMS-managed call to action, or another kind of section to their site.
---

# Create Skill

You add a whole section to a Leed site — a blog, a documentation set — by running one of the plugin's **recipes**. A recipe is a data file that holds the page type to create, the settings steps in order, and the starter template files to copy. You execute it exactly; you do not improvise.

The recipes ship with the plugin in `../../recipes/` from this skill's directory (`${CLAUDE_PLUGIN_ROOT}/recipes/` once installed). Each one is a folder holding a `recipe.json`. The format is in `references/recipe-format.md`.

| Recipe | What it makes | Needs |
|---|---|---|
| `blog` | A posts page type at `/blog/`, with the article layout, the paged list of cards, author pages and topic pages, styled from the site's brand tokens | The Leed CLI and the site checkout |
| `documentation` | A documentation page type at `/docs/`, with its left navigation menu, its search index and a welcome page as the starting page, plus a one-line call to action above each page's Previous/Next links (feature `page-cta`, any plan, needs the checkout) | The Leed CLI, or the CMS MCP tools |
| `recommendations` | Leed's recommendation cards on the chosen page types (the blog by default): `allowRecommendations` on, the `data-leed-recommendations` slot in their layouts, the card in the brand, and an offline preview for `leed site build --serve` | A Growth plan, the Leed CLI and the site checkout |
| `cta` | Leed's CMS-managed call to action: `cta.hbs` and the `data-leed-cta` slot in the chosen layouts and on the home page | A Growth plan, the Leed CLI and the site checkout |

## With no argument: list the recipes

Read every `../../recipes/*/recipe.json` and show each one's `name`, `title` and `description`, its plan (the `tier:<plan>` in its `requires`, or "any plan" when there is none), plus its `features` with their descriptions. Then ask which one to run. Do not run anything else.

## Before running a recipe

1. Read the recipe's `recipe.json` in full, and `references/recipe-format.md`.
2. Read `../site-patterns/SKILL.md`. Its rules are what the starter templates follow; nothing this skill does may break one. Where this skill seems to disagree with a site-patterns rule, the rule wins.
3. Read the commands you will run in `../site-builder/references/cli-commands.md`, the CMS Settings and Pages sections.
4. **Pick the surface: the CLI first.** Use `leed` when it is on `PATH` (`leed --version`) and `leed auth status --json` says the user is signed in. Otherwise use the CMS MCP tool each step names in its `mcp` field. A step whose `mcp` is `null` writes files in the site checkout and can only run with the CLI; when it cannot run, stop before the recipe's first step and say what is missing (`/leed:setup` installs the CLI and fetches the checkout). The exception is a step with a `feature`: then that feature is turned off, the user is told, and the rest of the recipe runs.
5. **The working directory is the site checkout's root** for every step with `needsRepo: true`. `leed site *` acts on the current directory, so run from anywhere else and it acts on the wrong tree or refuses. The root is the `raw-content` checkout, holding `identity.json`, `src/` and `tailwind/site.config.css`; `leed site list --json` shows where each registered site's checkout is. Settings commands need no checkout, but run inside one they pick up its company and environment, which is what you want; outside one they default neither and refuse without `--company` (and `-e`).
6. **Always pass `--json`** to commands whose result you read, and read the envelope: `ok`, then `data`, or `error.code`, `error.message` and `error.hint`.
7. **Check the plan before the first step.** When `requires` holds `tier:<plan>`, run `leed site eject --json` in the checkout and read `data.tier`, exactly as site-onboarding does: `null` counts as Free, and over MCP or with no checkout the tier is Free. The plans, lowest first, are Free, Starter, Growth and Enterprise. **Below the required plan, stop**: tell the user what the recipe adds (its `description`), that it is included from the `<plan>` plan up and the site is on `<tier>`, and run no step. Write no file, change no setting and create nothing, so no markup for a feature the plan lacks ever reaches the site.

## Running a recipe

Run the recipe's `steps` in order, skipping a step whose `feature` was not chosen. For each step, do exactly what its `do` list says with the commands in its `cli` list (or its `mcp` tool), and nothing else. Do not add a step, skip a step its `do` list does not let you skip, or reorder them. Tell the user, one line per step, what you are doing.

- **Placeholders.** Copied files hold three: `###PAGE_TYPE_ID###` (the id `create-page-type` returned), `###SEPARATOR###` (the recipe's `constants.separator`) and `###NEW_SHORT_ID###` (a fresh 8-character lowercase hex id, a different one per file, used as the page's `pageId`), plus any the recipe's `placeholders` declares, filled as it says. Replace every one before the file is committed. A file still holding `###` is broken.
- **Payloads go through a file.** Write `pageType.payload` to a temporary JSON file outside the site checkout and pass it with `--from-file`; never inline JSON in a shell argument.
- **Ids come from results.** Every id a later step needs (`pageTypeId`, `pageId`, `menuId`, a menu `revision`) is read from an earlier step's `data`. Never guess one, and never reuse one from another company.
- **Publish what you made, by id.** Read `leed settings pending --json` first, then pass `leed settings publish` exactly those of the recipe's ids that the list holds. Never `--all`.
- **Repo files go through site-publish.** Validate, build, commit and push with `leed site validate|build|commit|push`, never raw `git commit` or `git push`. See `../site-publish/SKILL.md`.

## Re-running: never duplicate

Every recipe starts with a `preflight` step that reads what already exists, and a re-run must leave the site as one run would. In particular:

- **An insertion** into a file the site already has (a slot in a layout, a tag in `header-includes.hbs`, an attribute on a list row) is made only when the file does not already hold it, and always in place: never rewrite the whole file.

- **A page type** that already publishes under the recipe's slug is reused when it is the recipe's kind: `create-page-type` is skipped and every other step still runs, each keeping what it finds, so the files the page type needs are written however it was made. When it is something else, stop and report the conflict. Never create a second page type to get round a slug clash.
- **A file** that already exists at a target is kept as it is and reported, never overwritten. The user may have changed it. Check the target after replacing `###SEPARATOR###` in its path, since that is the file the recipe would write.
- **A push is never skipped on what this run wrote.** An earlier run may have written files and failed before pushing them, so the publish steps always push, and the page type is created only once its layout is on staging.
- **A menu, a search index, a menu item or a page** is created only when the step's `do` list says to and nothing already exists for it: look for the record (a page by its title or path, a menu item by its `href`) right before creating it. A documentation page type creates its own menu and search index; never create either as well.
- **A name clash** (an older site with a "Documentation" menu, say) is resolved the way the recipe says — binding the existing menu or choosing a unique name — and you tell the user which you did.

**Once a page has comments, write only suggestions.** Before writing to a page that already exists, read its open comment count: over MCP, `openCommentCount` from `get_page`; with the CLI, `data.counts.comments` from `leed page review <pageId> --include-types text,emoji --json`. Above zero, the person has read the draft and is reviewing it, so write only tracked suggestions, with `update_page_body` and `mode: "suggest"` or with `leed page update <pageId> --block <dataId> --suggest`, or stop and offer `/leed:review`. Never write in `direct` mode, never call `set_page_body` with `overwrite`, and never replace the whole body with `leed page update` without `--block`.

## When a step fails

Stop at the failed step. Do not retry it in a loop, and do not try to undo what earlier steps did: neither the CLI nor the MCP tools can delete a page type, so there is no clean rollback, and a re-run resumes from what exists.

Report, in this order:

1. The step that failed, the command, and `error.code`, `error.message` and `error.hint` from its result.
2. **Exactly what was created**: each record with its id (page type, menu, page, menu item, search index, company settings keys written), each file written with its path, and each commit pushed.
3. What is left to do, and that running `/leed:create <recipe>` again will pick up from there.

## In a sandbox site: no Leed account yet

A sandbox is a local site made with `leed site init --sandbox`, before there is a Leed account. You are in one when the site root's `identity.json` names `non-cms-company`. There, every command that needs the CMS (`leed settings`, `leed page`, `leed site validate`, `commit` and `push`) refuses with `sandbox_site`, so run the recipe without them, writing the records yourself the way the CMS would have published them:

1. **Allocate each id** with the move skill's script, from the site root: `node "<this skill's dir>/../site-sandbox-move/scripts/next-id.mjs" --root . --kind pt` (kinds `pt`, `page`, `menu`, `menuitem`, `index`). It answers `ph-<kind>-<n>`, a placeholder `/leed:site-sandbox-move` later swaps for the real id. Never write a made-up id.
2. **The page type** goes into `src/_data/pageTypeList.json`, keyed by its `ph-pt-<n>`, with the payload's `slug`, `name`, `layout`, `description`, `includeInFeeds`, `autolink`, `allowRecommendations`, `sitemapPriority`, `labelSiteMapPriority`, `noRender` and `autopostNewPages`. Write `src/<slug>/<slug>.11tydata.json` beside it (`{}` for a blog). Use the `ph-pt-<n>` wherever the recipe says `###PAGE_TYPE_ID###`.
3. **A documentation set** also needs what creating its page type would have made: a left menu in `src/_data/menu.json` named after the page type with a `ph-menu-<n>` `menuId` (the page type's `navMenuId`), a search index in `src/_data/searchIndexList.json` (`ph-index-<n>`, `{ "name", "pageTypeIds": ["ph-pt-<n>"] }`), and the page type's `documentationConfiguration` in its `.11tydata.json`: `menus.left`, `searchIndexId` and, once the welcome page exists, `startingPage`. The welcome page is `src/docs/welcome.md` with JSON frontmatter naming `"pageId": "ph-page-<n>"` and `"pageTypeId"`, and a `ph-menuitem-<n>` item linking `pageid:ph-page-<n>` in the left menu. Merge `companyDocumentationDefaults` into `src/src.11tydata.json`'s `documentationConfiguration`, keeping every key already set.
4. **A recipe that needs a plan refuses.** A sandbox has no plan, so `leed site eject --json` reports `null` and a recipe whose `requires` holds `tier:<plan>` stops with the plan message. It becomes available once `/leed:site-sandbox-move` has moved the site into an account on that plan.
5. **Skip every publish step** (validate, commit, push, publish the settings): a sandbox is never published. Copy the files and fill the placeholders exactly as the recipe says, then preview with `leed site build --serve` (`../site-preview/SKILL.md`).
6. **Finish by telling the user** the section is ready locally and moves into Leed with `/leed:site-sandbox-move` once they have an account.

## Starter templates, or your own

The blog recipe's starters are a working blog that already follows site-patterns: the article layout leaves out the CTA and the recommendations, which are Growth features, and keeps one marked insertion point (`leed:after-content`) where `/leed:create cta` and `/leed:create recommendations` put their slots on a Growth plan (rule 3), the pager is `leed/components/pagination` (rule 4), the lists are Leed collections (rule 7), the layout lists its fields in a header comment (rule 8), and the colors are Leed's `--site-*` tokens, so the site's theme carries its brand into them (rule 9). They are the user's files once copied: change them with the `site-builder` skill (`../site-builder/SKILL.md`).

To build your own layout instead, write it first with `site-builder`, push it, and put its file name in the payload's `layout` before running the recipe, or run the recipe and replace the starter afterwards — the CMS refuses a layout that is not on the staging branch either way. Keep the recipe's frontmatter shapes for the list, author and topic pages; only the markup is yours to change.

A design made in Claude Design is imported with the `site-design-import` skill (`../site-design-import/SKILL.md`), which runs these recipes itself for a blog or a documentation set the design holds.

A documentation set is rendered by Leed's own templates and themed through `documentationConfiguration` (rule 9's `@utility color-theme-<name>`). Changing one of those templates is done only by ejecting it with `leed site eject`, which depends on the plan: read what is allowed from `leed site eject --json`, never assume it (rule 13).

Author and topic pages, how they work and how to link to them, are in `references/authors-pages.md`.

## After the recipe

Show the user what now exists: the page type and its URL (`/blog/`, `/docs/`), the files written, and what they do next — write the first post, or publish the welcome page. A blog's `/blog/` list appears once its first post is published. Then offer the `site-publish` skill's staging verification for the new pages.

When the recipe wrote page content (the documentation recipe's welcome page, say), end with the review handoff:

**When the pages are written, hand them over for review.** This applies to pages written to the CMS; a sandbox has no editor. Tell the user:

1. Which pages were written, each with its editor link, `<CMS origin>/pages/<pageId>`, built from the page ids the writes returned. The CMS origin is the environment the site is on: `https://app.leed.ai` for production and `https://staging.app.leed.ai` for staging, read from `environment` in the CLI's results; over MCP alone, it is the origin of the CMS MCP server's URL.
2. That they can read and edit each page there, in the editor built for writing, and leave a comment on anything they want changed.
3. That they then say "review the comments on <page>", or run `/leed:review <page>`, and each comment is answered as a tracked suggestion they accept or reject in the editor.
4. For a user in more than one company: the link opens in the company that is active in their browser, so they switch to this site's company first.

**After the blog recipe, on Growth or above only,** ask "Add recommendations and a CTA to your posts?" The tier is the one read with `leed site eject --json` (`data.tier`, null counts as Free). On yes, run `/leed:create recommendations` and then `/leed:create cta`. Below Growth, do not ask: the site's plan does not include them.

After the recommendations recipe, tell the user to run `leed site build --serve` and open a post on `localhost` to style the cards offline.
