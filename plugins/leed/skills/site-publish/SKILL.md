---
name: site-publish
description: Validates, commits, and pushes site changes to staging using the Leed CLI, then verifies them on the staging site (screenshots against production at desktop and mobile widths, console errors, broken links) and asks before promoting to production. Handles the full publish workflow including validation failures and conflict resolution.
---

# Site Publish Skill

You manage the validation, commit, and push workflow for a Leed CMS website. You ensure changes are valid, properly committed through the Leed CLI, and pushed to staging. Then you check them on the staging site against the live one, and you promote them to production only when the checks pass and the user says yes.

## Two Different Things Are Called "Publishing"

This skill publishes the **site repository** — the templates, styles and content files in your git checkout — with `leed site validate|commit|push`.

`leed settings publish` is a **different** command for a different subject: CMS settings that editors change in the web UI (page types, labels, autolinks, menus, forms, users and the company's own Settings → General). Those live in the CMS, not in your checkout, and they are published separately. It also commits to the site repository and starts a build, which is exactly why the two are easy to confuse. CMS settings and content do not pass through staging: they publish straight to the live site, so the staging verification and promote steps below do not apply to them.

When a user says "publish my changes", work out which they mean before running anything:

- Changed files in the checkout (`.hbs`, `.css`, `.js`, markdown) → this skill's workflow.
- Changed settings in the CMS, or you edited them with `leed settings ... set` → `leed settings pending` to see what is waiting, then `leed settings publish <id>` or `--all`.
- Both → publish the site repository first, then the settings, so a template a new setting depends on is already deployed.

```bash
leed settings pending --json          # every unpublished settings change, each with an id
leed settings publish <id> [<id>...]  # publish the ones you looked at
leed settings publish --all           # everything pending; deliberately not the default
```

`--all` is not the default because "everything pending" is a set you have not looked at — other people's unpublished edits may be in it. Run `pending` first and name the ids unless the user has said they want all of it. See `cli-commands.md` for the full `leed settings` reference. Run these, and `leed deployments`, from inside the site's checkout so they act on its company and environment; outside one the CLI picks neither and refuses until `--company` and `-e` name them.

## Before Starting

Read `cli-commands.md` in the site-builder skill's `references/` folder (`../site-builder/references/cli-commands.md` from this skill's directory) for the full CLI reference.
Read `file-structure.md` in the same folder (`../site-builder/references/file-structure.md`) for file permission rules.

**A sandbox site cannot be published.** In one made with `leed site init --sandbox` (its `identity.json` names `non-cms-company`), `leed site validate`, `commit` and `push` refuse with `sandbox_site`: there is no CMS and no repository behind it. Do not work around the refusal. Tell the user the site has to be moved into Leed first, with `/leed:site-sandbox-move` (`../site-sandbox-move/SKILL.md`), and publish from the real checkout afterwards.

## Core Rules

- **NEVER use `git commit` directly** — always use `leed site commit`
- **NEVER use `git push` directly** — always use `leed site push`
- **NEVER use `git add`** — the CLI handles staging automatically
- All operations require the `staging` branch
- The workflow order is strict: **validate → build → commit → push**
- You may use `git status`, `git diff`, `git log` for inspection

## Publish Workflow

### Step 1: Check Status
```bash
git status
git branch
```
- Verify you're on `staging` branch
- Review what files have been changed

### Step 2: Validate
```bash
leed site validate
```

**If validation fails:**
- Read the error output to identify the issue
- Common failures:
  - **Protected file modified** → `leed site validate --reset` restores the originals, but it **discards the edits to those files permanently**, so it is not yours to run: the CLI refuses it on an unattended run (`confirmation_required` under `--json`, `interactive_input_required` with no terminal). Name the files, then ask your user to run `leed site validate --reset --yes`. See **Destructive commands: you diagnose, your user runs** below.
  - **Disallowed file type** → Remove the offending file
  - **File too large (>500KB)** → Compress or remove the file
  - **Disallowed path** → Files in `_data/` or page type directories cannot be committed

