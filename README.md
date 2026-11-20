# Leed plugins for Claude

The official [Leed](https://leed.ai) plugin marketplace for Claude Code. It holds one plugin, `leed`, which teaches Claude how to build, preview and publish a Leed CMS website and connects it to the Leed documentation.

## Install

In Claude Code:

```
/plugin marketplace add leed-ai/ai-plugins
/plugin install leed@leed
```

Then run `/leed:setup`. It checks for Node 22 or later, git 2.31 or later and Bun, installs the [`leed` CLI](https://www.npmjs.com/package/@leed-ai/cli) at the plugin's version, signs you in to your company, connects your company's CMS to Claude over MCP, and fetches your site's checkout if you do not have one yet. It is safe to run again at any time: on a machine that is already set up it reports everything green and changes nothing.

## What the plugin contains

| Part | What it does |
|---|---|
| `setup` skill | `/leed:setup`: installs and checks everything Leed needs, and offers to turn on auto-update |
| `create` skill | `/leed:create blog` or `/leed:create documentation`: adds a blog or a documentation set to your site in one step, with its page type, menus, search and starter templates. On a Growth plan, `/leed:create recommendations` and `/leed:create cta` add recommendation cards and a CMS-managed call to action. `/leed:create` alone lists the recipes |
| `site-onboarding` skill | Ask Claude to build your site: it interviews you about your business, proposes your pages, menus and search, and once you confirm, sets up the menus, theme and fonts in your CMS and writes starter templates that follow Leed's rules, then hands blogs and docs to `/leed:create` and checks the result on staging |
| `site-patterns` skill | Leed's always/never rules for menus, forms, page lists, links, images, layouts, theming and CSS, so a site uses Leed's built-in systems instead of hand-built copies |
| `site-audit` skill | Checks a site against those rules and proposes a fix for each finding, naming the rule and the file and line. It reads only, and changes nothing until you say yes |
| `site-design-import` skill | Turns a Claude Design "Handoff to Claude Code" into your site's theme, layouts and partials: colors become brand tokens, navigation becomes CMS menus, images go to the asset manager, and anything it cannot map is listed for you. It shows you the plan before it changes anything, then audits the result and checks it on staging |
| `site-builder` skill | Creates and edits a site's templates, layouts, partials, CSS and JavaScript, and authors Leed Markdown content |
| `site-preview` skill | Builds the site and runs the local preview server |
| `site-publish` skill | Validates, commits and pushes site changes with the `leed` CLI, then checks them on the staging site against the live site (screenshots, console errors, broken links) and asks you before promoting them to production |
| `site-settings` skill | Reads and changes CMS settings with `leed settings` |
| `site-assets` skill | Uploads and manages files in the CMS asset manager with `leed asset` |
| `site-migrate` skill | Moves your docs to Leed from Docusaurus, MkDocs, GitBook, Mintlify, ReadMe, VitePress or Nextra: navigation to menus, pages to Leed Markdown, images to the asset manager and old URLs to redirects, with a report of anything it could not map |
| `site-sandbox-move` skill | Moves a sandbox site, one you built on your own machine with `leed site init --sandbox` before you had a Leed account, into your Leed site: it creates the page types, labels, pages, images, menus and forms the sandbox holds in your CMS, swaps every placeholder for the real id, copies your templates and CSS into your site, imports the content and checks that nothing of the sandbox is left |
| `docs-ci` skill | `/leed:docs-ci`: on a Growth plan, connects your product's GitHub or GitLab repository so your docs publish with the release that ships the code they describe. It creates the Leed OIDC trust for your release pipeline, adds the release job to your own CI as a dry run first (the `leed-ai/schedule-release` GitHub Action, or the GitLab component), and tells your agent which commit to stamp a docs edit with. It never commits or pushes: you review and merge the changes |
| `review` skill | `/leed:review`: after Claude writes your pages, you read, edit and comment on them in the Leed editor, then ask Claude to "review the comments on <page>". It reads every comment thread and answers each one with a tracked suggestion you accept or reject in the editor, and reports what it did for each comment. It never edits a commented page directly and never resolves a comment |
| `analytics` skill | `/leed:analytics`: ask how your docs, pages, readers, agents, accounts, releases, campaigns and email are doing, and Claude reads the answer from Know with the same numbers as the Know screens, within what your plan includes. Ask what to write next and it reads the evidence behind each Search & gaps item, proposes a new page or a revision of an existing one, and writes the draft or tracked suggestions linked to the item, so Know shows it in progress. It never publishes: you review and publish, and docs publish with your release |
| `campaign-patterns` skill | The shared rules Leed's campaign skills read before they start: the plan, role and company checks, one campaign per run and only once it is ready, where a campaign's context comes from, how every claim traces to a source, and which CMS tool each step uses. It also holds a checker for a campaign's brief, its research runs, its plan and its persona reviews, and turns a plan's days around the launch into dates in the campaign's timezone. It does not run on its own |
| `campaign-setup` skill | `/leed:campaign-setup <id>`: on a Growth plan, with the Content Publisher role, gets a campaign in Engage ready to run. It reads what Leed already knows (your company, personas, published and draft posts, docs and release notes, and your analytics), then proposes everything the campaign still needs, each with where it came from: the goal and business stage, the audience, KPIs with targets against your traffic, the launch date, timezone and owner, where posts go, the social channels and accounts, authors, voice notes, constraints, and which internal docs inform it. It asks only about what it cannot work out, and writes nothing until you say yes. Each value lands on the campaign page, where your team can change it |
| `campaign-research` skill | `/leed:campaign-research`: on a Growth plan, researches a ready campaign's market on the live web: its competitors and the category's history, what web search returns for its searches, the keywords its audience uses, or a topic you name. Researcher subagents search with WebSearch and read pages with WebFetch, and every finding cites its pages, each with its URL, the date it was read and a short quote. It shows you each run and saves it to the Research section of the campaign's brief only once you say yes. It reads your own site through the CMS, never from the web |
| `campaign-plan` skill | `/leed:campaign-plan <id>`: on a Growth plan, with the Content Publisher role, plans a ready, researched campaign in Leed. It writes the campaign's brief: its narrative, its messages, each with its source, and the questions each audience persona asks at each journey stage. Then it puts each pillar post, aimed at a keyword from the campaign's research, and its social copy for every channel account on the Plan calendar as draft deliverables, dated around the launch in the campaign's timezone. A pillar that needs a custom layout, such as a comparison page, can be planned as an unmanaged page built in your site's code, if you choose it, and each new page can be placed in a menu. It shows you the brief and the calendar and writes them only once you say yes. A re-run updates the plan in place, and it never approves, schedules or publishes anything |
| `campaign-draft` skill | `/leed:campaign-draft <id>`: on a Growth plan, with the Content Publisher role, drafts a planned campaign's content in Leed. Each pillar post becomes a DRAFT page in the campaign's posts page type at its planned slug, with its title, summary, keywords, labels, author, journey stage and planned date, and its SEO brief, image brief and claims list on its deliverable. Each social post gets its copy, sized for its network and account, with a placeholder where its tracked link goes. Everything is written in the campaign's voice and each author's, with every claim traced to the campaign's brief, and campaign-review scores each piece against its buyer persona. It lists what it will write and writes only once you say yes, and it never approves, schedules or publishes anything |
| `campaign-review` skill | `/leed:campaign-review <campaignId>`: on a Growth plan, reads each drafted post and piece of social copy in a campaign the way its target buyer would. A critic on a different model from the one that wrote it plays the persona at its journey stage, answers the brief's questions for the piece, scores it on a fixed rubric and checks every claim against a source. Claude makes one fix pass and the critic scores it once more, and the result is stored on the deliverable, where approvers see it on the Plan calendar. A result whose critic could not be shown to run on a different model always needs a person to accept it |
| `campaign-schedule` skill | `/leed:campaign-schedule <id>`: on a Growth plan, with the Content Publisher role, gets a reviewed campaign onto your publishing schedule. It sets each pillar post's feature image from its image brief, with an image you upload or pick in the asset manager, checks each post against the fields its page type requires, and gives each piece of social copy one tracked short link to its post, tagged to the campaign. It hands the posts to you to read and comment on in the editor, then lists every deliverable with what approving it does, and approves only on your yes: each post is scheduled to publish on its planned date, and each piece of social copy is ready for you to post by hand. An approved unmanaged page is pushed to staging through site-publish, checked there, and promoted to the live site only on your yes, and a page the plan placed in a menu gets its item, with the menu published on your yes. It moves approved posts to new dates, and never posts to a social network, or publishes a page unless you ask |
| Recipes and starter templates | The data `/leed:create` runs: each recipe's page type, its steps in order, and the starter layouts and stylesheet it copies into your site. Also the site-wide starter set `site-onboarding` uses: the site template, a header and footer on Leed's menu builder, the brand theme and buttons, and the settings it applies |
| Startup version check | A `SessionStart` hook that compares the plugin's version with `leed --version`. Silent when they match |

The skills drive the `leed` CLI, which `/leed:setup` installs. The plugin declares no MCP server, so nothing connects when a session starts. Your company's CMS server is added by `leed mcp add --cms` during setup, because it is bound to your company. The Leed documentation server (`Leed-Documentation`, `https://leed.ai/mcp`) is added only if you say yes when `/leed:setup` offers it, with `leed mcp add --docs`; setup records your answer and does not ask again.

## What leaves your machine

The plugin's skills send data off your machine only to the destinations below. Each one is reached by a command, a fetch or an MCP tool call that Claude Code asks you first to allow, unless you have already allowed it in your permission settings, so nothing is sent without your yes.

| Destination | What it receives | When |
|---|---|---|
| Leed CMS MCP server (`app.leed.ai/mcp/<companyId>`) | The CMS tool calls Claude makes and their arguments: page content, settings, assets | When Claude calls a CMS tool, after `/leed:setup` connects your company with `leed mcp add --cms` |
| Leed documentation MCP server (`leed.ai/mcp`) | Documentation search queries | When Claude looks something up in the Leed documentation, after `/leed:setup` adds it at your request with `leed mcp add --docs` |
| Your site's repository at Leed (`leed site push`) | Your committed site changes (templates, CSS, JavaScript, content files) and a notice to the CMS, which builds them to staging | When you publish with `leed site push`, and when `leed setup` or `leed site init` fetches the checkout |
| Leed CMS asset manager (`leed asset upload`) | The files you choose to upload, with their titles, alt text and labels | When you upload or edit an asset with `leed asset upload` or `leed asset set` |
| Leed CMS API (`app.leed.ai`) | Your sign-in, the settings, pages, assets, contacts, imports, deployments, personas, journey stages, campaigns, briefs and deliverables you read or change, and the Know analytics views you read | When a skill runs a `leed` command that talks to the CMS: `leed setup`, `leed auth`, `leed settings`, `leed page`, `leed asset list`, `get` and `export`, `leed contacts`, `leed import`, `leed deployments`, `leed know`, `leed persona`, `leed journey`, `leed campaign`, `leed plan` |
| Leed feedback on a blocked request (`leed feedback blocked`, `report_blocked_request`) | The Cloudflare ray id of a request Cloudflare's firewall blocked, its method, path, status and time, the command or tool name without its values, the blocked body's size and SHA-256 and at most 2 KB of it base64-encoded, and your note | When a request to the CMS is blocked by Cloudflare's firewall and Claude reports it with `leed feedback blocked` or the `report_blocked_request` MCP tool |
| Leed installer (`app.leed.ai/install`) | A download request for the install script, which then runs `leed setup` (the Leed CMS API row) | When `/leed:setup` finds no Leed site set up on this machine and you run the installer it suggests |
| npm registry (`registry.npmjs.org`) | Package requests for `@leed-ai/cli` and your site's build packages | When `/leed:setup` installs or updates the CLI, on `leed self-update` and the CLI's daily update check, and when `leed site build` installs the site's packages |
| Leed static assets (`static-assets.leed.ai`) | A download request for a web font or Font Awesome Free | When `leed site build` finds a web font the site uses not yet installed in the checkout, or when `leed setup`, `leed site init --font-awesome` or `leed site init --sandbox` installs Font Awesome Free |
| Cloudflare (Wrangler usage metrics) | Wrangler's anonymous usage metrics, unless you turn them off with `wrangler telemetry disable` or `WRANGLER_SEND_METRICS=false` | When `leed site build --wrangler` runs a local `wrangler dev` server |
| Bun installer (`bun.sh`) | A download request | When `/leed:setup` finds Bun missing and you run its installer |
| Claude Design handoff bundle (the URL in its prompt) | A download request for the design bundle | When `site-design-import` imports a Claude Design handoff and you say yes to downloading the bundle URL its prompt holds |
| Your own staging and live site, and the documentation site you migrate from | Page, stylesheet and script requests | When `site-publish` checks staging against the live site before you promote, and when `site-migrate` compares the staged pages with your current documentation site at your request |
| Web pages and search results campaign research reads (WebSearch, WebFetch) | Search queries built from the campaign's goal, audience, keywords and topic, and requests for the pages the research reads: search results, competitors' pages and the URLs the campaign names | When `/leed:campaign-research` researches a ready campaign's market, and when a campaign skill reads a URL the campaign names as context, or a live unmanaged page it has no site checkout for |
| Your GitHub or GitLab (`gh api`, `glab repo view`) | Requests for your repository's numeric id, default branch, CI file path and merge settings | When `/leed:docs-ci` reads your repository's branch model, with the `gh` or `glab` sign-in you already have |

The release job `/leed:docs-ci` writes into your CI calls the Leed CMS from your CI pipeline when a release ships, not from your machine, so it is not a row above.

The plugin itself sends nothing: it declares no MCP server, and the startup version check runs `leed --version` on your machine and makes no network call.

### How long Leed keeps it

What Claude writes to the Leed CMS through these skills (pages, settings, assets, menus, users, authors, contacts, campaign briefs with their research findings and quotes, and the deliverables on a campaign's plan) becomes your company's data in Leed and is kept until you change or delete it, or until the company is deleted. A blocked-request report is kept as feedback so Leed can find and fix the firewall rule. Leed's [privacy policy](https://leed.ai/legal/privacy-policy/) covers all of it. On your machine, the CLI keeps your sign-in (including your email) in `~/.config/leed/auth.json` and the sites you set up in `~/.config/leed/sites.json`; `leed auth logout` removes the sign-in.

## Versions

Every Leed release publishes the plugin with the same version number as the `leed` CLI. The `main` branch always holds the latest release, and each release is also tagged `vN.N.N`.

## Updates

The plugin and the CLI should always be the same release. At the start of each session the plugin checks, and when they differ it prints one line:

| The line says | Do this |
|---|---|
| the Leed CLI is older than the plugin | run `/leed:setup`, which installs the CLI at the plugin's version |
| the Leed plugin is older than the CLI | `claude plugin update leed@leed` (or `/plugin marketplace update leed`), then restart Claude Code |
| the two are different builds of one release | run `/leed:setup`, which installs the CLI at the plugin's exact version |

The check is silent when the versions match, when the CLI is not installed yet, and whenever it cannot tell (no shell, or `leed` does not answer within a few seconds). It never blocks a session.

### Auto-update

Claude Code leaves auto-update off for third-party marketplaces, this one included. To turn it on, run `/plugin`, open **Marketplaces**, select `leed`, and choose **Enable auto-update**. `/leed:setup` offers to walk you through it, and only after asking. With auto-update on, Claude Code updates the plugin at startup and asks you to restart to apply it.

## For organizations

Administrators can make the marketplace known, the plugin enabled and auto-update on for everyone through Claude Code [managed settings](https://code.claude.com/docs/en/settings), delivered as server-managed settings from the Claude admin console, through MDM, or as a `managed-settings.json` file:

```json
{
  "extraKnownMarketplaces": {
    "leed": {
      "source": { "source": "github", "repo": "leed-ai/ai-plugins" },
      "autoUpdate": true
    }
  },
  "enabledPlugins": {
    "leed@leed": true
  }
}
```

- `autoUpdate` set in managed settings locks the toggle: users see it in `/plugin` but cannot change it.
- `DISABLE_AUTOUPDATER=1` in the managed `env` turns off every automatic update, plugins included. Add `FORCE_AUTOUPDATE_PLUGINS=1` beside it to keep plugin updates on while Claude Code itself stays pinned.
- Each user still runs `/leed:setup` once, because the CLI, the sign-in and the CMS connection are per user.
