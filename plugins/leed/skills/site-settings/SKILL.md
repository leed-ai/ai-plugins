---
name: site-settings
description: Reads and changes Leed CMS settings from the command line with `leed settings` — page types, labels, autolinks, search indexes, forms, shortcodes, users, URL aliases, OIDC trusts, broken-link reports and the company's own Settings (General) — and publishes pending settings changes to the live site. Use whenever a site needs a CMS setting changed rather than a template or content file edited.
---

# Site Settings Skill

You read and change the CMS settings a site is built from, using `leed settings`, without opening the web UI. These are the things an editor would change in the CMS under Settings: page types, labels, autolinks, search indexes, forms, shortcodes, users, URL aliases and OIDC trusts, plus the company's own general settings and the broken-link report.

## When to Use It

- A setting needs changing: the site title, timezone, date format, reading speed, social accounts, the documentation layout, fonts, themes or menus.
- A **page type** must be created or edited — a documentation set, an api set, a posts set, an internal set — including its slug, layout, labels or documentation configuration.
- A **label** must be created or edited, including making it a series.
- An **autolink** must be added, retargeted, reordered or deleted.
- A **search index** must be created or repointed at a different set of page types. Creating a documentation or api page type already makes one named after it, so reach for this only for a second index or one spanning several sets.
- A **form** must be created, edited, published or deleted — its fields, its buttons, its callbacks, its after-submit email, or the asset a submission unlocks.
- A **tracked short link** must be created, or you need to see the ones that exist and where they point.
- A **user's profile** must be edited, or their **base role** changed. This is the only PROGRAMMATIC surface that can change a role — the CMS's Team Members screen is the other — and no AI tool can.
- A **URL alias** must be added or removed, or you need to know which URL belongs to which page.
- An **OIDC trust** must be registered so a CI pipeline can publish, or revoked so it cannot.
- You need the **broken-link report** for the site.
- You need to know **what is waiting to be published**, or to publish it.
- You are about to tell the user to "go into the CMS and change X". Check here first — most of Settings is reachable from this CLI.

Do **not** use it for template or content files. Layouts, partials, CSS and markdown live in the site checkout and belong to the site-builder and site-publish skills. Do not use it for uploading or editing assets either — that is the site-assets skill.

## Rules

- **No site checkout is needed.** Settings belong to a company, not a folder, so every subcommand takes `--company <companyId|domain>` and `-e, --env <name>`. Run inside a site's checkout and both come from that site; run anywhere else and nothing is defaulted: pass `--company`, and `-e` as well unless that company is logged in to exactly one environment (`leed auth status --json` lists the sessions, each with its `environment`). Without them the command refuses with `invalid_arguments`, and the hint is the same command with the missing flags added. This is the opposite of `leed site *`, which runs on a site checkout: the one you are in, or the one `--site <name>` names.
- **Always pass `--json`** when you need to read the result. One JSON document on stdout, progress on stderr. Read the envelope: `ok`, then `data`, or `error.code`, `error.message` and `error.hint`.
- **Authentication** is the user's `leed auth login` session. On `not_authenticated` or `auth_expired`, stop and ask the user to run the command in `error.hint`. Don't try to log in yourself.
- **Ids, not names.** `--label`, `--labels` and the autolink `--page-id` take ids. Look labels up with `leed settings label list --json`, or in `src/_data/labelList.json` in a site checkout.
- **An omitted flag is left untouched.** `set` is a patch, not a replacement. Send only what you are changing.
- **Rules live in the CMS, and its refusals name the field.** The CLI only checks enum membership and numeric spelling while parsing; anything else you see came from the API and means what the web UI would have told you.

## The Eleven Nouns

