# Leed CLI Commands Reference

The `leed` CLI (`@leed-ai/cli`) is the customer's tool for local site development.

## Installation

The `leed` CLI is installed via the one-line installer served by the CMS. It checks for curl, git 2.31 or later and Bun (offering to install or upgrade Bun at a terminal; without one it never installs Bun unasked, but prints how and stops), runs `bun install -g @leed-ai/cli@<tag>` (or the version named with `bash -s -- <version>`, which is installed even when the CLI already meets the minimum), sets up shell tab completion with `leed completion install` (best effort: a failure only warns), and then hands off to `leed setup --env <env>` for the environment it was served from, which signs you in and sets your site up (see *First-time setup* below). Without a terminal (CI, or a pipe with no TTY) it stops after installing the CLI and prints the `leed setup` command to run. The package runs no install scripts, so completion is set up by that explicit step, never by the package manager. The package comes from the public npm registry in every environment, and no registry config or token is written.

```bash
# Visit https://app.leed.ai/install in a browser to log in and copy the
# environment-tagged install command, or run it directly:
curl -fsSL https://app.leed.ai/install | bash

# Pin a specific version (otherwise the env's default tag is used):
curl -fsSL https://app.leed.ai/install | bash -s -- 1.2.3
```

The installer uses `bun` for the global install. Without the installer, `npm i -g @leed-ai/cli` (or `bun i -g @leed-ai/cli`) installs the same CLI with no token; Bun must still be on the machine, because `leed` runs on it. If you are moving from the old `@leed/site-management` package, run `bun remove -g @leed/site-management` first.

## First-time setup (`leed setup`)

```bash
leed setup --env production                 # Sign in, choose the folder, set the site up
leed setup --env production --dir ~/sites   # Put sites somewhere other than ~/leed
leed setup --env production --company acme.com  # Reuse the saved login for that company
leed setup --env production --new-login     # Sign in again, to add another company
leed setup --env production --json          # Finish setup unattended (no questions)
leed setup --env production --check --json  # Only report what is left to do; changes nothing
```

`leed setup` is what the installer runs once the CLI is installed, and it is safe to run again at any time. It works on exactly one environment: `--env <dev|staging|production>`, else `ENV_NAME`. It never falls back to a default, the site you are in or a login for another environment, and it refuses with `invalid_arguments` (hint `leed setup --env production`) when neither names one. Before signing in it prints the environment and the CMS URL it talks to; `LEED_CMS_URL` overrides that URL (the installer sets it only for `dev`, and `leed setup` warns when it redirects another environment).

Each step checks before it acts:

1. **Sign-in.** There is no default login, and setup never picks a saved one on its own. `--company <companyId|domain>` names the saved login to reuse; without it, an environment holding company logins asks at a terminal which one to use (or to sign in again), and an unattended run (`--json`, `--check`, no terminal) refuses with `invalid_arguments` listing the saved logins, its hint the exact `leed setup --env <env> --company <companyId>` — with one saved login as with several. An environment holding no company login goes on as before: a login bound to no company is used, else you sign in. The chosen login is reused once the CMS accepts it; one the CMS cannot be reached about is kept with a warning, and one it refuses is replaced by signing in again. Signing in is the browser device flow, where you choose the company (when `--company` or the terminal choice named one, the sign-in is bound to it, and an approval for any other company is refused with `invalid_arguments` before anything is set up), or `--email [address]` for a magic link. The run then stops: the link signs in your browser, not the CLI, so click it and run `leed setup` again, which finishes with a browser sign-in in that already signed-in browser. `--new-login` signs in even when a login is saved, which is how someone who works for several companies adds the next one. A saved login the CMS accepts but places in no company (a multi-company sign-in with none chosen) cannot pick the site: at a terminal setup offers the browser sign-in (default yes), where you choose the company; after a no, or under `--json`, it refuses with `not_authenticated` and the hint `leed setup --env <env> --new-login`.
2. **Folder.** `--dir <folder>`, else a prompt at a terminal, else `~/leed`. `~` is expanded, a relative path is resolved against the current directory, and symlinks are resolved.
3. **Site.** A site already set up for the login's company is kept: silently when it is under the folder, and after a "Keep using it?" question (default yes) when it is elsewhere. After a no, naming a folder above that checkout sets up a new copy there; only the folder it sits in as `<folder>/<site>/raw-content` keeps it, since another copy cannot go there. A registered folder that now holds another site (its `identity.json` disagrees) is not reused. Otherwise `leed site init --dir <folder> --company <login company>` runs, and the site must then be in the registry. Font Awesome Free is installed into the site; a failure is a warning naming `leed site init --font-awesome`.
4. **Shell completion,** with the same code as `leed completion install`. It is idempotent and best effort, and reports one line: installed, already installed, or not installed with the reason (skipped when `SHELL` is not bash, zsh or fish, or the install failed). The completion library's own output is not shown.
5. **VS Code workspace,** offered once (default yes) when `code` is on `PATH`, a person is at a terminal, and no `.code-workspace` is beside the checkout yet. A yes writes the files `leed site vscode` writes, but only those that are missing: a `raw-content/.vscode/tasks.json` the site already has is kept, and setup says so. An existing workspace is never overwritten, and a no is recorded in `~/.config/leed/preferences.json` and never asked again.
6. **The Leed plugin for Claude Code.** When `claude` is on `PATH`, `claude plugin list --json` says whether `leed@leed` is installed. A `leed` plugin that is installed but disabled (`enabled: false`) adds no skills, so it is reported as `disabled`: at a terminal setup offers `claude plugin enable leed@leed` (default yes) and checks again; otherwise it prints that command. If it is not installed, at a terminal setup offers to install it (default yes) with `claude plugin marketplace add leed-ai/ai-plugins` and `claude plugin install leed@leed`, then checks `claude plugin list --json` again; when that fails, or nobody can be asked, it prints the commands to run in Claude: `/plugin marketplace add leed-ai/ai-plugins` and `/plugin install leed@leed`. With no `claude` but a `~/.claude` folder (the desktop app or an IDE extension) it prints those commands; with neither, one line says the plugin exists. It says nothing when the plugin is installed, when run inside Claude Code (`CLAUDECODE` is set), or after a no to either offer, which is recorded in `preferences.json` and never asked again.
7. **Next steps:** `cd` into the checkout, run `/leed:setup` in Claude there, and preview with `leed site build --serve`.

For `dev`, every `leed` command setup prints for you to run that reaches the CMS (next steps, hints, the command after a magic link) starts with `LEED_CMS_URL=<url>` (local ones such as `leed site list` and `leed completion install` are printed bare), the CMS URL the run talked to, as the installer's own hint does: a local backend's port varies.

