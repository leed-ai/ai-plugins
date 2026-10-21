# Staging Verification

How to check a pushed change on the **staging** site before offering to promote it to the live site. `SKILL.md` Steps 6–8 run this. The CLI reference is `../../site-builder/references/cli-commands.md`; read it rather than guessing a flag.

The work has three parts, in order:

1. **Wait and scope.** Wait for the staging deployment, then work out which pages the change affects.
2. **Render and compare.** Load each affected page on staging and on production, at desktop and mobile widths, and compare them.
3. **Links, audit and blocking.** Check links, run `site-audit` if it is installed, and decide whether anything blocks the promote offer.

Keep a running list of every check: what it covered, its result, and whether it was **skipped** and why. The report in `SKILL.md` Step 7 is built from that list.

## Tools: MCP first, CLI always

Every step names an MCP tool from the Leed CMS server and a `leed` CLI equivalent. The plugin ships only the documentation server, so the CMS tools (`list_deployments`, `get_company_overview`, `list_pages`, `get_page_type`, `list_broken_links`, `retry_deployment`, `promote_staging_to_production`) exist only when the user has added the CMS server. When they are missing, use the CLI equivalent and tell the user once that `leed mcp add --cms` adds them. Run the CLI equivalents from inside the site's checkout, where `leed site push` ran: there they take that site's company and environment, while outside a checkout the CLI defaults neither and refuses without `--company` and `-e`.

---

## Part 1: Wait and scope

### 1a. Record the commits

Before `leed site push`, record the commit staging stood on, so you can list what this push changes:

```bash
git rev-parse origin/staging   # the "before" commit, read BEFORE the push
```

After the push, the pushed commit is `git rev-parse HEAD`. The changed files are:

```bash
git diff --name-only <before>..HEAD
```

### 1b. Wait for the staging deployment

Read `data.notification` from `leed site push --json` first. Only `notified` creates a staging deployment, so only `notified` is worth waiting for:

| `data.notification` | What it means | What to do |
|---|---|---|
| `notified` | The CMS accepted the change set and a staging deployment is under way | Poll for it, below |
| `no_changes` | The commits are on the remote, but no `leed site commit` had been made since the last notification, so **no** deployment was created. `leed site notify-cms` would not create one either | Do not poll. Report that there is nothing new to verify. If the user wants, verify the current staging head instead: take the newest `preview[]` row as the commit to verify and continue from the status table below |
| `not_attempted` | Nothing was pushed (`pushed: false`), so nothing was sent and no deployment was created | Do not poll. Report that nothing was pushed and point the user at the push's `next` and warnings |
| `failed` | The commits are on the remote, but the CMS refused or never answered, so no deployment was created | Do not poll. Report `data.notificationError` and follow its `hint` (for example `leed site notify-cms`). Never push again to recover. Verification did not run, which blocks the promote offer |

When the notification is `notified`, poll until the staging deployment of the pushed commit has finished:

- **MCP:** `list_deployments` takes no arguments. Find the `preview[]` row whose `commitHash` is the pushed commit.
- **CLI:** `leed deployments status --json`, which reports the same preview and public lists and the promote gate.

Read the row's `status`:

| `status` | What to do |
|---|---|
| `triggered` or `started` | Still building. Wait about 20 seconds and poll again |
| `succeeded` | Continue to 1c |
| `failed` | **Stop.** Report the row's `errorMessage`. If `retryable` is true, offer a retry: `retry_deployment { deploymentId }` or `leed deployments retry <deploymentId>`. A failed build blocks the promote offer |
| `canceled` | Stop and report it. A newer push may have replaced it, so check for a newer preview row |

If no row for the pushed commit appears, or it is still building after about 10 minutes, stop polling. Report what you saw and that verification did not run. Do not wait forever.

### 1c. Resolve the two hosts

- **MCP:** `get_company_overview` returns `preview.domain` (staging) and `public.domain` (production).
- **CLI:** there is no command that prints the domains. A provisioned preview site is `staging.<domain>`, where `<domain>` is the live site's domain. Use that, or ask the user for the two URLs.

If production has never been promoted (`public[]` in `list_deployments` / `leed deployments status` is empty), there is no production baseline to compare against. Render staging on its own and report the comparison as **skipped, no production baseline**. A missing baseline does not block.