**If validation passes:** proceed to Step 3.

### Step 3: Build
```bash
leed site build
```
- The site must build successfully after the latest changes
- This is required before commit — the CLI checks build freshness

**If build fails:**
- Check for template syntax errors
- Fix the issue and re-run build

### Step 4: Commit
```bash
leed site commit -m "Clear, descriptive commit message"
```

**Dry run first (optional):**
```bash
leed site commit -m "message" --dry-run
```

**Commit message guidelines:**
- Describe what changed and why
- Examples: "Add product comparison layout and 3 comparison pages", "Redesign blog card grid with new hover effects", "Add newsletter signup form to footer"

### Step 5: Push
```bash
git rev-parse origin/staging   # record the "before" commit first; Step 6 diffs against it
leed site push --json
```
- Read `data.notification` from the result: only `notified` starts a staging deployment (see `references/staging-verification.md` 1b for `no_changes`, `not_attempted` and `failed`)
- Pushes to `origin/staging`
- Automatically notifies the CMS webhook
- The CMS will trigger a staging deployment

### Step 6: Verify on staging

Follow `references/staging-verification.md`. In short:

1. **Wait** for the staging deployment of the pushed commit: `list_deployments`, or `leed deployments status --json` when the CMS MCP tools are not connected (`leed mcp add --cms` adds them). A failed build stops here and blocks the promote offer.
2. **Scope** the change: map the changed files to the page types they affect, and pick one published page per affected page type. A shared partial, layout or CSS file reaches every page type that uses it.
3. **Render and compare** each page on staging and on production, at desktop (1440px) and mobile (390px) widths. Show the staging and production screenshots side by side, call out visual regressions, and read the browser console on the staging page.
4. **Check links**: show the stored `list_broken_links` report with its date, and check each staging page's own links for new broken ones.
5. **Run `site-audit`** on the changed files when that skill is installed. Otherwise record it as skipped.

With no browser available, fall back to fetching the HTML and checking its stylesheets and scripts, and say that the screenshots and console check were skipped.

### Step 7: Report

Tell the user what was checked and what was skipped, in this shape:

```markdown
## Staging verification: <commit short hash>

| Check | Covered | Result | Blocks promote |
|---|---|---|---|
| Staging deployment | <deployment id> | succeeded / failed | yes / no |
| Pages checked | <page type>: <path>, one per affected page type | - | - |
| Screenshots, desktop 1440px | staging vs production, <n> pages | no regressions / <list> | yes / no |
| Screenshots, mobile 390px | staging vs production, <n> pages | no regressions / <list> | yes / no |
| Console | staging, <n> pages | clean / <errors> | yes / no |
| New broken links | <n> links on <n> pages | none / <list> | yes / no |
| Stored broken-link report | checked <checkedAt> | <n> links, context only | no |
| site-audit | changed files | passed / <findings> | yes / no |

### Skipped
- <check>: <reason, e.g. no browser available, so screenshots and the console check were skipped and only the HTML was checked>
- <check>: <reason, e.g. site-audit is not installed>

### Blocking
- <each blocking finding, or "Nothing blocks the promote offer.">
```

List every skipped check with its reason. A skipped check is never reported as passed.

### Step 8: Promote gate

**Never promote automatically.** Promotion publishes to the live site and cannot be undone from here.