Under `--json` it never prompts and never offers the workspace or the plugin: the folder defaults to `~/leed`, a site elsewhere is kept, and when a sign-in is needed it refuses with `interactive_input_required` and the hint `leed setup --env <env>`, before opening anything (with `--email` too: a magic link signs in the browser only, and the CLI's sign-in still needs a person). On success `data` holds `environment`, `cmsUrl`, `login` (`action`: `reused`, `signed-in` or `magic-link-sent`; `companyId`, `domain`, `email`, `verified`), `folder` (the folder for a `<folder>/<site>/raw-content` checkout, else the directory holding it), `site` (`action`: `kept` or `initialized`; `rawContentRepo`, `companyId`, `domain`), `fontAwesome` when it ran, `completion` (`action`: `installed`, `already-installed`, `skipped` or `failed`; `shell`, `shellRcPath`, `reason`), `vscodeWorkspace` (`action`: `written`, `exists`, `declined`, `declined-before`, `no-editor`, `not-offered` or `failed`; `workspaceFile`, `kept`), `claudePlugin` (`installed`, `disabled`, `not_installed` or `unknown`), `claudePluginAction` (`none`, `installed`, `install-failed`, `enabled`, `enable-failed`, `declined`, `declined-before`, `instructions`, `mentioned` or `skipped`), and `nextSteps`.

`--check` only looks: it asks the CMS about the saved login (`GET /api/user/me`, which rotates nothing) and reads the registry, and writes nothing: it renews no token, files no login under a company, signs in to nothing, asks nothing (so with company logins saved it needs `--company`, or `--new-login`, which reports `needs: ["sign-in"]` without looking at the saved logins), clones nothing and skips completion, the workspace and the plugin. `data.check` is `{ ready, needs }`: `ready: true` with `login`, `folder` and `site` when nothing is left to do; otherwise `needs` holds `sign-in` (no saved login can be used, so a person runs `leed setup` at a terminal) or `site` (signed in, no site yet; `leed setup --json`, with `--dir`, sets it up unattended), and `nextSteps` is that command.

`leed site init`:

- Creates a folder named after the site in the directory you choose (`--dir`, default: the current one)
- Clones the customer's `raw-content` GitLab repository into it (checks out `staging`)
- Configures git and Husky hooks
- Records the site in the site registry, `~/.config/leed/sites.json` (see *Sites on this machine* below)

The CLI does not write AI skills or editor files into your site. The skills come from the Leed Claude plugin, and `leed site vscode` writes the VS Code workspace when you want one. A site set up by an older CLI has its old `.claude/skills` copies removed once, when its old configuration file is imported into the registry; anything else in `.claude`, and an existing `.code-workspace` or `.vscode/`, is left alone.

Build output is written to `<raw-content>/.build/` by `leed site build`.

## Machine-Readable Output (`--json`)

Every command takes `--json`. Setting `LEED_JSON=1` in the environment is exactly equivalent, for a caller that cannot control argv — the two produce byte-identical stdout.

In JSON mode:

- **stdout carries exactly one JSON document and nothing else.** One line, newline-terminated. No progress lines, no warnings, no color escapes — not even under `FORCE_COLOR=3`.
- **Everything else goes to stderr** — log output, Commander's own usage text, the bare version string. Show stderr to a person; parse stdout.
- **Exit code is 0 on success and non-zero on failure, and the number says what kind of failure it was** — see *Exit codes* below. A script should test for non-zero, never for `1`: most failures exit 2–5. A command may exit non-zero while reporting `ok: true` when a later step failed after the result was determined (`leed site upload` does this when the CMS callback fails); the cause is in `warnings`.
- No prompts, no color, and no self-update check.

The examples below are pretty-printed for reading. What the binary actually writes is a single line:

```json
{"ok":false,"command":"site.validate","version":"<version>","error":{"code":"not_a_site_repo","message":"No Leed site found at or above /home/you/projects.","hint":"Run this command inside your site's checkout, pass --site <name|domain|companyId> (see leed site list), or run leed site init"}}
```

### The envelope

Both branches carry `ok`, `command` (the dotted command identifier) and `version` (the CLI's own version). Check `ok` first, then read `data` or `error`. Either branch may also carry `next` — see *Following `next`* below.

`version` is whatever CLI actually ran; the examples below write `<version>` in its place rather than pinning a release that goes stale with the next one. Read it from the document, or from `leed --version --json`.

**Success** — `leed site eject --json`:

```json
{
  "ok": true,
  "command": "site.eject",
  "version": "<version>",
  "data": {
    "action": "list",
    "tier": null,
    "templates": [
      {
        "name": "unsubscribe",
        "description": "Email unsubscribe page — full page replacement.",
        "destination": "src/_includes/unsubscribe.hbs",
        "customized": false
      },
      {
        "name": "unsubscribed",
        "description": "Post-unsubscribe confirmation page — full page replacement.",
        "destination": "src/_includes/unsubscribed.hbs",
        "customized": false
      }
    ],
    "ejected": null
  },
  "warnings": []
}
```

`data` is the command's own payload; its shape differs per command and is published by `leed schema <command> --json`. `warnings` is non-fatal problems the command hit while still succeeding — it is **always present** on the success branch and `[]` when there were none, so it can be iterated unconditionally.

**Failure** — `leed asset list --json` with no stored session:

```json
{
  "ok": false,
  "command": "asset.list",
  "version": "<version>",
  "error": {
    "code": "not_authenticated",
    "message": "Not authenticated for staging.",
    "hint": "leed auth login --env staging"
  }
}
```

- `error.code` is from the closed enum below. **Branch on this, never on message text.**
- `error.message` is a human-readable summary, safe to show a user verbatim.
- `error.hint` is optional: the single concrete next step, phrased as an instruction — often a command to run. Absent only when there is no action the caller can take.
- `error.details` is optional free-form diagnostic text, such as a failed build's or subprocess's own output. It is for a log or a human — never branch on it.
- `error.exit` is the process exit status this failure produces (see *Exit codes*), and `error.retryable` says whether repeating the same call unchanged can succeed. Both are always present on a failure.
- `error.issues` is optional and appears on `invalid_arguments` (a `leed settings` write the CMS refused field by field) and `validation_failed`: one entry per offending field, at most ten, each `{ path, message, code }`. It is the branchable companion to `details` — `path` is the dotted field name (kebab-case each segment to get the flag that set it), `message` is what the schema expects there, and `code` is the validator's own open-ended code. Absent rather than empty when there are none, so test for presence before iterating.
- `error.reported` is optional and only ever appears in human mode, where an interactive helper has already printed the failure. It never appears under `--json`; ignore it.

### Error codes

The enum is closed — these seventeen are the only values `error.code` can take. The remedy column is the part that matters.

| Code | What happened | What to do |
|---|---|---|
| `not_authenticated` | No usable credentials for the target environment. | **Stop and ask your user** to run the command in `hint`. You cannot resolve this yourself — see *Authentication failures* below. |
| `auth_expired` | Credentials exist but have lapsed. | Same: stop and ask your user to run the command in `hint`. Do not retry; it fails identically. |
| `permission_denied` | Authenticated, but this account is not allowed to do this. | Retrying and re-authenticating both fail the same way. Report it to your user — someone with the right role has to grant access, or the operation has to be abandoned. |
| `request_blocked` | Cloudflare's firewall in front of the CMS refused the request as suspicious (a 403 with an HTML "Just a moment…" page, `server: cloudflare` and a `cf-ray`) before Leed saw it. Usually something in the content looks like an injection attempt to it: a backtick-wrapped shell command, `/proc/version`. | **Not a permissions problem.** Retry the same write at most once, and **never alter, encode, split or obfuscate the user's content to get past the filter.** Report it: `hint` is the `leed feedback blocked` command with every value filled in, and `error.request` carries the ray id, method, path, time and the body's size, SHA-256 and base64 excerpt. Tell your user what was blocked and the ray id, then go on with the rest of the work. See *Reporting a Cloudflare block* below. |
| `not_a_site_repo` | The working directory is not a Leed site checkout. | `cd` into the site's `raw-content` checkout (find it with `leed site list --json`), or pass `--site <name>` to a `leed site` command, and retry. Do **not** run `leed site init` to "fix" this unless your user actually asked for a new site. |
| `sandbox_site` | The working directory is a local sandbox site (`leed site init --sandbox`), which has no company in the CMS, and this command needs the CMS. | Do not log in or retry: neither helps. The site has to be moved into Leed first with the `/leed:site-sandbox-move` skill, which `hint` names. See *Sandbox sites* below. |
| `invalid_arguments` | The options or arguments supplied cannot be used — including a `leed settings` field the CMS refused, named in `error.issues`. | Fix the invocation and retry. `leed schema <command> --json` gives you the authoritative option list. |
| `validation_failed` | Site content, configuration or repository state failed validation. | Read `message`; it names the problem (a protected file modified, the wrong branch, nothing to commit). Run `next` when present, fix it otherwise, and re-run. |
| `build_failed` | The static site build did not complete. | Read `error.details` for the build output, fix the template or content it names, and re-run `leed site build --json`. |
| `upload_failed` | Transferring content or assets to the CMS did not complete. | Often transient — retry once. If it repeats, hand `message` and `details` to your user. |
| `network_error` | A request to the CMS or the git host could not be completed. | Retry with backoff. If it persists it is connectivity or an outage, not something you can fix — tell your user. |
| `external_command_failed` | A program the CLI drives — git, or the package manager behind `leed self-update` — is missing, refused the operation, or exited non-zero. The fault is in the environment or the repository, not in the CLI. | **`error.details` is always present on this code**, carrying the exact invocation followed by that program's own output, including any remedy the program printed. Read it and act on what git said (resolve the conflict, `git checkout staging`, install git), or surface it to your user. |
| `interactive_input_required` | The command needs a person at a terminal and cannot proceed. | Do not retry — it will fail identically forever. `hint` names what the human has to do. See *Commands that refuse under `--json`*. |
| `confirmation_required` | The command is destructive and needs `--yes` to proceed unattended. | **Do not add `--yes` on your own initiative.** Ask your user, quoting `message`, and pass `--yes` only once they have said yes. |
| `not_found` | The requested page, page type, template, command or resource does not exist. | Check the name against what exists (`leed settings pagetype list --json`, `leed site list --json` for a `--site` name, `leed site eject --json`, `leed cli search "<task>" --json` for a command) and retry, or report that it is missing. |
| `conflict` | A `leed settings` write was refused because the record changed underneath it (a concurrent edit, or a slug another record already publishes under), or `leed site push` stopped on a rebase merge conflict. | For settings, re-read the record (`leed settings <noun> get`), decide whether the change is still wanted, and re-send — `error.retryable` is true only for a concurrent edit. For a push, resolve the conflict in the checkout and push again. |
| `internal_error` | An unexpected fault in the CLI itself. | Nothing you can do. Capture the whole document and report it to your user. Do not retry in a loop. |

The same list, with each code's exit status, is published as `data.errorCodes` in the `leed schema --json` index, so it can be read at runtime rather than hard-coded.

### Exit codes

The exit status says what kind of failure happened, so an agent can decide what to do before it parses anything. `ok` in the document is still the precise signal. **Scripts should test for non-zero, not for `1`** — most failures exit 2–5, and `1` now means only an unclassified fault.

| Exit | Meaning | What to do | Error codes |
|---|---|---|---|
| `0` | Done | Continue; follow `next` if present | — |
| `1` | Unclassified | Read the error | `internal_error` |
| `2` | Usage | Fix the call | `invalid_arguments`, `not_found` |
| `3` | Precondition unmet | Run `next` when present, otherwise follow `hint` | `not_a_site_repo`, `sandbox_site`, `validation_failed`, `build_failed`, `conflict`, `external_command_failed`, `upload_failed` |
| `4` | Transient | Retry with backoff | `network_error` |
| `5` | Needs a person | Stop and ask | `not_authenticated`, `auth_expired`, `permission_denied`, `request_blocked`, `confirmation_required`, `interactive_input_required` |
| `128+n` | Interrupted: `130` for Ctrl-C, `143` for `SIGTERM` (`leed site build --wrangler` ends this way). The document may be `ok: true` | Treat the run as cut short | — |

A failure's `error.exit` always equals the process exit status. A Commander usage error — an unknown option, a missing argument — exits `2` with or without `--json`; `--help` and `--version` exit `0`.

**A non-zero exit does not always mean `ok: false`.** The exit status reports the whole run; `ok` reports the command that produced the document. When the main work succeeded and a later step failed, the document is `ok: true`, the cause is in `warnings`, and the run exits with the failed step's class:

- `leed site push` — the commits reached the remote but notifying the CMS failed: `data.notification` is `"failed"`, the cause is in `data.notificationError`, and the exit is that error's class.
- `leed site upload` — the upload succeeded but the CMS callback did not: exit `4`.
- `leed page create` — the page was created but its body could not be filled: exit is the fill error's class.
- `leed page create --source-id` / `leed page update --source-id` — the content landed but the CMS could not tag it with the source id: `data.sourceIdWritten` is `false`, the CMS's reason is in `warnings`, the exit is `3`, and `next` is the `leed page stamp` that sets the tag on its own.
- `leed page stamp` — one or more pages failed, including when every page did: `data.failed[]` names each with its `code`, and the exit is the first failure's class.
- `leed asset upload --save` — some files failed: exit `3`, with per-file results in the document.
- `leed settings publish` — some units failed to publish: exit `4`.

The table is published as `data.exitCodes` in the `leed schema --json` index.

### Authentication failures

`not_authenticated` and `auth_expired` always carry `hint: "leed auth login --env <env>"` with the real environment substituted. That hint is enforced across every command that can fail on authentication, not written by hand at each site.

**An agent cannot resolve an authentication failure itself.** `leed auth login` opens a browser and waits for a person to approve a verification code; there is no flag that gets you past it. When you see either code, stop what you are doing and ask your user to run the exact command in `hint`, then retry once they confirm. Anything else is a loop that cannot terminate.

The one deliberate exception is `leed site upload` running in CI, where nobody can finish a browser login: it reports `not_authenticated` with `hint: "Set LEED_API_TOKEN on the build trigger"`, because that is the remedy that actually exists there.

### Commands that refuse under `--json`

`--json` is a valid flag on every command with no exceptions, so a command that cannot finish unattended answers with an ordinary `ok: false` envelope rather than rejecting the flag.

**Structurally interactive commands** refuse with `interactive_input_required`, before touching anything:

- `leed auth login` and `leed login` — sign-in opens a browser and waits for a person to approve a code.
- `leed setup` — only when no saved login for the environment can be used, because signing in needs a person. With a usable login it runs unattended, and `--check` never refuses for this: it reports `check.needs: ["sign-in"]`.
- `leed site build --serve` — the dev server runs until a person stops it, so it never reaches the single closing document `--json` promises. Use `leed site build --json` for a one-shot build.
- `leed completion install` — only when `SHELL` is unset or names an unsupported shell, because choosing one needs a question.

```json
{
  "ok": false,
  "command": "auth.login",
  "version": "<version>",
  "error": {
    "code": "interactive_input_required",
    "message": "Signing in opens a browser and waits for a person to approve a verification code, which cannot be done on an unattended --json run.",
    "hint": "Ask a person to run `leed auth login --env staging` at a terminal, then run this command again"
  }
}
```

**Destructive commands** need `-y, --yes`. Without it they refuse with `confirmation_required`:

- `leed auth reset`
- `leed auth rotate`
- `leed site validate --reset`
- `leed settings oidctrust create` — it grants a CI pipeline token access to the company, which is irreversible in the sense that matters: the trust can be revoked but the tokens it already minted were real.
- `leed settings path delete <id>` **when the row is a `current` or a `next` one** — an alias is re-creatable from the same two values and goes through ungated, while removing either of the others takes a URL off the live site and `settings path create` cannot put it back. Read the `type` column in `path list` first.

```json
{
  "ok": false,
  "command": "site.validate",
  "version": "<version>",
  "error": {
    "code": "confirmation_required",
    "message": "leed site validate --reset discards your changes to every protected file, which cannot be undone.",
    "hint": "leed site validate --reset --yes"
  }
}
```

A refusal happens before any collaborator is touched: no session is revoked, no token rotated, no file reset. `--yes` is your user's decision to give, not yours — quote `message` to them and wait.

**A non-TTY run of a destructive command refuses in human mode too.** There is no silent-proceed path. Dropping `--json` does not get you the reset; run from a pipe, a cron job, a CI step or a `sh -c` and the command fails with `interactive_input_required` and a message that names `--yes`:

```
leed site validate --reset discards your changes to every protected file, which cannot be undone. Confirming it needs a person, and this run has no interactive terminal. Re-run as `leed site validate --reset --yes` to proceed unattended.
```

**A run at a real terminal is also refused when the environment declares it to be CI** — `CI` set to `true` by a dotfile, a devcontainer, direnv or another tool. Same code, same exit code; the message says which check refused, so you can tell "there is nobody here" from "your environment says nobody is here":

```
leed site validate --reset discards your changes to every protected file, which cannot be undone. Confirming it needs a person, and this run is detected as CI from the environment (CI is set to true), so nobody is expected to be watching. Re-run as `leed site validate --reset --yes` to proceed unattended.
```

At a real terminal with `CI` unset (or set to anything but `true`), the same commands ask a yes/no question whose default is No, so a reflexive Enter aborts.

### Finding and running a command

Work out what to run in five steps rather than reading the whole CLI:

1. **Search** — `leed cli search "<task>" --json` takes the task in your own words and returns up to five `{ command, invocation, summary }`, best first. Quote the task: unquoted extra words are refused with `invalid_arguments`, and the hint shows the quoted form. `--limit <n>` changes the count; no match is `ok: true` with `[]`. A task that is a parameter name, spelled any way — `pageId`, `page-id`, `--page-id` or `page id` — returns only the commands that take that parameter, as a positional argument or an option. It runs locally and makes no network call.
2. **Describe** — `leed schema <command> --json` takes the dotted name from the search (`site.validate`) or the argv form (`site validate`) and returns that one command's document: `arguments`, its own `options` in full, `inherits` (the names of the global and group options it also accepts), `mutates`, `idempotent`, `network`, `dryRun`, `data` (the JSON Schema of its success payload) and the `next` templates it can emit. `--command <name>` is an alias for the positional.
3. **Preview** — when the command has `mutates: true` and `dryRun: true`, run it with `--dry-run` first. A dry run reads what it needs and writes nothing; `data.plan` lists the `steps` the real run would make, a `diff` of the fields it would change, the `files` it concerns, and what is `unknowable` until the server decides it. A dry run never prompts and never answers `confirmation_required`. A command that cannot preview carries `dryRun: { exempt: "<reason>" }` instead.
4. **Run** — run it for real with `--json`.
5. **Follow `next`** — if the result carries `next`, that is the follow-up that finishes what you started (on success) or the remedy (on failure). See below.

```bash
leed cli search "publish a form" --json            # which command?
leed schema settings.form.publish --json           # what does it take and answer?
leed settings form publish <formId> --dry-run --json   # what would it do?
leed settings form publish <formId> --json             # do it
```

`leed schema --json` with no argument is the **index**: `globalOptions` and each group's options (described once), the shared `envelope` success and error schemas, `errorCodes`, `exitCodes`, `rootDocuments`, and `commands[]` as `{ command, invocation, summary, mutates, idempotent, network, dryRun }`. `leed schema <group> --json` (e.g. `leed schema settings --json`) narrows the index to one group. A command's full success document is `envelope.success` with `command` pinned to its dotted name and `data` replaced by the command's `data` schema; the error document is `envelope.error` with the same pin. An unknown name is `not_found` (exit `2`) with `next` pointing at `leed cli search`.

`rootDocuments` covers the three documents that are not a command's result: `help` (for `leed <anything> --help --json`, which also carries `search` and `schema` fields naming the two commands above), `version` (for `leed --version --json`), and `invocation` (written when the invocation never resolved to a command — an unknown command, or a container such as `leed site` with no subcommand).

### Following `next`

Either branch of the envelope may carry `next: [{ command, why, by }]`:

- The entries are **alternatives** in preference order; any one of them resolves the state. A multi-step chain arrives one step per run.
- `command` is runnable as written, with this run's environment, company and ids filled in. The one placeholder form is `<name>`, for a value only you can supply, e.g. `leed site commit -m "<message>"`.
- `by: "agent"` means you can run it. `by: "person"` means it needs a human — a browser sign-in, a decision to promote — so stop and ask.
- `next` is absent rather than empty, and `hint` stays alongside it as prose.

For example, `leed site validate` succeeds with `next` → `leed site commit -m "<message>"`; `leed site commit` succeeds with `next` → `leed site push`; `leed site push` succeeds with `next` → `leed deployments status --env <env>`. A settings write that leaves something to publish names `leed settings publish <pendingId> ...`.

## Build & Serve

```bash
# Build only (sanity check)
leed site build

# Build and start dev server (primary development mode)
leed site build --serve

# With options
leed site build --serve --port 8080    # Custom port (default: 8080)
leed site build --serve --no-debug     # Minify anyway (--serve skips minification by default)
leed site build -d                     # Debug mode on a plain build (skip minification)
leed site build --skip-search          # Skip search index generation
leed site build --skip-ai             # Skip AI support plugin

# Eleventy debug output
DEBUG=Eleventy* leed site build --serve
```

**`--serve` and `--wrangler` skip minification by default.** Both rebuild on every save,
minify is the most expensive transform in the chain, and unminified output is what you
want to read locally anyway — so they turn `-d` on for you. Do not pass `-d` as well:
a `-d` you typed yourself stops the build being recorded as the site's last successful
build, which `leed import apply` gates on, while the default `--serve` applies does not.
`--no-debug` forces minification back on, which is only worth doing to reproduce a
minification bug. A plain `leed site build` minifies, as does every CI build.

**Dev server behavior:**
- Serves at `http://localhost:8080` (or custom port)
- Watches for changes and auto-rebuilds on content changes (markdown, CSS, JS, data files)
- Browser auto-refreshes when pages are rebuilt
- **Stop the server:** `Ctrl+C` (cleans up temp files automatically)

**Layout, partial, and pagination changes are picked up live — no restart needed.**
- Changes to `_layouts/*.hbs` and `_includes/**/*.hbs` trigger a config reset and a full rebuild, so every page that uses the edited template is re-rendered and the browser refreshes
- Tailwind is recompiled on the same pass, so new utility classes used in a template are available immediately
- Pagination is driven by the layouts and partials that render it, so it follows the same path
- These rebuilds are slower than a content edit (the whole config is re-read), so expect a few seconds
- Content file changes (`.md`, `.html`), JS changes (`static/js/`), and data file changes (`_data/`) auto-rebuild and auto-refresh the browser
- **Tailwind CSS changes** (`tailwind/`) auto-rebuild and the dev server hot-swaps the stylesheet in place — the page updates without reloading, so scroll position and page state are preserved

## Sites on this machine (`leed site list`, `--site`)

The CLI remembers every site set up on this machine in one registry, `$XDG_CONFIG_HOME/leed/sites.json` (default `~/.config/leed/sites.json`, beside `auth.json`; mode 600, written atomically and under a lock, so two commands at once never corrupt it). One entry per site and environment: its `companyId`, `environment`, `domain`, the site's title, the paths of its `raw-content` checkouts, its git remote and the user who set it up. A sandbox has an entry too, keyed by its path and named by its folder. An entry this CLI cannot read is skipped and kept as it is; a registry written by a newer CLI is read but never rewritten (a command that would change it fails with `validation_failed` until you run `leed self-update`).

**Which site a command works on.** A checkout is the nearest folder at or above the working directory that holds `identity.json`, so every `leed site` command works from the checkout root and from any folder inside it. The site is that checkout's entry. The paths are only a cache, checked against the checkout's own `identity.json`: every command run inside a checkout records where it is now, so moving or renaming the folder needs no action, and a folder reused for another site (or a sandbox) is that site, never the one registered there before. Two clones of one site are both listed, and the one you are in wins.

```bash
leed site list                       # every registered site, with its checkouts
leed site list --json                # data.sites[]: name, companyId, environment, domain, companyName, sandbox, initialized, paths[{ path, exists }]
leed site build --site leed.ai       # run a site command from anywhere, by name, domain or companyId
leed site push --site acme -e staging  # -e picks the environment when one company has several
```

- `--site <name|domain|companyId>` works on every `leed site` command except `init` and `list`, before or after the command name. It moves into the site's checkout first, so a sandbox named with `--site` is judged as the sandbox it is. An unknown name is `not_found` and lists the registered sites; a name that matches several (one company in two environments) is `invalid_arguments` until `-e` narrows it.
- Outside every checkout with no `--site`, a site command is refused with `invalid_arguments`: the message lists the registered sites (each with its environment and companyId) and the hint is the exact command with `--site <domain>` (and `-e <env>` when that domain is registered in two environments). One registered site is refused like several; nothing is picked for being the only one. None at all is `not_a_site_repo`.
- `leed site list` reads the registry alone: offline, no sign-in, from anywhere, and in a sandbox. It never writes, and neither do `leed auth status` and `leed mcp add --dry-run`. A path whose `exists` is `false` is a checkout that was moved; it is reported, not pruned. The CMS's page types, which this command used to list, are `leed settings pagetype list`.
- **`leed site init` needs no file written beforehand.** It takes `-e/--env` (or `ENV_NAME`), `--company <companyId|domain>` and `--dir <path>`, and guesses neither: `--company` alone takes the one environment that company is logged in to, and refuses when it is logged in to several or none; `-e` alone uses that environment's login bound to no company only when the environment holds no company login, and refuses naming `--company` whenever a company login is saved there, even beside a company-unbound one. With neither, it refuses with `invalid_arguments`, listing any registered site still waiting to be set up (an installer's leftover) with the exact `leed site init --company <companyId> -e <env>` to run; there is no production default. The domain, company and user come from the CMS, the checkout goes into `<dir>/<site>/raw-content`, and the site is recorded in the registry. `data.rawContentRepo` is the folder to `cd` into; `data.configPath` is the registry's path. Run inside a checkout (any folder holding `identity.json`, registered or not, a sandbox included) a plain `leed site init` is refused with `invalid_arguments`, because it would clone a second checkout inside it; pass `--dir` or run it elsewhere. If the clone fails, the site is recorded as still waiting to be set up, with no checkout path.
- **CI and direct mode are unchanged.** Under CI, or in a checkout that is not registered, the CLI uses `identity.json` and the environment variables exactly as before and never reads or writes the registry.
- **Moving from `leed.config.json`.** Older CLIs kept one `leed.config.json` per site in the folder above the checkout. The first time this CLI meets one (in the working directory or any folder above it, `~/leed` or a folder directly inside `~/leed`), it imports it into the registry and prints, once: *Imported <file> into ~/.config/leed/sites.json; leed.config.json is no longer read and can be deleted.* The file is left in place and never read again. The read-only commands (`leed site list`, `leed auth status`, `leed mcp add --dry-run`) show the site such a file describes without importing it; the next command that resolves a site does the import.

## Sandbox Sites (`leed site init --sandbox`)

A sandbox is a Leed site that runs on the machine alone, for building and previewing before there is a Leed account. It has no git repository and no CMS behind it. It is recorded in the site registry as a sandbox, named after its folder, so `leed site list` shows it and `--site <folder name>` reaches it.

```bash
leed site init --sandbox ./my-site   # write a sandbox into a new or empty directory
leed site init --sandbox             # ...into ./leed-sandbox
cd my-site && leed site build --serve
```

Init copies a fixture set shipped with the CLI, then installs Font Awesome Free into `src/static/webfonts/` exactly as `leed site init --font-awesome` does (honoring `LEED_FONT_AWESOME_BASE_URL`). Nothing else: no sign-in, no clone, no git hooks. The font download is the only network it touches and it is best effort: offline, the sandbox is still written, `fontAwesome` is absent and a warning says to run `leed site init --font-awesome` inside the sandbox to retry. It refuses a directory that already holds files (`invalid_arguments`). The `--json` result is `site.init` with `data: { sandbox: true, path, companyId, environment, fontAwesome? }`, `fontAwesome` being the same install report a normal init gives.

**How to recognize one.** Its `identity.json` is `{"companyId":"non-cms-company","environment":"dev"}`. A real company id is six lowercase letters or digits, so the two never collide. Every command looks for the nearest `identity.json` above the working directory before it authenticates.

**Placeholder ids.** Every record a sandbox holds — page type, page, label, author, menu, menu item, form, asset, call to action, search index, autolink — is named `ph-<kind>-<n>` (`ph-pt-1`, `ph-menu-2`), with kinds `pt`, `page`, `label`, `author`, `menu`, `menuitem`, `form`, `asset`, `cta`, `index` and `autolink`. Images are staged as files under `src/static/images/tmp/`, which the sandbox's `.gitignore` excludes (new site checkouts exclude it too; the move never copies it into one), and referenced as `/static/images/tmp/<file>`. The `/leed:site-sandbox-move` skill creates each record in the CMS and swaps each placeholder for the real id.

**What runs.** A sandbox build is always a preview build, its reported `commitHash` is `sandbox`, and it reads the plan tier from the sandbox's own `src/src.11tydata.json`, which unlocks every paid-plan template and style locally. The first build installs the site's packages (`tailwindcss`), so it needs the network or a warm Bun cache once. Apart from the init's font download, nothing a sandbox runs reaches the network on its own: the credential migration and the self-update check are skipped there.

- **Runs in a sandbox:** `site init`, `site build`, `site eject`, `site vscode`, `site list`, `import markdown`, `import html`, `import openapi`, `import clean`, `auth login`, `login`, `setup`, `auth logout`, `auth status`, `schema`, `cli search`, `self-update`, `completion install`, `completion uninstall`, `mcp docs`, `mcp add --docs`
- **Refuses with `sandbox_site`:** `site validate`, `site commit`, `site push`, `site upload`, `site notify-cms`, `auth rotate`, `auth reset`, `import status`, `import apply`, `mcp add --cms`, `asset *`, `page *`, `settings *`, `deployments *`, `contacts *`, `feedback *`

A refusal exits `3`. Its message names the command and its hint names `/leed:site-sandbox-move`. `leed import markdown` and `html` stage content into the sandbox for preview exactly as they do in a real site; only `apply` and `status` need the CMS.

## Validate, Commit, Push Workflow

### 1. Validate

```bash
leed site validate              # Check all changes
leed site validate --reset --dry-run  # Preview what would be reset
leed site validate --reset      # Reset protected files to originals
leed site validate --reset --yes  # ...without being asked to confirm
```

`--reset` is destructive and asks you to confirm. It needs `-y, --yes` to run unattended — under `--json`, or anywhere there is no interactive terminal. See **Machine-Readable Output** above.

Validation checks:
- No modifications to protected/read-only files (including `src/static/images/favicon-*` and `logo-*`, which are managed by the CMS: set them in Settings → General or with the MCP tool `upload_company_image` (page type documentation logos in the page type editor). Each is at most 100 KB and must be PNG, JPEG, GIF, WebP or SVG (`image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`).)
- No disallowed file extensions (media, office docs, fonts except WOFF2)
- No files over 500KB
- Frontmatter schema compliance

### 2. Commit

```bash
leed site commit -m "describe your changes"
leed site commit -m "message" --dry-run    # Preview without committing
```

**Requirements before commit:**
- Must be on `staging` branch
- All changes must be validated (`leed site validate` run first)
- Site must be built after latest changes (`leed site build` run first)
- No restricted file modifications

The CLI automatically stages all modified files — no manual `git add` needed.

### 3. Push

```bash
leed site push
```

- Pushes to `origin/staging`
- Automatically notifies CMS via webhook after push
- Must have unpushed commits

## Authentication & Token Management

The `leed auth` commands manage two distinct credential surfaces:

1. **CMS login session** — your Better Auth session (the token from `leed auth login` that proves you are you)
2. **GitLab access token** — the token this site uses for its `raw-content` git repository, stored in `~/.config/leed/auth.json`

A site can have a perfectly valid CMS session while its GitLab token is stale, expired, or simply broken — and vice versa. The commands below let you check and fix each surface independently.

**Which company and environment a command acts on.** Nothing is defaulted. The environment is the `-e`/`--env` flag, else the `--site` entry's, else the site checkout's, else `ENV_NAME`, else the one environment a `--company` given alone is logged in to. An exported `ENV_NAME` is a fallback, not a flag: inside a checkout the checkout's environment wins over it, and only `-e` targets another environment. The company is `--company`, else the `--site` entry's, else the checkout's. Anything left unresolved is refused with `invalid_arguments`; the message lists the real choices (saved logins or registered sites), and the hint is the same command line, positional arguments and other flags kept, with the missing flags added as `<companyId>`, `<site>` or `<env>`. A hint never fills in a company, site or environment you did not name, so pick one from the message and substitute it before running the hint.

### `leed auth status`

```bash
leed auth status
```

Shows current authentication state:
- **Everywhere:** lists every CMS login session in every environment, each under its environment, with its expiration date. None is marked a default: there is no default login. Under `--json`, each `data.sessions[]` row carries its `environment`.
- **Inside a Leed site checkout:** ALSO checks the backend for this site's GitLab token and prints its expiration with `✓` (valid), `⚠` (expires within 7 days), or `✗` (expired)

This is the first command to run whenever something feels off — it answers "are my credentials actually OK?" without changing anything.

### `leed auth login`

```bash
leed auth login                          # Inside a site checkout: its environment and company
leed auth login --env staging            # Outside one: name the environment (the company is chosen in the browser)
leed auth login --company acme.com       # Re-sign in to a company logged in to one environment
leed auth login --email you@example.com  # Magic link instead of browser flow
```

Authenticates with Leed and saves a CMS session token locally, filed under its company; no login becomes a default. Outside a checkout the environment comes from `-e`/`ENV_NAME`, or from `--company` when that company is logged in to exactly one environment; otherwise it refuses with `invalid_arguments` and never assumes production. Uses a browser-based device authorization flow unless `--email` is given. Use this after `leed auth logout`, after `leed auth reset`, or when `leed auth status` shows your session is expired.

### `leed auth logout`

```bash
leed auth logout                                   # Inside a site checkout: its own company's session
leed auth logout --env staging --company acme.com  # Outside one: name both
leed auth logout --env staging --all-companies     # Every session stored for staging
```

Signs out of the CMS for the given environment and removes that session's local credentials. Outside a checkout it needs `-e` (or `ENV_NAME`), and `--company` whenever company sessions are stored there, one or several; without them it refuses with `invalid_arguments` and the exact command. Best-effort revokes the server-side session as well. Does NOT touch your GitLab token — it remains on the backend until rotated.

### `leed auth rotate`

```bash
leed auth rotate
leed auth rotate --yes    # skip the confirmation prompt
```

**Routine maintenance — use this when the GitLab token is failing or you want fresh credentials on a working setup.**

What it does:
- Rotates this site's raw-content access token on the backend
- Stores the new token in `~/.config/leed/auth.json`, and points the current site's `origin` at the credential-free remote URL
- Leaves your CMS login session **completely untouched** — no re-authentication needed

Requirements:
- Must be run from inside the site's checkout (the site is identified by its `identity.json` and its `sites.json` entry)
- You must currently be logged in (`leed auth status` shows a valid session)

If you have multiple installed sites, run this command from each — it only affects the site you run it from.

Like `leed auth reset` and `leed site validate --reset`, this command confirms before acting and needs `-y, --yes` to run unattended.

### `leed auth reset`

```bash
leed auth reset
leed auth reset --all-sessions
leed auth reset --yes            # skip the confirmation prompt
```

**NUCLEAR OPTION — use this if your laptop was lost or compromised, or if you suspect any credentials have leaked.**

What it does:
- Rotates the raw-content GitLab token (same as `leed auth rotate`)
- Updates `~/.config/leed/auth.json` and the current site's `origin` remote
- Revokes your CMS login session — you will be signed out
- With `--all-sessions`, also revokes any other devices you're signed in on
- Forces re-authentication on your next leed command (`leed auth login`)

Use `leed auth rotate` for routine refreshes; use `leed auth reset` only when something is actually compromised. The reset path is intentionally heavyweight — it forces a full re-auth round-trip.

## Customizing a Leed Template (`leed site eject`)

Several of Leed's own templates can be **ejected** — copied into your repo as an override you then own.

```bash
leed site eject                 # List every template you can customize
leed site eject <name>          # Write that template into _includes/
leed site eject <name> --force  # Overwrite a customization you already have
```

With no argument the command lists what is available: for each template it shows the name, whether you are still on the Leed default or have already customized it, the file it would write, and what that template controls. `leed site eject <name>` then writes the file into `src/_includes/`, where it is yours to edit and commit like any other partial. What you get renders as-is — a complete, working template rather than a stub to fill in. Delete the file and Leed's default takes over again. Without `--force` the command refuses to overwrite an existing file rather than silently discarding your work.

**Read the list from the command, never from a table.** What a site may eject depends on its plan tier and features, and the set changes as Leed adds templates, so `leed site eject --json` is the only source of truth. Each row has `name` (what to eject by), `description`, `destination` (where the override is written, e.g. `src/_includes/docs-header.hbs`) and `customized` (`true` when that file already exists). Templates above your plan are not listed at all. That is deliberate — an override the renderer ignores is worse than no override.

**`docs-header.hbs` and `docs-footer.hbs` are gated a second time, at render.** `leed/docs/header/chrome.hbs` and `leed/docs/footer.hbs` both check `hasTier "starter"`, so on a below-tier site the file is ignored and Leed's own header or footer renders instead. If one of these files exists on a below-tier site (left over from a plan change, say) and appears to do nothing, that is the reason — nothing is broken, the plan simply does not include it. Never hand-write one: eject it.

**`stub-template` is tied to recommendations, which are Growth+.** Below Growth `/api/abby/v2` returns no recommendations, so a stub template renders no cards however carefully it is authored. On Growth, `/leed:create recommendations` in Claude ejects and brands it, turns `allowRecommendations` on (`leed settings pagetype set <pageTypeId> --allow-recommendations true`), and adds the slot.

One asymmetry worth knowing: `docs-footer` ejects a byte-identical copy of the footer your site renders today, while `docs-header` ejects a working starting example rather than a copy, because `chrome.hbs` fills its wrapper with your theme's own header variant.

## Font Awesome (`leed site init --font-awesome`)

Font Awesome reaches a site only through these two flags. `leed site build` installs no fonts and downloads nothing; it compiles against the Font Awesome CSS the CLI carries for whatever the site has installed.

```bash
leed site init --font-awesome                    # Install Font Awesome Free
leed site init --font-awesome-pro <zip>          # Install or upgrade the site owner's own Pro fonts
```

- **`--font-awesome`** installs Font Awesome **Free** (7.3.1) into `src/static/webfonts/`, downloading `fontawesome-free-7.3.1.zip` from `https://static-assets.leed.ai/webfonts/`. It runs only when no Font Awesome is installed: if the directory already holds an `fa-version.txt` or any `fa-*.woff2`, it changes nothing and reports `action: "skipped"` with the reason. So it can never overwrite Pro.
- **`--font-awesome-pro <zip>`** installs from the Font Awesome **Pro** web package the site owner downloaded from fontawesome.com (`fontawesome-pro-7.3.1-web.zip`, or the Pro+ `fontawesome-pro-plus-7.3.1-web.zip`). The edition and version come from the banner in the zip's `css/fontawesome.css`, not the file name. Only `webfonts/fa-*.woff2` are taken, by file name. Supported: **Pro 7.0.0 and 7.3.1**; any other version, or a Free zip, is refused (`invalid_arguments`) with the supported list. Run it again with a newer zip to upgrade: the old release's `fa-*.woff2` files are removed, and the site's other fonts are left alone. A font file over the 600 KB commit limit is refused before anything is written.
- The two flags conflict with each other. On a site that is already initialized they install fonts **and do nothing else** — no re-initialization, no clone, no credentials. On a fresh `leed site init` they install after initialization; if the install fails, init still succeeds with a warning naming the command to retry.
- Both write `src/static/webfonts/fa-version.txt` as `<edition> <version>` (`free 7.3.1`, `pro 7.3.1`). The build reads it to choose the stylesheet. A bare version (`7.3.1`), which sites set up by older CLIs have, means Pro at that version. No file means Free 7.3.1, so a site with no fonts still builds and its icons render empty. A recorded version the CLI has no CSS for fails the build with the supported list.
- **`LEED_FONT_AWESOME_BASE_URL`** overrides where `--font-awesome` downloads from, for local and clean-room testing: an `https://` URL, a `file://` directory holding `fontawesome-free-7.3.1.zip`, or `http://localhost` / `127.0.0.1` (plain `http` to any other host is refused).
- Under `--json`, `data.fontAwesome` is `{ action, edition, version, previous?, webfontsDir, files, removed, source, reason? }`, where `action` is `installed`, `upgraded`, `reinstalled` or `skipped`. On an already-initialized site `data` holds only `fontAwesome`; on a fresh init it sits beside the usual init fields.

Commit the installed files with `leed site commit` like any other change.

The Leed CI build (`.ci/build.sh`) runs `leed site init --font-awesome` before `leed site build`, so a site that has not committed any Font Awesome is built with Free; the fonts are installed for that build only and never committed. A site with its own fonts committed (its Pro, or Free) is left untouched, and a failed Free download fails the build, so the live site is never replaced by one with empty icons.

## VS Code Workspace (`leed site vscode`)

Writes the VS Code files for this site, on request. The CLI no longer writes them on its own.

```bash
leed site vscode            # write both files
leed site vscode --dry-run  # show what it would write, and write nothing
```

| File | Where |
|---|---|
| `<customer>.code-workspace` | beside `raw-content/`, in the company folder; opens `raw-content` as the workspace |
| `tasks.json` | `raw-content/.vscode/tasks.json`, with the Leed build and preview tasks |

Both files are overwritten every time, so running it again restores the Leed defaults. Under `--json` the result's `data` is `{ workspaceFile, tasksFile }`, both absolute paths.

## Assets (`leed asset`)

### Uploading (`leed asset upload`)

Uploads local files to the CMS asset manager and returns a ready-to-paste Leed Markdown reference for each. Run it from inside the site's checkout (any folder in it): it always uploads to the company and environment that site targets, and refuses to run anywhere else. See the `/site-assets` skill for the full workflow.

```bash
leed asset upload ./hero.png --json                           # one file: detect, dedupe, upload
leed asset upload ./media --type image --recursive --json     # folder step 1: prepare (uploads nothing, writes leed-assets.json)
leed asset upload ./media --save --json                       # folder step 2: upload; rerun to resume
```

| Option | Purpose |
|--------|---------|
| `--type <image\|video\|audio\|document>` | Asset type (`docs` is an alias). Required to prepare a folder |
| `--save` | Upload a prepared folder from its state file |
| `-r, --recursive` | Include subfolders when preparing |
| `--extension <ext>` | Folder only: scan just these extensions (repeatable or comma-separated) |
| `--labels <ids>` | Comma-separated label ids for every uploaded asset; unknown ids are refused before upload |
| `--state <path>` | State file for a folder upload (default `./leed-assets.json`). Keep it outside the repo or name it `leed-assets-<name>.json`; a path git would commit is refused |
| `--resume-placeholder <assetId>` | Single video file: continue an interrupted upload into its placeholder |

### Browsing and editing (`list`, `get`, `set`)

Unlike `upload`, these need no site checkout — assets belong to a company, so `--company <companyId|domain>` and `-e, --env <name>` select the target and default from the site you are in when you run them inside a checkout.

```bash
leed asset list [--type <image|video|audio|document>] [--label <ids>] [--q <text>] [--limit <n>]
leed asset get <assetId>
leed asset set <assetId> [field flags] [--from-file <path>]
```

**Field flags are refused by media type, naming the field and the type.** `--alt-text` and `--caption` are image-only; `--thumbnail-timestamp`, `--allow-fullscreen`, `--muted` are video-only; `--autoplay`, `--controls`, `--loop` are video and audio; `--description` is video, audio and document. Images carry `caption` instead of `description`, so a null description on an image is structural rather than empty.

**Labels have three flags that are not interchangeable:** `--labels` replaces the whole set, `--add-labels` and `--remove-labels` leave the rest alone. All take label ids.

### Exporting originals (`leed asset export`)

```bash
leed asset export ./originals                  # every asset in the company
leed asset export ./logos --type image         # same filters as list
leed asset export as_12345 ./one-file          # one asset; destination is always last
leed asset export ./originals --concurrency 8  # 1-16, default 4
```

The destination's `assets.json` is the command's own record: rerun to resume, and finished files are skipped, expired audio and document links re-issued, and a file on disk whose SHA-256 matches left alone. Delete it to start over. It holds short-lived links to private files, so a destination inside a git repository that would commit it is refused. It is plain JSON, so `curl`, `xargs` or `aria2` can drive the same downloads.

Two expected outcomes rather than failures: a video exports as Cloudflare Stream's MP4 rendition, so its bytes and SHA-256 differ from the uploaded file by design and it is re-fetched rather than verified; and a video whose MP4 is not ready yet is reported unavailable — run it again later.

## CMS Settings (`leed settings`)

Read and change the CMS settings a site is built from, without opening the web UI. Unlike `leed site *` and `leed asset upload`, these commands need no site checkout: settings belong to a company, not to a folder, so `--company <companyId|domain>` and `-e, --env <name>` **select** the target and are visible on every subcommand. Run inside a site's checkout and both come from that site; run anywhere else and nothing is defaulted: pass `--company`, and `-e` too unless that company is logged in to exactly one environment (`leed auth status` lists them). Without them the command refuses with `invalid_arguments`, its hint the same command with `--company <companyId> -e <env>` added.

The group is organized by noun, with the verbs under each:

```bash
leed settings pagetype list [--type <kind>] [--label <id>] [--slug <slug>] [--needs-publish]
leed settings pagetype get <pageTypeId>
leed settings pagetype create --type <kind> [field flags] [--clear <field>] [--from-file <path>]
leed settings pagetype set <pageTypeId> [field flags] [--clear <field>] [--from-file <path>]

leed settings label list [--is-series true|false] [--series <kind>] [--visible true|false] [--needs-publish] [--slug <slug>]
leed settings label get <labelId>
leed settings label create [field flags] [--clear <field>] [--from-file <path>]
leed settings label set <labelId> [field flags] [--clear <field>] [--from-file <path>]

leed settings autolink list [--needs-publish] [--page-id <id>] [--unlinked]
leed settings autolink get <autolinkId>
leed settings autolink create --text <phrase> --page-id <pageId> [--position <n>]
leed settings autolink set <autolinkId> [field flags] [--from-file <path>]
leed settings autolink delete <autolinkId>
leed settings autolink reorder <autolinkId> --position <n>   # or --order <ids>|@order.json, with no id, for the whole list

leed settings searchindex list
leed settings searchindex get <searchIndexId>
leed settings searchindex create --name <name> [--page-type-ids '["pt_1","pt_2"]'] [--from-file <path>]
leed settings searchindex set <searchIndexId> [field flags] [--from-file <path>]

leed settings company get
leed settings company set [field flags] [--clear <field>] [--from-file <path>]

leed settings form list [--include-deleted]
leed settings form get <formId>
leed settings form create --form-prototype <name> --form-name <name> --button <label> --success-callback <fn> --failure-callback <fn> --fields '[…]' [field flags] [--clear <field>] [--from-file <path>]
leed settings form set <formId> [field flags] [--clear <field>] [--from-file <path>]
leed settings form publish <formId>
leed settings form delete <formId>

leed settings shortcode list
leed settings shortcode get <code>
leed settings shortcode create (--url <url> | --page-id <pageId>) [--vanity <code>] [--params.utm_source <value> …] [--from-file <path>]
leed settings shortcode set <code>                           # present, and always refuses

leed settings user list
leed settings user get <userId>
leed settings user set <userId> [field flags] [--role <role>] [--clear <field>] [--from-file <path>]

leed settings oidctrust list
leed settings oidctrust create --name <name> --profile <id> --issuer <url> --identity-label <label> --claim-constraints '{…}' --page-type-ids '[…]' --minimum-status <draft|in_revision|approved> [--yes]
leed settings oidctrust delete <trustId>

leed settings path list [--query <text>] [--type <current|next|alias>] [--alias]
leed settings path resolve <url>
leed settings path create <pageId> <path>
leed settings path delete <id> [--yes]

leed settings brokenlinks list

leed settings menu list
leed settings menu get <menuId>
leed settings menu create --name <name> [--description <text>] [--expanded true|false]
leed settings menu set <menuId> <menuItemId> --base-revision <rev> [field flags] [--clear <field>] [--from-file <path>]
leed settings menu add <menuId> --base-revision <rev> [--parent <menuItemId>|--top-level] [--index <n>] [--menu-item-id <id>] [field flags] [--from-file <path>]
leed settings menu remove <menuId> <menuItemId> --base-revision <rev> [--children promote|cascade]
leed settings menu move <menuId> <menuItemId> --base-revision <rev> (--parent <menuItemId>|--top-level) [--index <n>]
leed settings menu delete <menuId>
leed settings menu reorder <menuId> --base-revision <rev> [--parent <menuItemId>|--top-level] --order <ids>
leed settings menu set-menu <menuId> --base-revision <rev> [--name <name>] [--description <text>] [--expanded true|false]

leed settings pending
leed settings publish [ids...] | --all
```

**A posts page type's `layout` defaults to `empty.hbs` and must otherwise already exist.** `pagetype create` without `--layout` stores `empty.hbs`, and the CMS writes `src/_layouts/empty.hbs` (exactly `{{{ process content }}}`) and a `src/<slug>-index.hbs` list page when the repo lacks them. With `--layout <name>` it scaffolds neither: the layout must already be a file under `src/_layouts/` on the site repo's `staging` branch, or the create is refused with 400 naming the layout. `pagetype set --layout` is held to the same rule whenever it changes the stored value, `empty.hbs` included. Documentation and api types always use the shared docs layout and are not checked. Add the layout to the repo first (`leed site commit`, then `leed site push`), then point the page type at it. `leed site validate` checks every page type against the checkout the same way and fails naming each page type whose layout is missing. New sites start with only the Root page type; add a blog with `/leed:create blog` or a documentation set with `/leed:create documentation` in Claude, which create the page type, its layouts or menu and search index, and the starter templates in one step.

**`searchindex` has no `delete`, and creating a documentation set usually makes one for you.** A search index names the page types it covers, and `POST /api/pagetypes` already creates one named after every documentation or api set it makes — so reach for `create` only when you want a second index, or one spanning several sets. `--page-type-ids` takes a JSON array (`'["pt_1","pt_2"]'` or `@ids.json`) because it is an array field, and it **replaces** the stored list rather than appending to it: read the current one with `get` first. There is no `--clear`, because no field of a search index is nullable, and no `delete` verb, because the API has no delete route — removing an index is done in the CMS. `list` prints a company-wide publish footer as well as a per-row one; search indexes are the one settings type that still reports a rollup.

```bash
leed settings searchindex list --json                          # ids, names, the page types each covers
leed settings searchindex create --name "Product Docs" --page-type-ids '["pt_docs"]'
leed settings searchindex set si_1a2b --page-type-ids '["pt_docs","pt_api"]'   # replaces, does not append
leed settings searchindex set si_1a2b --name "All Documentation"
```

**`company` is the only singleton noun.** There is exactly one settings record per company and `--company` already names it, so `get` and `set` take no positional id, and there is no `list` and no `create` — provisioning creates a company and the company-remover workflow removes one; neither is a settings verb. Everything Settings → General edits is here: the site title, description, locale and timezone, the social accounts, the og-card text, reading speed and date format, pagination, the syntax-highlighter languages, and the whole documentation configuration (layout, fonts, themes, logos, header button, tab groups, top and bottom menus).

```bash
# What is stored right now, and whether anything is waiting to be published
leed settings company get --json

# Change two fields; an omitted flag is left untouched
leed settings company set --site-title "Acme Docs" --timezone "America/Chicago"

# Nested fields are dotted, kebab-cased per segment
leed settings company set --documentation-configuration.layout-name bravo \
                         --documentation-configuration.header.button.text "Start free"

# Return a nullable field to its inherited value (repeatable)
leed settings company set --clear og-card.description --clear paging.size

# A whole patch from a file, with flags layered over it
leed settings company set --from-file ./company-patch.json --site-locale en-US
```

**Field flags are generated from the API's own schema**, so a setting the CMS accepts cannot be missing from the CLI: 47 flags for the company over 17 top-level keys, nested four deep at `--documentation-configuration.header.button.href`. Closed sets carry their choices (`--date-format`, `--documentation-configuration.layout-name`, the two `--mcp-configuration.*` booleans), and `--reading-wpm` is bounded. `--clear <field>` is offered only for a field whose stored `null` is a real state — 43 of the company's — so `--clear site-title` is structurally impossible rather than merely refused. Two company fields have flags deliberately withheld: `documentationConfiguration.menus.left`, which is a page type's concern since the docs left menu moved there, and `ogCard.image`, which no screen sets. A withheld field is withheld on **every** input path: `--from-file` is checked against the same list and refuses a document that names one with `invalid_arguments`, so it is a second spelling for the fields that have flags rather than a way past them.

**`set` reports what it actually changed.** The `changed` array names the fields whose stored value the write altered and `unchanged` the ones that already matched, so re-sending a stored value is a success with an empty `changed` rather than a no-op you cannot distinguish from a failure. A cleared field comes back absent — `(unset)` in the human output — because a cleared company field reads back as no key at all.

**Rules live in the CMS, and its refusals name the field.** A bad value answers `invalid_arguments` with an `issues` array of `{ path, message, code }` in the envelope's `error.issues` — the field that was wrong, what the schema expects there, and nothing of the value you sent. The rest of the mapping is shared by every noun: `auth_expired` for an expired session, `permission_denied` when a stronger role has to act — or, from a 402, when the company's **plan** does not include the feature, which the hint says and which no retry fixes — `not_found`, `conflict` for a concurrent edit, and `network_error` for a CMS that is unwell or shedding load, including the `settings_migration_pending` 503 that means "retry shortly". One 403 is special: `form_protected` keeps the `permission_denied` code and carries its own hint, because a protected form is read-only on every surface and **no** role change will help — do not escalate, pick a different form. `confirmation_required` and `interactive_input_required` are NOT part of that mapping: both come from the confirmation gate, on `oidctrust create` and on a non-alias `path delete`, before any write is made. The CLI itself only checks enum membership and numeric spelling while parsing, so anything else you see came from the API and means what the web UI would have told you.

**`form` carries the draft→publish model, so it has a `publish` verb — and `leed settings form publish <formId>` and `leed settings publish form-<formId>` are the same operation.** Both reach the shared deployments publish; the verb exists so you can name the formId you already have instead of the prefixed pending id. A form with nothing pending is a **success** that published nothing, not a failure. `--clear` is wired on `form create` as well as `form set`, as it is on `pagetype` and `label`: `--clear autofill` is the documented way back to "None" on the Form Details dropdown, because omitting the key leaves the stored provider alone. `form delete` is refused while any page still uses the form (409, with the page count) or it has collected any responses (409, with the count), and a **protected** form — one a service surface owns, flagged in `form list` — refuses every change including deletion (403).

```bash
leed settings form list --json                                 # ids, prototypes, publish state, protected flag
leed settings form set fm_1a2b --heading "Talk to us"           # one field; everything else untouched
leed settings form set fm_1a2b --clear autofill                 # back to "None"
leed settings form publish fm_1a2b                              # same as `leed settings publish form-fm_1a2b`
```

**`leed settings shortcode set` ALWAYS refuses, unconditionally, and that is the design.** A shortcode is read-only once it exists: its destination and UTM tags are fixed at creation so a tracked link never changes under a QR code or a printed URL already in circulation. There is no update route for one in the API at all. The command is in the tree so the rule is discoverable from `--help` rather than from an "unknown command" error, it carries **no field flags and no `--from-file`** (a flag for a value that can never be written would be a lie), it never authenticates, and it answers `invalid_arguments` with a hint naming `shortcode create`. Do not retry it. `create` requires exactly one of `--url` and `--page-id`, and the server normalizes every UTM value — trimmed, lowercased, whitespace runs collapsed to hyphens — so the stored value can differ from what you sent; read it back off the result. A `--vanity` becomes the code permanently. Every `shortcode` route sits behind the Growth-tier short-URL feature, so any verb can answer a 402, which arrives as `permission_denied` with an upgrade hint.

```bash
leed settings shortcode list --json
leed settings shortcode create --page-id pg_launch --vanity launch --params.utm_source newsletter
leed settings shortcode get launch --json                      # resolved: the link to share, and where it lands
```

**`leed settings user set --role` is the only PROGRAMMATIC surface that can change a base role** — the CMS's own Team Members screen is the other, and there is no third. No AI tool accepts the field: an agent that can grant a role can grant itself one, so `update_user` omits it from its schema on purpose and a guard test over both tool registries keeps it out. Only an Administrator may make the change — anyone's role or their own — and it is refused with `permission_denied` otherwise; a self-edit of a *profile* field still works at any role, because the route waives its permission check for a self-edit so people can maintain their own profiles. A base role is a **floor**, not a ceiling: a per-resource override can raise it and can never lower it, so the effective role is the stronger of the two. Resource-level overrides are a separate API this CLI does not touch, and `user get` deliberately does not print them. `--role` takes one of `Administrator|Publish|Approve|Write|Read|Restricted` and is refused during parse for anything else. There is no `--clear role`, structurally: a user always has a base role. There is also no `create` and no `delete` — adding a user is an invitation flow and removing one is not a settings patch's job.

```bash
leed settings user list --json                                 # ids, names, roles, author-page visibility
leed settings user set u_7 --job-title "Staff Writer" --clear slug
leed settings user set u_7 --role Approve                      # Administrators only; says so when it lands
```

**`leed settings oidctrust create` grants a CI pipeline token access to the company, and refuses without confirmation.** Unattended it registers nothing until `--yes` is passed, and the code depends on which kind of unattended: `confirmation_required` under `--json` (or `LEED_JSON`), and `interactive_input_required` in human mode with no interactive terminal. Both name `--yes`; read what you are confirming first. Its output carries the one value the customer must have: the **audience**, which Leed generates from the trust id and which their pipeline has to send in its token request. It cannot be chosen, cannot be changed, and cannot be sent as an input — pass it on. The trust publishes as a `Restricted` principal scoped to the page types you nominate, and the account registering it can only grant page types it may publish itself; a refusal names the ones it would not grant rather than quietly narrowing the trust. `oidctrust delete` is a soft **revoke**: access is withdrawn immediately and the row stays in `list` as an audit trail, which is why `list` shows revoked trusts with a status column and why `delete` needs no confirmation. There is no `set` — re-register to change a trust. Creating one is Growth-tier, so `create` alone can answer 402; listing and revoking stay open on every tier, deliberately. To set up a whole continuous-documentation flow for a GitHub or GitLab repository (the trust, the release job in the repository's own CI and the stamping rule for its agent), use `/leed:docs-ci` (`../../docs-ci/SKILL.md`), which drives this command.

```bash
leed settings oidctrust list --json                            # revoked trusts included; branch on `active`
leed settings oidctrust create --name "Site deploys" --profile github \
  --issuer https://token.actions.githubusercontent.com --identity-label acme/site \
  --claim-constraints '{"repository_id":"42","ref":"refs/heads/main"}' \
  --page-type-ids '["pt_docs"]' --minimum-status approved --yes
leed settings oidctrust delete tr_1a2b                         # revokes; the row remains
```

**`leed settings path delete` takes the NUMERIC id from `path list`, never a path string.** The delete route has no id in its URL — the number travels in the request body — so the first column of `path list` is the only place that value exists, and a non-integer is refused before the command authenticates. It deletes **aliases only**: the CMS refuses the id of a `current` row, and of a `next` row unless its page has been deleted, because removing one would take a page's own URL away with no route back through this CLI, since `path create` only ever makes aliases. A non-alias delete is also **confirmed** before it is sent — `--yes` unattended, `confirmation_required` under `--json` and `interactive_input_required` in human mode with no terminal — while deleting an alias needs nothing. Read the `type` column before you pass `--yes`. `path create <pageId> <path>` can only ever make an **alias** — the route hardcodes the type, and `current` rows are written when a page is published while `next` rows reserve the URL of an unpublished one. The server normalizes the path before storing it, so use the `path` the result reports rather than the one you sent. `path list`'s `--alias` and `--type alias` are the same request, and several `--type` flags become one comma-separated server filter. `path resolve <url>` answers `{ pageId }` for a relative path or an absolute URL on the company's own domain, and a **null `pageId` is a success** — the URL is simply not a path of this site — so branch on `pageId`, not on `ok`.

```bash
leed settings path list --alias --json                         # ids first; the id is what delete takes
leed settings path create pg_about /company                     # always an alias
leed settings path resolve https://example.com/company --json   # { pageId } or { pageId: null }
leed settings path delete 42                                   # an alias: no confirmation
leed settings path delete 1 --yes                               # a current row: takes /about off the live site
```

**`leed settings brokenlinks list` reports the LAST STORED check, not a fresh crawl.** There is no way to request a new one, so read the `checkedAt` line before telling anyone a link is broken — an empty report from three months ago is not a clean site, and the human output prints the date even when nothing was found. `--json` carries the links twice over: flattened with the page id on every entry, and grouped by page under `byPage`, so neither a table nor a filter has to rebuild the other shape. There are no selectors, because the route accepts none.

```bash
leed settings brokenlinks list --json                          # checkedAt, links[], byPage{}, pageCount
```

**`leed settings menu create` makes an EMPTY menu and answers its `menuId` and first `revision`; everything after that is one item at a time.** The id and the revision are both in the result (`data.menuId`, `data.revision`), so a script chains straight into `menu add <menuId> --base-revision <revision>` with no `get` between — and every item write answers the next revision the same way. `--name` is required (it is refused as `invalid_arguments`, not by the parser, so `--json` still gets an envelope) and is trimmed before it is sent. Names are **unique among the company's live menus, by exact, case-sensitive match**, and `create` is not idempotent: re-running it with a name that is taken fails with `conflict`, naming the existing menu's id so you can `menu get` it instead, and never hands back the existing menu as if it were new. A new menu is a draft, marked unpublished: it reaches the site when something binds it (a documentation page type's left nav, or the company's top or bottom navigation) and it is published with `leed settings publish`, which the result's `next` names. `menu delete <menuId>` takes no prompt, reads the menu first (an unknown id is `not_found` before anything is removed), and **refuses a menu a documentation page type uses as its left nav**, because a docs page's URL comes from its place in that menu; give the page type a different left menu first. It does not detect a menu bound as the company's top or bottom navigation, so check that before deleting one. A delete prunes the menu from the site's `menu.json` on the preview branch straight away, so it leaves nothing pending.

**A menu item's `title` is a hover tooltip, not its label.** `--name` is the text the menu shows. `--title` only becomes the link's `title` attribute, which the browser shows as a tooltip on hover, and it defaults to empty. Leave it unset unless the user wants a tooltip on that item; never copy the name into it.

```bash
leed settings menu create --name "Docs Nav" --json             # data.menuId, data.revision
leed settings menu add <menuId> --base-revision <revision> --name Guides --top-level --json
leed settings menu list --json                                 # ids, names, docs flag, unpublished flag
leed settings menu delete <menuId>                             # no prompt; refused for a docs left nav
```

**`pending` and `publish` act on every settings type at once** — company settings, page types, labels, autolinks, menus, forms and users — which is why they hang off the group rather than living under a noun. `pending` lists one entry per dirty record for the types that publish individually and one entry for each type whose published file is rewritten whole (autolinks, and the company's own `Settings (General)`). `publish` takes those entries' ids positionally; `--all` publishes everything pending and is deliberately not the default, because "everything pending" is a set you have not looked at.

```bash
leed settings pending --json                       # what is waiting, with each entry's id
leed settings publish company_settings-<companyId> # publish one entry by id
leed settings publish --all                        # publish everything pending
```

Publishing commits to the site repository and starts a build, so the ids `pending` reports are the ids `publish` expects — pass a `type` back untouched rather than branching on a fixed list, since the CMS may know kinds a given CLI release does not.

## Contacts (`leed contacts`)

Export and import the company's contact list in bulk. Like `leed settings`, these need no site checkout — contacts belong to a company, so `--company <companyId|domain>` and `-e, --env <name>` select the target and default from the site you are in when you run them inside a checkout.

```bash
leed contacts export ./contacts.csv                  # CSV, the default, and what a spreadsheet opens
leed contacts export ./contacts.json --format json   # same ten columns as an array of objects
leed contacts import ./contacts.csv                  # create or update, matching on email address
```

The destination and the source are **required positionals** — a contact list cannot go to stdout, because under `--json` stdout carries the result document and nothing else. `--format <csv|json>` names the FILE's format and defaults to the extension, then to CSV; it is not the global `--json` flag, which chooses how the result document is printed.

**The ten columns are the contract both verbs speak, and the Engage UI importer maps them too:** `email, firstName, lastName, title, phone, linkedinUrl, country, timezone, name, doNotContact`. `name` is the account the contact belongs to and the only account field that survives an import — firmographics such as industry, revenue and address are not exported, because the bulk write discards them. `doNotContact` travels out and is ignored on the way in; consent belongs to the opt-in and opt-out flows, never to a file.

**An absent column and an empty cell mean different things on import.** A column the file does not carry leaves that field alone; a column it carries with an empty cell clears it. `timezone` and `name` are the two exceptions — an empty cell there leaves the stored value alone.

**Contacts are metered, so an export returns only what the plan permits reading.** The command reports the split — `exported 250 of 4,182 — 3,932 locked above your Free tier limit` — and the `usage` block in `--json` carries `captured`, `visible`, `locked`, `limit` and `tier`. The locked contacts still exist and are not deleted. An IMPORT is never refused for exceeding the limit: capture is unmetered, so the contacts above it are captured and locked rather than rejected.

An export holds the company's PII. The file is written `0600`, and a destination inside a git repository that does not ignore it is **refused before anything is written** — `leed site commit` runs `git add --all`, so a contact CSV in a site checkout would be committed. A cell beginning `=`, `+`, `-` or `@` is written with a leading apostrophe so a spreadsheet shows it as text instead of executing it; `leed contacts import` strips that apostrophe again.

## Content Import (`leed import`)

Content into the CMS, from whichever source it is in. The **source is the sub-noun**, so one command set covers an OpenAPI spec, a directory of markdown and a directory of HTML. Run these from the site folder: the staged set is written into the checkout so you can review it with a real build.

```bash
leed import openapi ./api.yaml   --page-type-id pt_api_docs   # stage a page set from an OpenAPI spec
leed import markdown ./leed-import --page-type-id pt_docs     # stage a page set from markdown files
leed import html ./leed-import     --page-type-id pt_docs     # convert .html in place, then stage
leed site build --serve                                       # THE REVIEW STEP, for every source
leed import status --page-type-id pt_docs                     # what is staged, and anything that blocks apply
leed import apply  --page-type-id pt_docs                     # upload the reviewed set
leed import clean  --page-type-id pt_docs                     # discard the staged set
```

**Three steps, and the middle one is `leed site build`.** A staging verb writes a reviewable set plus a manifest; you review it as rendered pages; `apply` uploads it. `apply` refuses when the source has changed since staging and when no recorded build is newer than the staging run — so what you upload is what you reviewed. (`-d`/`--debug` builds are deliberately not recorded; see the note under Build & Serve.)

**The nav is the structure; the directory tree is just how you seed it.** A documentation page's URL path comes from its menu folder ancestry, so each directory becomes a nav folder whose path segment is the slugified directory name, and every `.md` becomes one page. The staged menu lands in `src/_data/menu.json`, and you may reorder, rename or re-parent in it during the review window — `apply` re-derives every page's path from the menu you leave behind, not from the directory tree. Importing into a page type that already has folders **merges** into them rather than replacing, reusing the nav ids of folders that already match.

**There is no `index.md` support, deliberately.** Folders in a documentation nav cannot be links, so an index page could never attach to its folder.

**The source directory is read-only, and `leed-import/` is the documented place to put one.** It is gitignored in new sites. The cleaned output is COPIED into `src/<pageTypeSlug>/`; those staged copies are derived artifacts that `apply` removes on success and `clean` removes on abandonment. `leed import html` is the one exception: it writes `<name>.md` beside each `<name>.html` and renames the original to `<name>.html.bak` so the build does not pick it up — `*.html.bak` is gitignored too, and `clean` reverses exactly the renames it made. Images are not uploaded; use `leed asset upload` for those.

**`apply` updates the BODY of a page that already exists, if that page is still an unpublished draft.** It creates pages, fills empty ones, and replaces the body of one the CMS already holds as a draft of the same page type in the same folder — so editing a source file and re-importing does land. It will NOT touch a page that has been published, one holding pending suggestions, or one that has moved: those are left exactly as they are. Only the body is ever replaced; title, slug, labels and folder stay as the CMS holds them, because a source file silently moving a live page's URL is not an update. `leed import status` reports how many of the staged pages the CMS already holds before you run `apply` — read it rather than inferring from the staged count. A file you MOVE in the source tree becomes a new page at its new path, leaving the old one in the CMS for you to delete.

**`leed site validate` and `leed site commit` refuse the staged `.md` files, and that is correct:** page content is CMS-owned and the CLI cannot commit a competing copy of it. When they do, they name the page type and point at `leed import apply` or `leed import clean` rather than at `leed site validate --reset`, which would throw the staged set away.

## Pages (`leed page`)

The CMS's pages from the command line — **one page at a time, immediately, with validation before the write**. That is what separates this noun from `leed import`: that one is set-based and staged, reviewed through `leed site build` before anything is uploaded. Here each verb acts on a single page (`stamp` takes several, but changes only their source id), the CMS mints the id, and nothing needs a site checkout, so `--company <companyId|domain>` and `-e, --env <name>` select the target exactly as on `leed settings`.

```bash
leed page sync-state --page-type-id pt_docs                   # every page in one page type: path, status, source id
leed page get <pageId>                                        # print one page's markdown body (--json adds metadata and block anchors)
leed page review <pageId>                                     # read its open comment threads and pending suggestions, per block
cat page.md | leed page create --page-type-id pt_docs         # create one page from a pipe
leed page create --page-type-id pt_docs --file ./page.md      # ...or from a file
cat page.md | leed page update <pageId>                       # replace the whole body (never-published pages only)
cat block.md | leed page update <pageId> --block <dataId>     # replace ONE block, under compare-and-swap
cat block.md | leed page update <pageId> --block <dataId> --source-id <sha>  # ...and tag the page with the commit it was checked against
leed page stamp <pageId...> --source-id <sha>                 # mark pages current without editing them
leed page publish <pageId>                                    # schedule it for now
leed page schedule <pageId> --at 2026-11-01T09:00:00Z         # schedule it for an instant
leed page frontmatter get <pageId>                            # read the page's custom frontmatter
cat fm.yaml | leed page frontmatter set <pageId>              # REPLACE the page's custom frontmatter
```

**Piping is the primary form.** Nothing lands in the repo, so nothing has to be gitignored, archived or explained. `--file` is the convenience — and the only form that supplies a FILENAME, which is what the title and slug fall back to. With neither a pipe nor `--file` the command refuses rather than waiting on a terminal nobody is typing at.

### Validation: three outcomes, and the middle one is the point

Every write is validated **before** it is sent, by the same code the CMS runs on the way in — so what the CLI tells you is what the server is about to do, and an MCP or API write cannot bypass a rule the CLI applies.

| Outcome | Example | Behavior |
|---|---|---|
| **cleaned** | collapsed blank lines, `*` bullets becoming `-`, which H1 became the title | applied, and reported |
| **dropped** | bold inside a heading, `{#custom-id}` on a heading, an image sharing a heading's line, an undeclared frontmatter key | **warned about loudly, and the write proceeds** |
| **blocked** | a feature the page type disallows, a modeled field inside custom frontmatter, a slug the CMS will not accept | refused, nothing sent |

The middle row is why this exists. The CMS discarding what its schema cannot represent is correct; the defect was that it happened in silence. `--strict` turns any dropped finding into a refusal with a non-zero exit and **sends nothing**, so a pipeline chooses its own tolerance. Under `--json` the whole verdict rides in `data.validation`, split into `cleaned`, `dropped` and `blocked`, each finding carrying a stable `code` to branch on.

### Titles, slugs and frontmatter

**The first H1 of the body becomes the title, and is REMOVED from the body.** Leaving it in makes the page render its title twice — once from the template and once as a heading. With no H1 the title comes from `title:` in the frontmatter, then from the un-slugified filename (`getting-started.md` → "Getting Started"); a pipe has no filename, so a piped body with no H1 and no `--title` is refused rather than given a title nobody chose. Several H1s: only the first is promoted and the rest stay in the body, reported. An H1 that is **not** first is left exactly where it is — promoting a mid-document heading would silently reorder the page.

Precedence is **flags > frontmatter > derived**: `--title`, `--slug` and `--label` outrank the document's own frontmatter, which outranks the promoted H1 and the filename.

**A frontmatter key is stored only if you declare it with `--carry <key>` (repeatable), and every dropped key is named.** Passing unknown keys through is what lets `titel:` become a custom field that looks stored and does nothing; dropping it in silence fails you the same way. `labels` is validated against the company's real labels and an unknown one is dropped with a warning; `summary` and `keywords` are read as written; `path` is refused, because a page's path comes from its menu position.

**Modeled page fields are refused inside custom frontmatter.** `title`, `slug`, `labels`, `summary`, `sourceId` and the rest win at publish, so a copy stored as custom frontmatter would save successfully and have no effect. The refusal says so.

### `update`: whole body, or one block

Without `--block` the whole body is replaced, and the CMS allows that **only on a page that has never been published** — once a page has shipped, replacing its body would discard work nothing can recover. With `--block <dataId>` only that block changes, under **compare-and-swap**: the block's hash is read from the page's own manifest and handed straight back with the write, so an edit somebody made in between rejects the whole thing with a `conflict` rather than overwriting it. Never construct a hash; read it and return it.

A block write is a **direct** edit unless you pass `--suggest`, which lands it as a tracked suggestion for a human to accept instead. The result document says which happened.

### `review`: read the comments, answer with suggestions

`leed page review <pageId>` reads a page's comment threads and pending suggestions in one call: the same document as the CMS MCP tool `get_page_review_state`, inside `data` beside `environment`, `companyId`, `status` and `includeTypes`. `data.counts` holds `blocks`, `comments` and `suggestions`; `data.blocks` holds one entry per block carrying a comment or a pending suggestion, in document order, each with its `dataId`, `markdown`, `text`, `hash`, `notAddressable`, the flags `canReplace`, `canReplaceDirect`, `canInsertBefore` and `canInsertAfter`, its `comments` (each thread's `messages` oldest first) and its `suggestions`.

```bash
leed page review <pageId> --json                              # open text threads (the defaults)
leed page review <pageId> --status all --json                 # resolved threads too (open, resolved or all)
leed page review <pageId> --include-types text,emoji --json   # emoji reactions too: counts.comments then matches get_page's openCommentCount
cat block.md | leed page update <pageId> --block <dataId> --suggest   # answer one thread as a tracked suggestion
```

It reads only: nothing on the CLI or over MCP resolves a comment or a suggestion, which is the person's act in the editor. Answer a thread with a `--block` write and `--suggest` on a block whose `canReplace` is true, never a direct edit, which would destroy the thread; an answer that needs an insert beside the block is `update_page_body` over MCP. The whole loop, from reading every thread to the per-thread report, is the `/leed:review` skill (`../review/SKILL.md`). Before any write to a page that already exists, read its count with `--include-types text,emoji`: above zero, write only suggestions.

### `get`: read a page, edit it, send it back

`leed page get <pageId>` reads one page. **Without `--json` it prints only the markdown body** — no headline, no metadata — so a redirect gives you a document the write verbs accept:

```bash
leed page get <pageId> > page.md          # the body, exactly
$EDITOR page.md
leed page update <pageId> --file page.md  # whole body: never-published pages only
```

For a page that has been published, edit one block instead. `--json` returns `data: { pageId, title, slug, path, status, pageTypeId, sourceId, markdown, blocks }`, where `blocks` is every addressable block's `{ dataId, hash }` — the anchor `--block` names. Take the `dataId` from there, write just that block's new markdown, and send it with `leed page update <pageId> --block <dataId>`; `update` reads that block's hash itself just before it writes, so compare-and-swap guards the moment between that read and the write — not the time since your `get`. If the page may have changed meanwhile, `get` it again before you edit. `sourceId` is absent when the page has none, and a page that does not exist is `not_found` (exit `2`).

### `--source-id` and `stamp`: keeping the drift model current

A page's `sourceId` is the commit its content was last checked against. The docs drift model compares it with the commits an issue touched, and release scheduling groups pages by it.

- **`--source-id <sha>` on `create` and `update`** sends the id on the request that writes the body — the fill on `create` and on a whole-body `update`, the ops on a `--block` write, in direct and `--suggest` mode alike — so the tag lands on the revision that holds the content. The value is trimmed; an empty one is `invalid_arguments`. Whenever it is given, the result carries `data.sourceIdWritten`. When the CMS applied the content but could not write the tag, that is `false`: the run is a partial success (`ok: true`, exit `3`), the CMS's reason is in `warnings`, and `next` is `leed page stamp <pageId> --source-id <sha> --env <env> --company <company>`. Do **not** re-run the write — run the stamp.
- **`leed page stamp <pageId...> --source-id <sha>`** marks pages current **without editing them**. Only `sourceId` is written: not the body, not the status, not any other field — **a published page stays published**. Use it for a page you reviewed against a commit and found still accurate. `--source-id` is mandatory. Each page is read first; one that already carries the id is reported with `changed: false` and not written, so a repeat run is safe. The result lists `data.pages[]` as `{ pageId, sourceId, previousSourceId, changed }` and any failures in `data.failed[]` as `{ pageId, code, message }` — a page that does not exist is `not_found` there and does not stop the others. If any page fails — even every page — the document is still `ok: true` with each failure in `data.failed[]`, and the run exits with the first failure's class; `data.pages` is empty when none was stamped. `--dry-run` reads every page and returns the plan of PUTs it would make, writing nothing. There is no `next`: stamping is the end of the job.

### `publish` is `schedule` at now

There is no instant-publish endpoint. `leed page publish` schedules the page for the current instant and the CMS's publication cron builds it on its next pass, so both verbs answer `SCHEDULED` rather than `PUBLISHED` — watch for the transition with `leed page sync-state`. `--at` takes a full ISO 8601 instant **with a zone** (`2026-11-01T09:00:00Z`, or `…+01:00`); a local time with no zone is refused, because it means a different moment on your machine and on the worker that reads it. A page that is already `PUBLISHED` cannot be scheduled — revise it first.

**Scheduling any page locks its page type's slug.** That is the CMS's behavior, not this command's, and unscheduling does not undo it.

### `frontmatter set` replaces; it does not merge

`extraFrontmatter` is one JSON column and this verb overwrites it wholesale: a key absent from the document you pipe is a key the page no longer has. Pipe an empty document to clear it. There is deliberately no `--merge`, because reading the record, editing it client-side and writing it back is the lost-update pattern **#401** exists to delete.

### Known caveat: creating documentation pages in a loop (#401)

For a **documentation page type**, `leed page create` also appends the new page to the bound nav menu, through an unguarded read-modify-write of one KV record. One page at a time is fine; a tight loop of creates can lose appends — the measured loss was 23% at around 98 creations per minute. Create documentation pages **in sequence, not in parallel**, until **#401** lands. The command says so in its own `--help`, and a documentation-type create carries the same warning in its `warnings` array so a caller looping over JSON reads it too.

## Deployments (`leed deployments`)

The CMS Deployments screen from the command line: what has been built, and promoting the preview site to the live one. `--company` and `-e, --env` select the target on every verb, exactly as on `leed settings`.

```bash
leed deployments status                       # recent preview and public deployments, and the promote gate
leed deployments promote                      # make the staging commit live; asks first
leed deployments promote --yes                # skip the confirmation (scripts and agents)
leed deployments retry <deploymentId>         # re-run a failed build against the same commit
```

**`promote` publishes to the live public site and cannot be undone from the CLI,** so it is on the confirmation gate and `--yes` is how a non-interactive caller accepts that. It takes no argument: the route promotes the preview site's latest commit, and there is nothing else to promote. `retry` and `status` are not gated — a retry re-runs a commit you already authored.

`status` is a state rather than a listing: the document carries both deployment lists AND whether a promote is currently allowed, so read it before promoting rather than inferring from the newest row. `retry` takes a deployment id exactly as `status` reports it.

## Reporting a Cloudflare block (`leed feedback blocked`)

Cloudflare's firewall sits in front of the CMS, and now and then it mistakes legitimate content for an attack and refuses the request before Leed sees it. The CLI reports that as `request_blocked` (exit `5`), never as `permission_denied`: a CMS 403 is JSON, a block is Cloudflare's HTML page with a `cf-ray` header. The **ray id** is what lets Leed find the rule that fired in Cloudflare and add it to the exception, so every report carries it and the time it happened.

```bash
# The hint of a request_blocked failure is this command with its values filled in:
leed feedback blocked --ray a405c2a089ca7ce0-ORD --method POST --path /api/page --status 403 \
  --occurred-at 2026-10-19T12:00:00.000Z --body-bytes 1832 --body-sha256 <hex> --company <companyId> -e <env>
# Add the excerpt from error.request.excerptBase64 if you have it, or let the CLI compute all three from a file:
leed feedback blocked --ray a405c2a089ca7ce0-ORD --body-file ./blocked-body.json --command "leed page update" --company <companyId> -e <env>
leed feedback blocked --ray <id> --dry-run --json   # shows the exact report body, sends nothing
```

**The report never carries the blocked content**, because it crosses the same firewall. `--body-file` is read locally and only its size, SHA-256 and at most 2 KB of it, base64-encoded, are sent. `--command` keeps only command words and flag names (`leed page update --body`), never a value. `--note` is free text: say what you were doing, never paste the content. `--surface` is `cli` (the default) or `mcp`, for a block an MCP tool call hit. Inside a site checkout the report goes under that site's company; outside one, `--company` and `-e` are required. It shares the CMS's limit of 30 feedback reports per user per hour, and works under `--json` with no prompt; at a terminal, a `request_blocked` failure offers to send the report right away instead.

The MCP equivalent is the `report_blocked_request` tool on the Leed CMS server: same fields, with `command` as the tool name and its argument names written as `name=` with no value (`update_page_body pageId= ops=`).

## MCP Servers (`leed mcp add`)

Registers the Leed MCP servers with your AI agent. The Leed Claude plugin declares no MCP server of its own, so nothing connects at session start: `/leed:setup` runs `--cms`, and offers `--docs` once.

```bash
leed mcp add --cms                    # your company's CMS: build and publish its pages
leed mcp add --cms --scope user       # ...registered with Claude Code for every project
leed mcp add --cms --scope project    # ...written into this site's .mcp.json
leed mcp add --docs                   # the Leed documentation
leed mcp add --cms --docs             # both
```

| Flag | Server | URL | Scope |
|------|--------|-----|-------|
| `--cms` | `<site>-cms` (`leed-<companyId>-cms` outside a site folder) | `https://app.leed.ai/mcp/<companyId>` for the environment in use (`https://staging.app.leed.ai/...` for staging) | `--scope`, see below |
| `--docs` | `Leed-Documentation` | `https://leed.ai/mcp` | always `user` |

**The CMS server is bound to one company.** The `/<companyId>` at the end of the URL is filled in for you from the site you are in when you run it inside a checkout. Outside one, name it: `--site <name|domain|companyId>`, or `--company <companyId|domain>` with `-e <env>` (`-e` may be left out when that company is logged in to exactly one environment). No login is ever taken as a default, the only one on the machine included. When nothing names a company the command fails with `invalid_arguments` and a hint holding the exact `leed mcp add --cms --company <companyId> -e <env>`; it never prompts. `--docs` alone needs none of this. Inside a checkout, a `--site`, `--company` or `-e` that names a different company or environment from the checkout's is treated as outside one: the server is named `leed-<companyId>-cms`, the default scope is `user`, and `--scope project` is refused with `invalid_arguments`, so another company's CMS never takes the checkout's name or lands in its `.mcp.json`.

**`--scope user|project`** decides where `--cms` goes:

- `user` registers it with Claude Code by running `claude mcp add --scope user --transport http <name> <url>`, so it is available in every project. `claude` must be on your PATH; when it is not, the command fails with `external_command_failed` and says so. It works outside a site folder too.
- `project` writes the site's `.mcp.json` (in `raw-content/`), as earlier versions did. It needs a site folder and fails with `not_a_site_repo` outside one.
- With no `--scope`, the default is `user` when you are logged in to exactly one company for the environment or you run it outside a site folder, and `project` otherwise. `--scope` always overrides it.

`--docs` is one public server, so it is always registered at user scope through `claude mcp add`, whatever `--scope` says. It is no longer written into `.mcp.json`. A successful `--docs` also records the answer `leed mcp docs` reports, so `/leed:setup` does not offer it again.

Passing neither `--cms` nor `--docs` is an error — there is nothing to add — and the command prints its usage.

**You must log in with your AI agent to use these MCP services.** Adding the server only tells the agent where it is; authentication happens in the agent (for example `/mcp` in Claude Code).

The command is safe to run repeatedly. Each server reports its `scope` and `created`, `updated` (it existed with a different URL, e.g. a bare `/mcp` from an older CLI or a move between environments) or `unchanged`. At user scope an unchanged server runs no `claude` command at all, and a changed one is removed and added again, because `claude mcp add` refuses a name that exists. To tell which, the CLI reads (never writes) Claude Code's `~/.claude.json`, or `$CLAUDE_CONFIG_DIR/.claude.json`. At project scope it merges rather than overwrites: servers and top-level keys it does not own are left exactly as they were, and so are extra keys inside its own entries. A `.mcp.json` that is not parseable JSON is refused with `validation_failed` and left untouched. `--dry-run` lists both kinds of change and makes neither.

Under `--json` the result's `data` carries `scope` (the scope `--cms` used, or `user` for `--docs` alone), `path` (the `.mcp.json` written, or `null` when nothing was written there), `created` and `servers` (`name`, `url`, `scope`, `action`).

`.mcp.json` is gitignored in new sites: it is local configuration naming the environment your own agent talks to. Sites created before this command shipped should add `.mcp.json` to their `.gitignore`.

### Whether the documentation server is set up (`leed mcp docs`)

```bash
leed mcp docs --json            # registered? answered?
leed mcp docs --decline --json  # record "no", so setup never offers it again
```

Reports whether Claude Code's user config registers `Leed-Documentation`, and the answer recorded for `/leed:setup`'s one-time offer. `data` carries `answer` (`added`, `declined`, or `null` when never answered), `registered` (`true`, `false`, or `null` when Claude Code's config could not be read), `name`, `url` and `preferences`, the per-user file the answer is kept in (`~/.config/leed/preferences.json`, mode 600). Offer the server only when `answer` is `null` and `registered` is `false`. `leed mcp add --docs` records `added`; `--decline` records `declined`. It reads Claude Code's config file and makes no network call, and it runs in a sandbox.

## Other Commands

```bash
leed self-update                        # Update CLI to the newest build for this site's environment
leed site build --verbose               # add to any command for verbose logging (-v is the CLI version)
leed site build -n "leed:*"             # -n/--noise: add to any command to filter log output
```

## Complete Workflow Example

```bash
# 1. Make your template/CSS changes in raw-content/src/
# 2. Build and preview locally
leed site build --serve
# 3. Review at http://localhost:8080
# 4. Stop server (Ctrl+C)
# 5. Validate changes
leed site validate
# 6. Build final version
leed site build
# 7. Commit
leed site commit -m "Add new hero section to homepage"
# 8. Push to staging
leed site push
# 9. Verify on staging environment
# 10. Promote to production (asks first; a person decides): see the site-publish skill
leed deployments promote
```

## Important Restrictions

- **Staging branch only** — all CLI operations require the `staging` branch
- **No merge commits** — rebase only (if conflicts arise: `git stash`, `git pull --rebase`, `git stash pop`)
- **Commit via CLI only** — never use `git commit` directly (the CLI embeds tracking metadata)
- **Production promotion** — `leed deployments promote` (see **Deployments** above and the site-publish skill). It publishes to the live site and cannot be undone from the CLI, so it asks for confirmation; promote only when the user has decided to, and pass `--yes` only on their say-so. The CMS Deployments screen does the same thing