### 1d. Map the changed files to affected pages

Work through `git diff --name-only <before>..HEAD`. A file can affect pages in several of these ways at once.

| Changed file | Affected pages |
|---|---|
| A page template: `src/index.hbs`, `src/404.hbs`, any `.hbs` page in `src/` or in a `src/<page-type-slug>/` folder | That page's own URL |
| A layout: `src/_layouts/<name>.hbs` | Every page type whose `layout` is `<name>.hbs`, plus any `.hbs` page whose frontmatter `layout:` names it |
| A partial: `src/_includes/**/*.hbs` | Everything that includes it. A partial is called inline (`{{> name}}`) or as a **block** (`{{#> name}}`), with optional whitespace control (`{{~> name}}`, `{{~#> name}}`) and an optionally quoted name, so search for every form: `grep -rnE "\{\{~?#?>\s*\"?<partial-name>" src/`. Follow each hit up to the layouts and pages that use it, again through the partials that include *those* partials. A layout reached this way maps to its page types as in the row above |
| The master wrapper: `src/_includes/site-template.hbs` | Every page type, plus the home page. Pages and layouts call it as a block partial (`{{#> site-template}}`), and it carries the header, footer and `<head>` of every page |
| Shared styles and scripts: `tailwind/**`, `src/static/js/**`, other files under `src/static/` | Every page type, plus the home page |
| Anything else the rows above do not match | Treat it as shared: every page type, plus the home page |

To find the page types that use a layout:

- **Offline:** `src/_data/pageTypeList.json` holds every page type with its `slug`, `name` and `layout`. It is a read-only local copy, refreshed by the build.
- **CLI:** `leed settings pagetype list --json`, then `leed settings pagetype get <pageTypeId>` for the layout.
- **MCP:** `list_page_types` does not return `layout`; use `get_page_type` for each one.

When the search finds **no** callers for a changed partial, do not conclude that it affects nothing: a CMS system partial or a dynamic partial name can call it where the search cannot see. Treat it as shared and cover every page type plus the home page. The same applies whenever you cannot tell what a partial reaches.

### 1e. Pick the pages to check

Check one published page per affected page type. For a page template, check that page.

- **MCP:** `list_pages { pageTypeId }`.
- **CLI:** `leed page sync-state --page-type-id <pageTypeId>` lists every page in the type with its path and status.

Pick a page whose status is `PUBLISHED`. Being published does not by itself put a page on both hosts: content publishes (pages, menus, forms, labels, settings) deploy to production only, so staging's content lags production's until the next staging build takes it in. **Prefer a page whose last publish (`publishedAt`) is older than the staging deployment's `createdAt`**, so the page is the same on both hosts and any difference comes from the template change. Prefer a page with typical content over an empty or unusual one. A page type with no published page is reported as **skipped, no published page**.

When the change is a single page type's layout, one page is enough. When it is a shared style or script, that is one page per page type, plus the home page.

---

## Part 2: Render and compare

### 2a. Choose the browser

Use whichever browser tool the session has: Claude in Chrome, the built-in browser in the Claude desktop app, or a Playwright MCP server. Load that tool's own skill or instructions first. If none is available, go to **2d. No-browser fallback**.

### 2b. Render each page on both hosts at both widths

For each page from 1e, load it four times:

| Host | Desktop | Mobile |
|---|---|---|
| Staging (`https://<preview domain><path>`) | 1440px wide | 390px wide |
| Production (`https://<public domain><path>`) | 1440px wide | 390px wide |

Resize the window or the viewport to the width before taking each screenshot, and wait for the page to finish loading (fonts, images and scripts). Capture a full-page screenshot where the tool supports it, otherwise the first screen and one further screen down.

**Read the browser console on every staging load.** An error (an uncaught exception, a failed script or a stylesheet that does not load) blocks the promote offer. A warning is reported but does not block. When production shows the same error, say so: it is not new, but it still blocks, and the user can accept it by name (see 3d).

### 2c. Compare and report regressions

Show the user the screenshots **side by side**: staging next to production, for each page and each width, labeled with the page type, the path, the width and the host.

Then list the differences concretely. Look for:

- Layout breaks: overlapping or misaligned elements, content overflowing the viewport, horizontal scrolling at 390px.
- Missing or wrong styles: unstyled text, lost colors or fonts, broken spacing.
- Missing elements: a header, footer, navigation, image or form that production shows and staging does not.
- Broken images or icons.