```bash
leed settings pagetype list [--type <kind>] [--label <id>] [--slug <slug>] [--needs-publish]
leed settings pagetype get <pageTypeId>
leed settings pagetype create --type <documentation|api|posts|internal> [field flags] [--clear <field>] [--from-file <path>]
leed settings pagetype set <pageTypeId> [field flags] [--clear <field>] [--from-file <path>]

leed settings label list [--is-series true|false] [--series <kind>] [--visible true|false] [--slug <slug>] [--needs-publish]
leed settings label get <labelId>
leed settings label create --name <name> [field flags] [--clear <field>] [--from-file <path>]
leed settings label set <labelId> [field flags] [--clear <field>] [--from-file <path>]

leed settings autolink list [--needs-publish] [--page-id <id>] [--unlinked]
leed settings autolink get <autolinkId>
leed settings autolink create --text <phrase> --page-id <pageId> [--position <n>]
leed settings autolink set <autolinkId> [field flags] [--from-file <path>]
leed settings autolink delete <autolinkId>
leed settings autolink reorder <autolinkId> --position <n>
leed settings autolink reorder --order <ids|@order.json>

leed settings searchindex list
leed settings searchindex get <searchIndexId>
leed settings searchindex create --name <name> [--page-type-ids '["pt_1","pt_2"]']
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
leed settings shortcode create (--url <url> | --page-id <pageId>) [--vanity <code>] [--params.utm_source <v> …] [--from-file <path>]
leed settings shortcode set <code>          # always refuses; see below

leed settings user list
leed settings user get <userId>
leed settings user set <userId> [field flags] [--role <role>] [--clear <field>] [--from-file <path>]

leed settings oidctrust list
leed settings oidctrust create --name <name> --profile <id> --issuer <url> --identity-label <label> --claim-constraints '{…}' --page-type-ids '[…]' --minimum-status <status> [--yes]
leed settings oidctrust delete <trustId>

leed settings path list [--query <text>] [--type <current|next|alias>] [--alias]
leed settings path resolve <url>
leed settings path create <pageId> <path>
leed settings path delete <id> [--yes]

leed settings brokenlinks list
```

**A posts page type's `layout` defaults to `empty.hbs` and must otherwise already exist.** `pagetype create` without `--layout` stores `empty.hbs`, and the CMS writes `src/_layouts/empty.hbs` (exactly `{{{ process content }}}`) and a `src/<slug>-index.hbs` list page when the repo lacks them. With `--layout <name>` it scaffolds neither: the layout must already be a file under `src/_layouts/` on the site repo's `staging` branch, or the create is refused with 400 naming the layout. `pagetype set --layout` is held to the same rule whenever it changes the stored value, `empty.hbs` included. Documentation and api types always use the shared docs layout and are not checked. Add the layout to the repo first (`leed site commit`, then `leed site push`), then point the page type at it. `leed site validate` checks every page type against the checkout the same way and fails naming each page type whose layout is missing. New sites start with only the Root page type; add a blog with `/leed:create blog` or a documentation set with `/leed:create documentation` in Claude, which create the page type, its layouts or menu and search index, and the starter templates in one step.

**An internal page type holds content a team writes and organizes like documentation but that is never published.** Use one for a handbook, runbooks, policies or anything else that must never reach the site. Create it with `--type internal` and only a name and a slug: every other setting is fixed by the CMS, the slug is stored as `internal/<slug>`, and a navigation menu with the same name is created and bound to it, with no search index. It needs the Growth plan or above, and is refused with `upgrade_required` otherwise. Nothing about an internal set ever reaches the site: its pages, page type and menu are never written to the site repo, never appear in pending changes, and never show up in public search or the docs MCP. Its pages cannot be published or scheduled (`internal_page_not_publishable`). A revision is **locked** instead, with the `lock_page` tool, and a locked page is changed by putting it back into revision. Find internal content with the `search_internal` tool. Never create files for an internal set in the site checkout.

**`searchindex` has no `delete` and no `--clear`.** The API has no delete route — removing an index is done in the CMS — and no field of a search index is nullable. `--page-type-ids` takes a JSON array and **replaces** the stored list rather than appending to it, so read the current one with `get` first.

**`company` is the only singleton.** There is exactly one settings record per company and `--company` already names it, so `get` and `set` take no positional id, and there is no `list` and no `create`.

**`leed settings shortcode set` ALWAYS refuses, and that is not a bug to work around.** A shortcode is read-only once it exists: the destination and the UTM tags are fixed at creation so a tracked link never changes under a QR code or a printed URL that is already out in the world. There is no update route for one at all. The command exists so you learn the rule from the command rather than from a usage error, and it tells you what to do instead — create another shortcode with the values you want. Do not retry it, and do not try `--from-file`: it carries no field flags at all. The code it returns is `invalid_arguments`, and it never authenticates, so it answers identically on a machine with no session.

