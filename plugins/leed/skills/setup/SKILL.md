---
name: setup
description: Checks and installs everything Leed needs on this machine (Node, git, Bun, the leed CLI at the plugin's version, a signed-in company, the CMS MCP server, a site checkout), offers the Leed documentation MCP server once, and offers to turn on plugin auto-update. Safe to re-run; on a machine that is already set up it changes nothing. Run when the user runs /leed:setup or asks to set up, install or connect Leed.
---

# Leed Setup

You get this machine from nothing to a working Leed workspace: the `leed` CLI installed at the same version as this plugin, the user signed in to their company, the company's CMS connected to Claude over MCP, and the site's `raw-content` checkout on disk.

## Rules

- **Check before you change.** Every step below starts with a check. When the check passes, report it and move on without running the fix. On a machine that is already set up, the whole run is checks, an all-green table, and no changes.
- **Stop after the prerequisites if any is missing.** Node, git and Bun are OS-level: check all three, report every one that is missing with how to install it, and stop the run. You do not install them yourself.
- **Never drive an interactive command blind.** `leed setup` without `--json`, `leed auth login` and the installer open a browser or ask questions. Ask the user to run them with the `!` prefix (`! leed setup --env production`) or in their own terminal, wait for them to say it is done, then re-run the step's check.
- **Never turn on auto-update without asking.** Step 7 asks first, every time.
- **Offer the documentation server once.** Step 6 asks only when no answer is recorded, and records the answer either way.
- Use `--json` where a step says so and read the `data` fields named, rather than parsing human output. The full CLI reference is `../site-builder/references/cli-commands.md` (relative to this skill's directory).

## Step 1: Prerequisites (Node ≥ 22, git ≥ 2.31, Bun)

**Check:**

```bash
node --version    # v22.0.0 or later
git --version     # 2.31 or later
bun --version     # present; the leed CLI runs on Bun
```

**If any is missing or too old**, report each one with how to install it, then stop the run:

| Tool | macOS | Linux | Windows |
|---|---|---|---|
| Node 22+ | `brew install node` or nodejs.org | the distro's `nodejs` package if it is 22+, otherwise nodejs.org or a version manager such as `nvm` | the installer from nodejs.org |
| git 2.31+ | `xcode-select --install` or `brew install git` | the distro's `git` package | Git for Windows (git-scm.com) |
| Bun | `curl -fsSL https://bun.sh/install \| bash` | the same | `powershell -c "irm bun.sh/install.ps1 \| iex"` |

Tell the user to open a new terminal (or restart Claude Code) after installing, so the new `PATH` is picked up, and to run `/leed:setup` again.

## Step 2: The `leed` CLI, at this plugin's version

The plugin and the CLI are released together with one version number. Read this plugin's version from `../../.claude-plugin/plugin.json` (relative to this skill's directory, so the plugin root's `.claude-plugin/plugin.json`), field `version`. If it is `0.0.0`, this is an unbuilt development copy of the plugin: use `latest` as the target and say so.

**Check:**

```bash
command -v leed && leed --version
```

It passes when `leed` is on `PATH` and prints the plugin's version.

**Compare** the two versions numerically (major, then minor, then patch) and act on which side is behind:

- **Not installed:** `bun install -g @leed-ai/cli@<plugin version>`.
- **CLI older than the plugin:** the same command, `bun install -g @leed-ai/cli@<plugin version>`.
- **CLI newer than the plugin:** leave the CLI alone. The CLI updates itself to the latest release, so it being ahead is normal; installing the plugin's version would only be undone by its next self-update. The plugin is the side to move: tell the user to run `claude plugin update leed@leed` and restart Claude Code, or to turn on auto-update in step 7. Report this row as ❌ with that command, and carry on with step 3.
- **Same release, different pre-release or build** (for example `6.20.0-staging.3` against `6.20.0`): install `@<plugin version>` with the command above.

Install with Bun, never npm. The CLI's own updates (`leed self-update`, and the automatic check after a command) run `bun install -g`, and so does the installer, so a copy installed with npm would sit beside the Bun one and never be updated. Bun is already on the machine from step 1. If `command -v leed` points outside `~/.bun/bin` (an older npm install), tell the user to remove that copy with `npm rm -g @leed-ai/cli` once the Bun one is in place.

If `bun pm ls -g` lists the old package name `@leed/site-management`, suggest `bun remove -g @leed/site-management` once the new one is installed.

**Shell completion, whenever `leed` is on `PATH`.** Once the CLI is present (whichever row above applied, including one where nothing was installed), run `leed --json completion install`. The package runs no install scripts, so nothing else sets it up, and a CLI that was already at the plugin's version on an earlier run may never have had it. The command is idempotent: on a machine that already has completion it finds its line in the shell startup file and adds nothing, so run it every time rather than only after an install. If it fails (for example `interactive_input_required` when `SHELL` is not bash, zsh or fish), note it in the status table and carry on: completion is a convenience, never a reason to stop setup.

Re-run the check afterwards. If `leed --version` still prints the old version, an older binary comes earlier on `PATH`: report both paths (`which -a leed`) rather than calling the step done.

## Step 3: Sign in and set up the site

`leed setup` does both halves of this: it signs in to one Leed environment, then sets up the company's site checkout. Always pass `--env production`; it never guesses the environment. It never picks a saved login on its own either: there is no default login, so when a production company login is saved, name it with `--company <companyId>`. Its `--check` mode only looks: it asks the CMS whether the saved login is still accepted, and signs in to nothing, renews nothing, clones nothing and writes nothing, so the check below can never set a site up before the user has said where it goes.

**First, list the saved logins:**

```bash
leed auth status --json
```

Take the entries of `data.sessions` with `environment: "production"` and `legacy: false` (one per company), expired or not: `leed setup` counts every saved company login, including one whose token has expired, so count them the same way. Keep the ones with `expired: false` aside for step 5.

- **None:** run the check without `--company`.
- **One:** never pass it on your own; being the only saved login does not make it the company the user wants. Name it (`domain` and `companyId`, and say when it has expired) and ask the user whether to set up that company or sign in to another (use AskUserQuestion when it is available). On a yes, pass its `companyId` as `--company`. On a no, ask the user to run `! leed setup --env production --new-login`, choose the company when they approve the sign-in in the browser, and re-run step 3 when they say it is done.
- **Several:** ask the user which company to set up (use AskUserQuestion when it is available, listing each `domain` and `companyId`, with an option to sign in to another company), and pass that `companyId`. Signing in to another goes the same way as a no above.

Use the same `--company` in every `leed setup` command below; `<company flag>` stands for it (empty when there was none).

**Check:**

```bash
leed setup --env production <company flag> --check --json
```

- **`ok: false` with `invalid_arguments` and a hint holding `--company`:** a production login is saved and none was named. The message lists the saved logins; the hint holds `<companyId>` for you to fill in, never a company of its own. Re-read `leed auth status --json` and ask the user to pick the company as above. If you already passed `--company`, or the re-read still finds no company session, do not run the check again: report `error.message` and stop this step.
- **A warning says the token expired and can still be renewed:** the login is usable; the next `leed setup` renews it without a sign-in. Read `data.check` as usual.
- **`data.check.ready: true`:** report `data.login` (`domain` or `companyId`) and `data.site.rawContentRepo`, the checkout. Nothing to fix.
- **`data.check.needs` holds `"sign-in"` and a warning says the login is not bound to a company:** the saved login belongs to no company the CMS will name (a multi-company sign-in with none chosen), and `data.nextSteps` holds the `--new-login` command. Ask the user to run `! leed setup --env production --new-login`, choose the company when they approve the sign-in in the browser, and re-run the check when they say it is done.
- **`data.check.needs` holds `"sign-in"` otherwise:** there is no saved production login it can use, and signing in needs a person. Ask the user to run `! leed setup --env production <company flag>`. It shows the environment and CMS URL (and, with company logins saved and no `--company`, asks at the terminal which saved login to use or whether to sign in again), opens the browser, where they sign in and choose their company, asks which folder to put the site in (default `~/leed`), and sets the site up. Re-run the check when they say it is done.
- **`data.check.needs` is `["site"]`:** the login is fine, and no site is set up on this machine yet. Ask the user where the site should go (default `~/leed`; it ends up in `<folder>/<site>/raw-content`), then set it up: `leed setup --env production <company flag> --json`, adding `--dir <folder>` when they named another folder. With a usable login this runs unattended. Report `data.site` (`action: "initialized"`), then re-run the check.
- **Any other failure (`ok: false`):** report `error.message` and `error.hint`, and stop this step.

`leed setup` also sets up shell completion, and at a terminal it offers a VS Code workspace and the Leed plugin for Claude Code, each once. Run here, inside Claude, it never offers the plugin (that is this plugin, and `data.claudePluginAction` is `skipped`) and asks nothing under `--json`, so ignore those fields.

**Then recount the sessions** for step 5 when this step signed anyone in: re-run `leed auth status --json` and count the production company sessions with `expired: false`. Someone who works for several companies runs `! leed setup --env production --new-login` once for each company not signed in yet: it signs in afresh, they choose the other company in the browser, and that company's site is set up beside the first.

## Step 4: The site checkout

The CLI remembers every site set up on this machine in one registry, `~/.config/leed/sites.json`, with the path of each site's `raw-content` git checkout. `leed setup` puts the checkout under `~/leed/<site>/raw-content` by default, but it can be anywhere, and a moved folder is found again the next time a `leed` command runs inside it. Never look for a configuration file to find the site; ask the CLI.

**Check:**

```bash
leed site list --json
```

It passes when `data.sites` holds an entry with `sandbox: false` and `initialized: true` whose `paths` include one with `exists: true`. Report that path (the first one that exists). With several such sites, report them all, and use the one whose path holds the current directory, if any, for step 5.

**Fix:**

- **No site, or one with `initialized: false`:** ask the user to run `! leed setup --env production <company flag>`. It sets the site up for that company (at a terminal, with no `--company`, it asks which saved login to use), and is safe to run again.
- **A site whose paths all have `exists: false`** (the folder was moved or renamed): ask the user where it is now, and run `leed --json site validate` inside it. Any `leed site` command run inside a checkout records where it is.
- **Nothing installed at all** (step 2 could not install the CLI): the installer does steps 1 to 4 in one go, `! curl -fsSL https://app.leed.ai/install | bash`. It installs Bun and the CLI and then runs `leed setup --env production` itself. It needs bash, so on Windows the user runs it from Git Bash or WSL.

Re-check afterwards and report the checkout path. Do not run `leed site init` yourself: `leed setup` runs it when a site is needed.

**No Leed account yet?** Someone who wants to build before signing up can work in a sandbox site instead: `leed site init --sandbox <dir>` writes a local site that builds and previews offline, needs no sign-in and makes no checkout. It also installs Font Awesome Free; offline that step is skipped with a warning, and `leed site init --font-awesome` run inside the sandbox installs it later. `leed site list` shows it with `sandbox: true`. Report it in the status table as a sandbox rather than a checkout, skip step 5, and tell the user that `/leed:site-sandbox-move` moves it into Leed once they have an account and a real checkout from this skill.

## Step 5: Connect the CMS (MCP)

`leed mcp add --cms` registers the company's CMS MCP server with Claude Code. It never takes a login as a default, so it must be told the company: run it from inside the `raw-content` checkout found in step 4, where it takes that site's company and environment, or pass `--company <companyId> -e production` (the company from step 3). Do **not** pass a scope: the CLI picks one, user scope (every project) when there is one signed-in company and project scope (this site's `.mcp.json`) when there are several. Outside a site checkout it always picks user scope, so when step 3 found **more than one** production session, run it from inside the checkout.

```bash
cd <the raw-content checkout from step 4> && leed mcp add --cms --json
# or, from anywhere:
leed mcp add --cms --company <companyId> -e production --json
```

On `invalid_arguments` whose hint holds `--company`, nothing named the company: use the checkout, or the `--company` from step 3.

**Report** `data.scope` and each entry of `data.servers` with its `action`. All `unchanged` means the step was already done. `created` or `updated` means you just connected it.

On `external_command_failed`, the `claude` command is not on `PATH`, which user scope needs: report it, with `error.details`, and stop this step.

**Then explain the one-time MCP sign-in.** The CMS server asks the user to authorize Claude once:

1. If Claude has not picked up a newly added server yet, restart Claude Code (or start a new session).
2. Run `/mcp`, choose the Leed CMS server, and authenticate in the browser that opens.

**Verify:** when the CMS server's tools are available in this session, call one read-only tool (`get_company_overview`, or any `get_`/`list_` tool it offers) and report the company it returns. When they are not available yet, say that the check happens after the `/mcp` sign-in and a restart.

## Step 6: Leed documentation (optional, asked once)

The plugin does not connect to the Leed documentation MCP server (`Leed-Documentation`, `https://leed.ai/mcp`) on its own. It is offered here once, and the answer is recorded so no later run asks again.

**Check:**

```bash
leed mcp docs --json
```

It passes without a question when `data.registered` is `true`, or `data.answer` is `added` or `declined`: report it (⚪ for declined) and move on.

**Otherwise ask the user once** (use AskUserQuestion when it is available) whether to add the Leed documentation server, so Claude can look up how Leed works while it builds; it sends documentation search queries to `leed.ai`.

- **Yes:** `leed mcp add --docs --json`. It registers the server at user scope with `claude mcp add` and records the answer. Report each entry of `data.servers` with its `action`. On `external_command_failed`, the `claude` command is not on `PATH`: report it with `error.details`.
- **No:** `leed mcp docs --decline --json`, which records the answer. Report it as declined.

## Step 7: Plugin auto-update

Claude Code leaves auto-update off for third-party marketplaces, Leed's included. With it on, Claude Code updates the plugin at startup, so it stays at the same release as the CLI.

**Ask the user first**, every time, whether they want auto-update turned on for the `leed` marketplace (use AskUserQuestion when it is available). Never turn it on without a yes.

- **Yes:** walk them through it in the UI. Run `/plugin`, open **Marketplaces**, select `leed`, and choose **Enable auto-update**. Do not edit settings files for this. If the toggle is locked, their organization manages it through managed settings, and the organization's value applies: report that.
- **No:** report it as off, and give them the manual update: `claude plugin update leed@leed` (or `/plugin marketplace update leed`), then restart Claude Code.

## Finish: the status table

End every run with one table, a row per step, so the user can see the whole state at once:

| Check | Status | Detail |
|---|---|---|
| Node | ✅ | v22.11.0 |
| git | ✅ | 2.43.0 |
| Bun | ✅ | 1.2.4 |
| leed CLI | ✅ | 6.20.0, matches the plugin |
| Signed in | ✅ | 1 company (example.com) |
| Site checkout | ✅ | ~/leed/example-com/raw-content |
| CMS MCP | ✅ | user scope, unchanged |
| Docs MCP | ⚪ | declined (asked once) |
| Auto-update | ⚪ | off (user declined) |

Use ✅ for passed, ❌ for failed or still to do (say what the user must run), and ⚪ for a choice the user made. On a machine that was already set up every row is ✅ or ⚪, and say plainly that nothing was changed.

## Later: the startup version line

The plugin checks at every startup that the CLI and the plugin are the same version. It is silent when they are. When they differ it prints one line:

- *Leed CLI … is older than the Leed plugin …* → run `/leed:setup`, which installs the CLI at the plugin's version. (`leed self-update` goes to the latest release, which can overshoot the plugin and turn the line around.)
- *The Leed plugin … is older than the Leed CLI …* → `claude plugin update leed@leed`, then restart Claude Code.
- *… are different builds* → run `/leed:setup`, which installs the CLI at the plugin's exact version.