- **If anything blocks,** report it and do not offer to promote. Offer to fix the problem instead. If the user wants to promote anyway, they must first name the blocking findings they accept, and then answer the promote question below.
- **Before asking,** check the CMS's own promote gate: `promotableToPublic` and `promotionBlockedReason` from `list_deployments`, or the gate in `leed deployments status`. If promoting is not allowed, report the reason and stop.
- Otherwise **ask** the user: "Promote these changes to the live site?" Promote only on an explicit yes. An ambiguous answer, silence or a question back is a no.
- **After the yes, before promoting,** re-read `list_deployments` (or `leed deployments status --json`). Promotion takes the preview site's *latest* commit, and a teammate's push or a CMS template change can land a newer commit on staging while you verify. Promote only when the newest `preview[]` row's `commitHash` is the commit you verified. If it is not, do not promote: report the new commit and offer to verify again.
- On an explicit yes, with the newest preview commit still the verified one, promote with one of:
  - **MCP:** `promote_staging_to_production`. The first call returns a preview of what it will do; call it again with `confirm: true`.
  - **CLI:** `leed deployments promote --yes`. Pass `--yes` only because the user said yes to this promotion.
- Never pass `confirm: true` or `--yes` without the user's yes to this promotion. A yes to an earlier step (the commit message, a fix) is not a yes to promote.
- After promoting, report the result. `already_promoted` and `nothing_to_promote` are successes that changed nothing.

## Handling Authentication / Token Issues

The publish workflow exercises **two** credentials: your CMS login session (used by the CLI to talk to the backend) and the site's GitLab tokens (used by `git push` to write to the `raw-content` remote). Either can fail independently, and the symptoms look different.

**If you suspect anything credential-related is off, ALWAYS start with:**

```bash
leed auth status
```

That command shows the state of both surfaces in one go — your CMS session per environment, plus this site's GitLab token expirations with `✓` (valid), `⚠` (expires within 7 days), or `✗` (expired). It changes nothing on disk, so it's safe to run any time.

### Destructive commands: you diagnose, your user runs

`leed auth rotate` and `leed auth reset` both replace credentials in a way that cannot be undone, so the CLI will not do either on an unattended run. It refuses **before touching anything** — `confirmation_required` under `--json`, `interactive_input_required` in human mode with no interactive terminal, which is the situation you are in. `-y, --yes` is the bypass, and it is your user's decision to give, not yours (see **Commands that refuse under `--json`** in `references/cli-commands.md`).

So every remedy below is something to **ask for**, quoting the symptom you saw. `leed auth login` is the same shape for a different reason: it opens a browser and waits for a person to approve a code, and no flag gets you past that.

`leed auth status` is the exception — it changes nothing, so run it yourself, as often as you like.

### Symptom-to-action mapping

**Symptom: `leed site push` fails with a 401, 403, or "remote: HTTP Basic: Access denied" / "fatal: Authentication failed" from git**
→ The raw-content git token in `.git/config` is stale. Rotating fixes it: ask your user to run `leed auth rotate --yes`, or to run plain `leed auth rotate` at their own terminal and answer the prompt. It rotates the GitLab tokens and rewrites the remote URL with the fresh one. Retry `leed site push` once they confirm it finished. No re-authentication needed.

**Symptom: `leed auth status` shows the GitLab token row marked `⚠ expires in N days`**
→ Proactive maintenance window, not a blocker. Tell your user, and ask them to run `leed auth rotate --yes` before it expires. Doesn't affect their session.

**Symptom: `leed auth status` shows the GitLab token row marked `✗ expired`**
→ Same fix: ask your user to run `leed auth rotate --yes`. The CLI mints a fresh token on the backend and stores it in `~/.config/leed/auth.json`.

**Symptom: `leed auth status` shows the GitLab token row marked `(no tokens stored yet)`**
→ The site was installed but tokens were never minted. Ask your user to run `leed auth rotate --yes` to provision them, or to run `leed setup --env <env>` again if this is a fresh install.

**Symptom: any `leed site …` CLI command fails with "Session expired" or "401 Unauthorized" from the backend (not from git)**
→ Their CMS session is gone, not the GitLab tokens. Stop and ask them to run `leed auth login --env <env>` (the env is shown in the error) — it opens a browser and waits for a person, so you cannot do it for them. Retry what you were doing once they say they are signed in.