**`leed settings oidctrust create` needs `--yes` when nobody is at a terminal**, and you should understand what you are being asked to confirm before you pass it. Registering a trust grants **token-based access** to the company: it lets a CI pipeline mint tokens that **publish into it** — for the page types you nominate, from the editorial status you set as the floor. Without `--yes` it registers nothing, and the code says which kind of unattended it was: `confirmation_required` under `--json`, `interactive_input_required` in human mode with no interactive terminal. The command's own output carries the one value the customer must have: the **audience**, which Leed generates and which their pipeline has to put in its token request. Pass it on; it cannot be chosen and cannot be changed. `oidctrust delete` is a soft **revoke** — it withdraws access immediately and leaves the row in `list` as an audit trail, which is why `list` shows revoked trusts and has a status column, and why `delete` needs no confirmation.

**`leed settings path delete` takes the NUMERIC id from `path list`, not a path string.** The delete route has no id in its URL — the number travels in the request body — so `path list`'s first column is the only place that value exists. Pass a path and it refuses before it does anything. Note too that `delete` removes aliases only: the CMS refuses the id of a `current` row, and of a `next` row unless its page has been deleted, since removing one would take a page's own URL away with no way to put it back from here — `path create` only ever makes aliases. A non-alias delete is also **confirmed** before it is sent: it needs `--yes` unattended, failing `confirmation_required` under `--json` and `interactive_input_required` in human mode with no terminal. Deleting an alias needs nothing. Read the `type` column before you pass `--yes`. `path create` can only ever make an **alias**; `current` and `next` rows belong to the publish pipeline.

**`leed settings user set --role` is the only way to change a base role from anywhere outside the web UI.** No AI tool accepts the field, deliberately — an agent that can grant a role can grant itself one. Only an Administrator may make the change — anyone's role or their own — and the CMS refuses it with `permission_denied` otherwise. A base role is a floor, not a ceiling: a per-resource override can raise it and never lowers it. Resource-level overrides are a separate API this skill does not touch, and `user get` deliberately does not show them.

**`leed settings brokenlinks list` reports the LAST STORED check, not a fresh one.** There is no way to ask for a new crawl, so read the `checkedAt` line before telling anyone a link is broken: an empty report from three months ago is not a clean site. `--json` carries the links both flattened, with the page id on every entry, and grouped by page.

**`leed settings form publish <formId>` and `leed settings publish form-<formId>` are the same operation.** Both reach the shared deployments publish; the verb exists so you can name the formId you already have instead of the prefixed pending id. A form with nothing pending is a success that published nothing, not a failure.

## Field Flags

**They are generated from the API's own schema**, so a setting the CMS accepts cannot be missing from the CLI — 47 flags on the company alone, over 17 top-level keys. Run `--help` on any verb to see the current set with its descriptions; don't guess a flag name.

- **Nested fields are dotted, kebab-cased per segment:** `--documentation-configuration.header.button.text "Start free"`.
- **Closed sets carry their choices** (`--type`, `--date-format`, `--documentation-configuration.layout-name`, every boolean as `true|false`), and numeric fields are bounded.
- **`--clear <field>` is offered only where a stored null is a real state**, so `--clear site-title` is structurally impossible rather than merely refused. It is repeatable.
- **`--from-file <path>`** takes a whole patch as JSON, with individual flags layered over it. It is held to the same field list as the flags: a document naming a field the noun withholds — `protected` or `isDirty` on a form, `email` or `externalAccounts` on a user — is refused with `invalid_arguments` naming the field and why, before anything is sent. It is a second spelling for the fields that have flags, never a way past them.

```bash
# Change two fields; everything else is left alone
leed settings company set --site-title "Acme Docs" --timezone "America/Chicago"

# Return nullable fields to their inherited values
leed settings company set --clear og-card.description --clear paging.size

# A whole patch from a file, with one flag layered over it
leed settings company set --from-file ./company-patch.json --site-locale en-US
```

## Reading Results

**`set` reports what it actually changed.** The `changed` array names the fields whose stored value the write altered, `unchanged` the ones that already matched. Re-sending a stored value is a success with an empty `changed` — not a failure, and not indistinguishable from one. A cleared field comes back absent (`(unset)` in human output), because a cleared field reads back as no key at all.

**Error codes**, shared by every noun:

