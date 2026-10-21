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
| Leed CMS API (`app.leed.ai`) | Your sign-in, and the settings, pages, assets, contacts, imports and deployments you read or change | When a skill runs a `leed` command that talks to the CMS: `leed setup`, `leed auth`, `leed settings`, `leed page`, `leed asset list`, `get` and `export`, `leed contacts`, `leed import`, `leed deployments` |
| Leed feedback on a blocked request (`leed feedback blocked`, `report_blocked_request`) | The Cloudflare ray id of a request Cloudflare's firewall blocked, its method, path, status and time, the command or tool name without its values, the blocked body's size and SHA-256 and at most 2 KB of it base64-encoded, and your note | When a request to the CMS is blocked by Cloudflare's firewall and Claude reports it with `leed feedback blocked` or the `report_blocked_request` MCP tool |
| Leed installer (`app.leed.ai/install`) | A download request for the install script, which then runs `leed setup` (the Leed CMS API row) | When `/leed:setup` finds no Leed site set up on this machine and you run the installer it suggests |
| npm registry (`registry.npmjs.org`) | Package requests for `@leed-ai/cli` and your site's build packages | When `/leed:setup` installs or updates the CLI, on `leed self-update` and the CLI's daily update check, and when `leed site build` installs the site's packages |
| Leed static assets (`static-assets.leed.ai`) | A download request for a web font or Font Awesome Free | When `leed site build` finds a web font the site uses not yet installed in the checkout, or when `leed setup`, `leed site init --font-awesome` or `leed site init --sandbox` installs Font Awesome Free |
| Cloudflare (Wrangler usage metrics) | Wrangler's anonymous usage metrics, unless you turn them off with `wrangler telemetry disable` or `WRANGLER_SEND_METRICS=false` | When `leed site build --wrangler` runs a local `wrangler dev` server |
| Bun installer (`bun.sh`) | A download request | When `/leed:setup` finds Bun missing and you run its installer |
| Claude Design handoff bundle (the URL in its prompt) | A download request for the design bundle | When `site-design-import` imports a Claude Design handoff and you say yes to downloading the bundle URL its prompt holds |
| Your own staging and live site | Page, stylesheet and script requests | When `site-publish` checks staging against the live site before you promote |
| Your GitHub or GitLab (`gh api`, `glab repo view`) | Requests for your repository's numeric id, default branch, CI file path and merge settings | When `/leed:docs-ci` reads your repository's branch model, with the `gh` or `glab` sign-in you already have |

The release job `/leed:docs-ci` writes into your CI calls the Leed CMS from your CI pipeline when a release ships, not from your machine, so it is not a row above.

The plugin itself sends nothing: it declares no MCP server, and the startup version check runs `leed --version` on your machine and makes no network call.

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