**Symptom: user reports "I think my laptop was compromised" or "I committed credentials by accident"**
→ This is the nuclear case, and it is not yours to trigger: `leed auth reset` rotates the GitLab tokens **and** revokes their CMS session, signing them out. Explain what you saw, and let them run `leed auth reset` themselves at a terminal, where it asks them to confirm (`--all-sessions` also boots any other devices they are signed in on). Do not offer them `leed auth reset --yes` unless they have asked for exactly that, and never suggest `leed auth reset` for a routine token refresh — `leed auth rotate` is the command for that.

### What to tell the user about the difference

- **`leed auth rotate`** = "refresh your GitLab tokens" — fast, doesn't sign you out, the right call for stale/expiring tokens
- **`leed auth reset`** = "burn it all down and start over" — signs you out of the CMS too, the right call for a security incident
- Both confirm before acting, and both must be run from **inside the site's checkout** (the checkout identifies which site to rotate)
- If the user has multiple installed sites and one is broken, only that site's tokens need rotating — `leed auth rotate` only affects the site you run it from

### Don't suggest auth commands when the failure isn't auth-related

`leed site push` can also fail for non-auth reasons (validation errors, build staleness, merge conflicts, network issues). Read the error message before asking your user to rotate anything. The mapping above is for **specific symptoms**; if the error mentions templates, validation, builds, or git history, treat it as a content/workflow issue first and only escalate to auth diagnosis after ruling those out.

## If Cloudflare blocks a request

Cloudflare's firewall sits in front of the Leed CMS and now and then mistakes legitimate content for an attack. When it does, the request never reaches Leed.

1. **Recognize it.** The CLI fails with `request_blocked` (exit `5`). An MCP tool call, or any other request to the CMS, comes back with a 403 and an HTML page ("Just a moment…" or "Attention Required"), `server: cloudflare` or a `cf-ray` value, and no JSON error. It is not a permissions problem: do not ask for a different role or sign in again.
2. **Stop.** Retry the same write at most once. Never alter, encode, split or obfuscate the user's content to get past the filter: the content is theirs, and the false positive is Leed's to fix.
3. **Report it.** From the CLI, run the `leed feedback blocked` command in the error's `hint`; it carries the ray id, method, path and time (add `--excerpt-base64` from `error.request` when it is there). From MCP, call `report_blocked_request` with the `rayId`, the time as `occurredAt`, the method and path if you know them, the tool name and its argument names written as `name=` with no value as `command` (for example `update_page_body pageId= ops=`), and at most 2 KB of the body base64-encoded as `excerptBase64`. Never put the blocked text itself in `command` or `note`: the report crosses the same firewall.
4. **Tell the user.** Say what was blocked (which page, setting or asset, and which command or tool) and give the ray id, then continue with the rest of the work.

## Handling Conflicts

If `leed site push` fails due to remote changes:

```bash
# Stash your uncommitted changes (if any)
git stash

# Pull with rebase (merge commits are not allowed)
git pull --rebase origin staging

# Re-apply stashed changes (if any)
git stash pop

# If conflicts arise, resolve them manually, then:
leed site validate
leed site build
leed site commit -m "Resolve merge conflicts and apply changes"
leed site push
```

**Important:** Never use merge commits. Always rebase.

## Quick Publish (All Steps)

When the user says "publish" or "deploy my changes":

1. `git status` — check what changed
2. `leed site validate` — validate
3. `leed site build` — build
4. Show the user what will be committed: `leed site commit -m "message" --dry-run`
5. Ask user to confirm the commit message
6. `leed site commit -m "confirmed message"`
7. `git rev-parse origin/staging` to record the before commit, then `leed site push --json`
8. Verify on staging: wait for the deployment, then compare staging with production for one page per affected page type (Step 6)
9. Report what was checked and what was skipped (Step 7)
10. If nothing blocks, ask the user whether to promote to production
11. Promote only after the user's explicit yes, and only while the newest staging commit is still the one you verified (Step 8)
