---
name: site-onboarding
description: Guided "build my site" flow for a new Leed company — interviews the user about their business, proposes a content model (sections, pages, labels, menus, search), applies the starter settings through the Leed CLI or the CMS MCP tools once the user confirms, writes site-wide starter templates (site template, header and footer on the menu builder, brand theme, buttons) into the site checkout, hands blogs and documentation to /leed:create (and, on Growth, recommendations and a CTA), and finishes with a staging check. Use when a user with a newly provisioned Leed site asks Claude to build, set up or start their site.
---

# Site Onboarding Skill

You take a newly provisioned Leed company from its starting state to a site that builds, with its home page, header, footer, menus and brand set, and that follows every site-patterns rule. A new company has only the Root page type, an empty **Header Menu** and **Footer Menu** already bound as its site menus, a template-owned home page (`src/index.hbs`, "Your site is operational") and a draft Root page at `/getting-started/`. Leave that draft alone; it is the user's to publish or delete.

You do not improvise the settings or the templates. Both ship with the plugin, as data:

- `../../templates/starter/settings.json` (from this skill's directory; `${CLAUDE_PLUGIN_ROOT}/templates/starter/` once installed): the settings steps, in order, each with its CLI commands and the CMS MCP tools that do the same. How to run it is in `references/starter-settings.md`.
- `../../templates/starter/manifest.json`: every starter template, where it goes, what it needs and which placeholders it holds. How to copy them is in `references/starter-templates.md`.

## Before starting

1. Read `../site-patterns/SKILL.md` and `../site-patterns/references/content-model.md`. Every starter file follows the site-patterns rules, and nothing this skill does may break one: one `leed/menu/builder` per menu (rule 1), CMS-managed CTAs and recommendations only through `/leed:create cta` and `/leed:create recommendations`, which check for the Growth plan (rule 3), `pageid:` links (rule 5), brand tokens defined once with every `--site-*` set (rule 9), styles in `layer(base)` or `layer(components)` with docs overrides unlayered (rule 10), the measured header height (rule 12), what the tier allows (rule 13), and site-wide `<head>` tags in `header-includes.hbs` (rule 14). Where this skill seems to disagree with a site-patterns rule, the rule wins.
2. Read the commands you will run in `../site-builder/references/cli-commands.md`, the CMS Settings, Pages and `leed site eject` sections.
3. **Pick the surface: the CLI first.** Use `leed` when it is on `PATH` (`leed --version`) and `leed auth status --json` says the user is signed in. Otherwise use the CMS MCP tool each step names in its `mcp` field. Always pass `--json` and read the envelope: `ok`, then `data`, or `error.code`, `error.message` and `error.hint`.
4. **Find the site checkout.** It is the `raw-content` git directory, the one holding `.git`, `identity.json`, `src/` and `tailwind/site.config.css`; `leed site list --json` lists each registered site with its checkout's path. The folder above it, named after the company, is not the checkout: files written there are outside the git repo, the build never sees them and `leed site commit` has nothing to commit. Every starter `target` path is relative to the `raw-content` directory, and every `leed site *` command runs from it. With no checkout, follow "Without a site checkout" below.
5. **Read the tier from the CLI, never assume it.** In the checkout run `leed site eject --json` and record `data.tier` (null counts as Free) and the names in `data.templates`. Custom documentation theme names and the docs header and footer need Starter; recommendations and the dynamic CTA need Growth. Over MCP with no checkout, treat the tier as Free unless a write proves otherwise.

## 1. Interview

Ask the questions in `references/interview.md`, a few at a time, in plain language: the business and its audience, the sections the site needs, the kinds of content it will publish, the brand colors and font, and whether visitors need search. Use what the user already said; do not ask twice.

## 2. Propose the content model, and confirm it

Write the proposal in the shape `references/interview.md` gives: the pages, labels, extra page types, the Header Menu and Footer Menu items, the company settings (site title, documentation font and color theme, the menus' binding, and that `color-theme-site` is set only after the promote), why there is no search index of onboarding's own (Leed's search UI exists only on documentation pages, whose recipe makes the index), whether the home page has a button (only to a published page), the recipes to run (`/leed:create blog`, `/leed:create documentation`), and the template files that will be written or kept. Map each record to its row in `content-model.md`.

**Nothing is applied until the user confirms the proposal.** Show it, ask "Shall I apply this?", and wait for a clear yes. A change the user asks for means a revised proposal and a new confirmation. Any change to a value the company already holds (its site title, a bound menu, a documentation theme) is named in the proposal as a change; never make one the user has not seen.

## 3. Apply the settings

Run the steps in `settings.json`, as `references/starter-settings.md` describes, with the CLI or the MCP tool each step names:

| Step | CLI | MCP |
|---|---|---|
| Read what exists | `leed settings pagetype list`, `menu list`, `label list`, `searchindex list`, `company get`, `pending` | `list_page_types`, `list_menus`, `list_labels`, `list_search_indexes`, `get_company_overview`, `list_pending_changes` |
| Section pages | `leed page sync-state`, `leed page create` | `list_pages`, `create_page_from_markdown` |
| Labels | `leed settings label create` | `create_label` |
| Other page types | `leed settings pagetype create` | `create_page_type` |
| Menus | `leed settings menu create`, `menu get`, `menu set-menu` | `create_menu`, `get_menu`, `update_menu_fields` |
| Menu items | `leed settings menu add` | `add_menu_item` |
| Company settings | `leed settings company set --from-file` | `update_company_settings` |
| Search (decide only) | `leed settings searchindex list` | `list_search_indexes` |
| Publish | `leed settings pending`, then `leed settings publish <ids>` | `list_pending_changes`, `publish_pending_changes` |

Publish exactly the pending entries this run changed, by id. Never `--all`: other people's unpublished changes may be pending.

**Nothing published here may name what only staging has.** These settings publish straight to production, while the starter files of section 4 reach production only when section 6 promotes them. So `company-settings` writes everything except `colorTheme: color-theme-site`, whose CSS is one of those files; the last step, `docs-color-theme`, writes it in section 6, after the promote. Below Starter the built-in theme is Leed's own and is written here.

## 4. Write the starter templates (needs the checkout)

Follow `references/starter-templates.md`. In short:

- A file the provisioned site already has (`site-template.hbs`, `header-includes.hbs`, `header.hbs`, `footer.hbs`, `src/index.hbs`) is replaced only while it is still the CLI's provisioned original, or the starter's version an earlier run wrote. A file the user changed is kept and reported, never overwritten. One a site provisioned by an older CLI lacks (`header-includes.hbs`) is written.
- `header-includes.hbs` holds the site-wide `<head>` tags, the `theme-color` pair among them, because it reaches documentation pages too and `site-template.hbs` does not (rule 14).
- A new file is written only when its target does not exist.
- `tailwind/site.config.css` is never replaced: each import line is added once, so a recipe's import already there survives.
- `docs-header.hbs` and `docs-footer.hbs` are written only when `leed site eject --json` lists that name for this site. These are tested overrides that ship with the plugin and reuse the site's own header and footer, not hand-written copies of Leed's; the eject listing is what says the plan renders them (rule 13).
- A provisioned file is replaced only when every file in its `dependsOn` holds the starter's version: the starter header over a site's own `site-header.js` or `menu.css` would sit over the page content.
- Fill every placeholder from the interview and the provisioned home page. A file still holding `###` is broken. The hero button links only to a **published** page: a `pageid:` link to a draft renders as a plain span, so on a first run, with every section page a draft, the button is left out.
- Then validate, build, commit and push with the `site-publish` skill (`../site-publish/SKILL.md`): `leed site validate`, `leed site build`, `leed site commit`, `leed site push`. Never raw `git commit` or `git push`.

## 5. Hand off blogs and documentation to `/leed:create`

For each recipe in the confirmed proposal, run `/leed:create blog` or `/leed:create documentation` (the `create` skill, `../create/SKILL.md`). Onboarding never makes a posts or documentation page type itself. Pass the documentation recipe the interview's answer to "What should a reader do after a docs page?", which its `page-cta` feature turns into the line above each page's Previous/Next links; with no answer, that feature is skipped. When a recipe finishes, run the `add-menu-items` step again for the items that link to it, then `publish-settings` for the menus it changed.

**Recommendations and a CTA, on Growth or above only.** Onboarding does not ask about them itself: the `create` skill's "After the recipe" section asks once the blog recipe has finished, on Growth or above, and runs `/leed:create recommendations` and `/leed:create cta` on yes. Do not ask a second time, which would run both recipes twice. Below Growth, the `create` skill does not ask either, because the plan does not include them.

Run recipes after the templates are pushed: the blog's starters use the site's `site-template.hbs` and brand tokens, and the documentation recipe keeps the font and color theme onboarding set.

## 6. Check it on staging

Hand over to the `site-publish` skill's staging verification for the home page and every page onboarding made, and its promote gate. Then suggest the `site-audit` skill as the next check, when it is installed.

On Growth or above (the tier read in Before starting), offer `/leed:docs-ci` when the company's product lives in a GitHub or GitLab repository: it connects that repository so documentation pages publish with the release that ships the code they describe (`../docs-ci/SKILL.md`). Below Growth, do not offer it.

**After the promote, and only then,** run the `docs-color-theme` step of `settings.json` on Starter or above: `color-theme-site` is defined by a file the promote has just put on production. When the user does not promote, or the check blocks it, skip it and say so: the documentation keeps its current color theme until onboarding runs again after a promote.

Tell the user which section pages are still drafts, and that each one appears in the menus once they publish it (`leed page publish <pageId>`, MCP `publish_page_now`). Say too that the home page has no button yet, because a link to a draft does not render, and that running onboarding again once the page is published adds it.

Then tell them about the review loop: they write and edit the section pages in the Leed editor, comment on anything they want changed, and Claude answers the comments as suggestions. End with the review handoff:

**When the pages are written, hand them over for review.** This applies to pages written to the CMS; a sandbox has no editor. Tell the user:

1. Which pages were written, each with its editor link, `<CMS origin>/pages/<pageId>`, built from the page ids the writes returned. The CMS origin is the environment the site is on: `https://app.leed.ai` for production and `https://staging.app.leed.ai` for staging, read from `environment` in the CLI's results; over MCP alone, it is the origin of the CMS MCP server's URL.
2. That they can read and edit each page there, in the editor built for writing, and leave a comment on anything they want changed.
3. That they then say "review the comments on <page>", or run `/leed:review <page>`, and each comment is answered as a tracked suggestion they accept or reject in the editor.
4. For a user in more than one company: the link opens in the company that is active in their browser, so they switch to this site's company first.

## Without a site checkout

Over MCP alone (Claude Desktop, or no CLI), onboarding still completes the interview, the confirmed content model and every settings step whose `mcp` is not `null`. Skip the starter templates and the push, and say exactly what was skipped. With no checkout the tier is treated as Free, so the documentation gets a built-in color theme. Then explain: `/leed:setup` installs the CLI and fetches the site checkout, and running onboarding again from that checkout writes the starter templates and runs the staging check, reusing every record this run created.

## Re-running: never duplicate

Every step looks before it creates: a page by its title or path, a menu by its exact name, a menu item by its `href`, a label by its slug, a page type by its slug. A template file onboarding wrote earlier is recognized as the starter's version, with its filled placeholders matching any value (`references/starter-templates.md`, "Recognizing a file"), so a re-run replaces it again rather than keeping it as the user's. A re-run leaves the site as one run would, and resumes where a failed run stopped.

**Once a page has comments, write only suggestions.** Before writing to a page that already exists, read its open comment count: over MCP, `openCommentCount` from `get_page`; with the CLI, `data.counts.comments` from `leed page review <pageId> --include-types text,emoji --json`. Above zero, the person has read the draft and is reviewing it, so write only tracked suggestions, with `update_page_body` and `mode: "suggest"` or with `leed page update <pageId> --block <dataId> --suggest`, or stop and offer `/leed:review`. Never write in `direct` mode, never call `set_page_body` with `overwrite`, and never replace the whole body with `leed page update` without `--block`.

## When a step fails

Stop at the failed step. Do not retry it in a loop, and do not try to undo earlier steps. Report, in this order:

1. The step, the command or tool, and `error.code`, `error.message` and `error.hint`.
2. **Exactly what was created**: each record with its id (page, label, page type, menu, menu item, company settings keys written), each file written with its path, and each commit pushed.
3. What is left, and that running onboarding again picks up from there.

## If Cloudflare blocks a request

Cloudflare's firewall sits in front of the Leed CMS and now and then mistakes legitimate content for an attack. When it does, the request never reaches Leed.

1. **Recognize it.** The CLI fails with `request_blocked` (exit `5`). An MCP tool call, or any other request to the CMS, comes back with a 403 and an HTML page ("Just a moment…" or "Attention Required"), `server: cloudflare` or a `cf-ray` value, and no JSON error. It is not a permissions problem: do not ask for a different role or sign in again.
2. **Stop.** Retry the same write at most once. Never alter, encode, split or obfuscate the user's content to get past the filter: the content is theirs, and the false positive is Leed's to fix.
3. **Report it.** From the CLI, run the `leed feedback blocked` command in the error's `hint`; it carries the ray id, method, path and time (add `--excerpt-base64` from `error.request` when it is there). From MCP, call `report_blocked_request` with the `rayId`, the time as `occurredAt`, the method and path if you know them, the tool name and its argument names written as `name=` with no value as `command` (for example `update_page_body pageId= ops=`), and at most 2 KB of the body base64-encoded as `excerptBase64`. Never put the blocked text itself in `command` or `note`: the report crosses the same firewall.
4. **Tell the user.** Say what was blocked (which page, setting or asset, and which command or tool) and give the ray id, then continue with the rest of the work.