| Code | Meaning | What to do |
|---|---|---|
| `validation_failed` | A value the schema refuses. `error.issues` is `{ path, message, code }` per problem | Fix the named field. The value you sent is never echoed back |
| `permission_denied` | A stronger role has to make this change | Tell the user which setting needs a stronger role |
| `not_found` | No such id in this company | Re-list to get the right id |
| `conflict` | Someone else edited it while you were writing | Re-read and re-apply |
| `auth_expired` | Session expired | Ask the user to run the command in `error.hint` |
| `network_error` | The CMS is unwell or shedding load | Retry shortly. `settings_migration_pending` is this, and means exactly "retry shortly" |
| `permission_denied` *(402 origin)* | The company's **plan** does not include the feature — every `shortcode` verb and `oidctrust create` sit behind one | Tell the user a billing owner has to upgrade; retrying never helps. The hint says so |
| `permission_denied` *(`form_protected` origin)* | The form is owned by an integration and is read-only on **every** surface; `form set` and `form delete` both refuse one | Nothing changes this — no role, no upgrade. The hint says so. Pick a different form or go back to the integration's owner |
| `confirmation_required` | A gated command was run under `--json` without `--yes` — `oidctrust create`, or `path delete` on a non-alias row | Only pass `--yes` once the user has actually agreed to what the command does |
| `interactive_input_required` | Either gate, in human mode with no interactive terminal | Same answer: get the user's agreement, then pass `--yes` |
| `invalid_arguments` | The invocation cannot be used — including `shortcode set`, which no invocation can make valid | Read the message. For `shortcode set` the answer is `shortcode create`, not a retry |

## Publishing

**Settings changes are not live until they are published**, and `pending` and `publish` act on every settings type at once — company settings, page types, labels, autolinks, menus, forms and users — which is why they hang off the group rather than living under a noun.

```bash
leed settings pending --json                       # what is waiting, with each entry's id
leed settings publish company_settings-<companyId> # publish one entry by id
leed settings publish --all                        # publish everything pending
```

`pending` lists one entry per dirty record for the types that publish individually, and one entry for each type whose published file is rewritten whole (autolinks, and the company's own "Settings (General)"). Pass a `type` back untouched rather than branching on a fixed list — the CMS may know kinds a given CLI release does not.

**`--all` is deliberately not the default**, because "everything pending" is a set you have not looked at and may contain other people's unpublished edits. Run `pending` first and name the ids, unless the user has said they want all of it.

Publishing commits to the site repository and starts a build. This is a **different** publish from `leed site push`, which publishes the template and content files in your checkout — see the site-publish skill when the user's change was a file rather than a setting.

## If Cloudflare blocks a request

Cloudflare's firewall sits in front of the Leed CMS and now and then mistakes legitimate content for an attack. When it does, the request never reaches Leed.

1. **Recognize it.** The CLI fails with `request_blocked` (exit `5`). An MCP tool call, or any other request to the CMS, comes back with a 403 and an HTML page ("Just a moment…" or "Attention Required"), `server: cloudflare` or a `cf-ray` value, and no JSON error. It is not a permissions problem: do not ask for a different role or sign in again.
2. **Stop.** Retry the same write at most once. Never alter, encode, split or obfuscate the user's content to get past the filter: the content is theirs, and the false positive is Leed's to fix.
3. **Report it.** From the CLI, run the `leed feedback blocked` command in the error's `hint`; it carries the ray id, method, path and time (add `--excerpt-base64` from `error.request` when it is there). From MCP, call `report_blocked_request` with the `rayId`, the time as `occurredAt`, the method and path if you know them, the tool name and its argument names written as `name=` with no value as `command` (for example `update_page_body pageId= ops=`), and at most 2 KB of the body base64-encoded as `excerptBase64`. Never put the blocked text itself in `command` or `note`: the report crosses the same firewall.
4. **Tell the user.** Say what was blocked (which page, setting or asset, and which command or tool) and give the ray id, then continue with the rest of the work.

## Known Limitations

- Needs a `leed auth login` session; the change is made as that user, with that user's role.
- Two company fields have no flag on purpose: `documentationConfiguration.menus.left`, which is a page type's concern since the docs left menu moved there, and `ogCard.image`, which no screen sets.
- A page type's kind is immutable. There is no conversion path between documentation, api and posts — create a new set instead.
- `leed settings autolink reorder` with `--order` replaces the whole application order, so pass every id. With an `autolinkId` and `--position` it moves just that one.
- `shortcode` has no `delete` and no `set` that works; `user` has no `create` and no `delete`; `oidctrust` has no `set`; `brokenlinks` has no `--refresh`. Each absence is a decision rather than a gap — the sections above say which.
- A **protected** form is system-owned and the API refuses every change to it, including deletion. `form list` marks them, so check before you try.
- `form delete` is refused while any page still uses the form or it has collected any responses, and the refusal says how many of each.