A difference the change was meant to make is not a regression. Say which differences you think are intended, and ask the user to confirm them. **A visual regression the user has not accepted blocks the promote offer.**

A difference that comes from **content**, not from the change, is **content lag**: a page, a menu entry or a form that production shows and staging does not, because it was published to production after the staging build. Check it against the publish times (the page's `publishedAt`, or a `public[]` deployment row with a content reason such as `page_publish` or `menus` newer than the staging row's `createdAt`). Report content lag on its own line. It is not a regression and does not block.

### 2d. No-browser fallback

When no browser tool is available, verify the HTML instead:

1. Fetch each page from both hosts with `curl -sL` or WebFetch.
2. Compare the structure: the `<title>`, the main landmarks (`header`, `nav`, `main`, `footer`), headings, and the `<link rel="stylesheet">` and `<script src>` tags.
3. Request every stylesheet and script the staging page links, and confirm each returns HTTP 200: `curl -s -o /dev/null -w "%{http_code}" <url>`. A missing stylesheet or script blocks, like a console error.
4. Compare asset paths ignoring a content hash in the file name. A built CSS file can be named differently on each host, and that is expected.

Then **say plainly** in the report that screenshots, the visual comparison and the console check were **skipped, because no browser was available**, and that only the HTML was checked. Do not describe a page as looking right when you have not seen it.

---

## Part 3: Links, audit and blocking

### 3a. The stored broken-link report (context only)

- **MCP:** `list_broken_links`.
- **CLI:** `leed settings brokenlinks list --json` returns `checkedAt`, `links[]` and `byPage{}`.

This is the **last stored check**, not a fresh crawl and not specific to staging, so it cannot tell you what this push broke. Show it as context, with its `checkedAt` date, and point out any affected page that appears in it.

### 3b. New broken links on staging

To decide whether this push introduced a broken link, check each staging page from 1e directly:

1. Collect the same-site URLs on the staging page: each `href` and `src` that points at the staging host or is a relative path. Take them from the page in the browser, or from the fetched HTML. Leave out external sites.
2. Request each one on staging. Cap it at about 50 URLs per page, and report when you stopped at the cap.
3. For each URL that fails on staging (a 4xx or 5xx status, or no response), request the same path on production.
4. **A link is new** when it fails on staging and production either does not have it or serves it successfully. **A new broken link blocks the promote offer.** A link that fails on both hosts was already broken: report it, but it does not block.
5. Before you call a link new, rule out **content lag** (see 2c): a link to a page, or from a menu, that was published to production after the staging build fails on staging only because staging has not taken that content in yet. Report it as content lag, not as a new broken link. It does not block.

### 3c. site-audit

If a `site-audit` skill is among the available skills, run it on the changed files from 1a and include its findings: its changed-files mode takes those paths and checks only them. An audit failure blocks the promote offer. An audit failure is any finding of severity `error`; `review` findings and justified exceptions are reported but do not block.

If `site-audit` is not installed, do not improvise one. Record it as **skipped, not installed**.

### 3d. What blocks the promote offer

| Finding | Blocks? |
|---|---|
| The staging deployment failed, was canceled, or never appeared | Yes |
| A console error on a staging page | Yes |
| A staging stylesheet or script that does not return 200 (no-browser fallback) | Yes |
| A new broken link on staging (3b) | Yes |
| A visual regression the user has not accepted | Yes |
| A `site-audit` failure, when it ran | Yes |
| The push did not notify the CMS (`notification` is `failed`), so nothing was verified | Yes |
| A console warning | No, report it |
| Content lag: a page, link or menu entry missing on staging only because it was published to production after the staging build | No, report it as content lag |
| A link that is broken on both hosts | No, report it |
| A skipped check: no browser, no CMS MCP tools, no production baseline, no published page in a type, `site-audit` not installed | No, report it with the reason |

A skipped check never blocks on its own, and it is never reported as passed. When everything that blocks is clear, `SKILL.md` Step 8 may offer to promote. When anything blocks, report it and do not offer.

If the user wants to promote anyway, they must first name the blocking findings they accept. Record that in the report. Even then, promote only on their explicit yes to the promote question itself.
