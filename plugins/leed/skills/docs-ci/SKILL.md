---
name: docs-ci
description: Sets up continuous documentation for a customer's GitHub or GitLab repository (`/leed:docs-ci`) — creates the Leed OIDC trust pinned to the repository's numeric id and its release ref or environment, writes the release job into their own CI (the `leed-ai/schedule-release` GitHub Action, or the GitLab component, which self-managed GitLab includes by its gitlab.com URL) as a dry run first, and adds the rule for which commit their agent stamps on a docs edit, so docs pages publish with the release that ships the code they describe. Needs the Growth plan, the Content Publisher role and the Leed CLI. Use when someone wants their docs to publish when their code releases, or asks to connect a repository's CI to Leed.
---

# Docs CI Skill

You connect a customer's code repository to Leed so their documentation publishes with their releases. A docs page carries a `sourceId`, the commit it was written against. When a release ships, a job in the customer's own CI sends the release's commits to Leed (`POST /api/page/schedule-by-source`, authenticated with the pipeline's OIDC token), and Leed schedules every page stamped with one of them. Three pieces make that work, and this skill sets up all three:

1. **An OIDC trust** in Leed that accepts tokens from that repository's release pipeline only.
2. **The release job** in the customer's CI, using the published integration: the GitHub Action `leed-ai/schedule-release@v1`, or the GitLab component `gitlab.com/leed-ai-oss/schedule-release/schedule@1.1.0`. Both are public, and the job always references them from their own repositories, never a copy: self-managed GitLab includes the component's template from gitlab.com at the `1.1.0` tag.
3. **The stamping rule** in the repository's agent instructions, so docs edits are stamped with a commit that will be in the release.

You run in the customer's product repository, not in a Leed site checkout. The scripts sit in this skill's `scripts/` directory (the base directory this file was loaded from). They are plain Node with no dependencies and no network access, print one JSON document, never follow a symlink, and write only the one CI file, inside the repository you name with `--root`.

**Never commit, push or merge anything.** The skill writes the CI file and the agent instructions in the working tree; the user reviews them and merges them through their normal flow.

## Before starting (stop and write nothing if any check fails)

1. **The Leed CLI and a signed-in session.** The trust can only be created with `leed settings oidctrust create`, by a signed-in person: trusts grant publish access, so the CMS keeps them off MCP and off API keys by design, and there is no MCP tool for them. Over MCP alone (Claude Desktop, or no CLI), explain that, point at `/leed:setup` (`../setup/SKILL.md`) to install the CLI and sign in, and stop. Run `leed auth status --json`; with no session, hand the user `! leed auth login` and wait.
2. **The company and the site.** `leed site list --json` lists the sites on this machine; ask which company's docs this repository feeds when there is more than one. Outside a site checkout nothing is defaulted, so pass `--site <site>` to `leed site` commands and `--company <companyId>` (and `-e <env>` when the company is signed in to more than one environment) to `leed settings` commands.
3. **The plan.** Run `leed site eject --json --site <site>` and read `data.tier`: `null` counts as Free, and the plans, lowest first, are Free, Starter, Growth and Enterprise. **Below Growth, stop**: tell the user that scheduling docs by release (`scheduleBySource`) is included from the Growth plan up and the site is on `<tier>`, and write nothing.
4. **The role.** Run `leed settings oidctrust list --json --company <companyId>`. Listing trusts needs the same `developer:write` access as creating one, so `permission_denied` means the user is not a Content Publisher (`Publish`) or above: **stop**, say a Content Publisher or an Administrator has to run this, and write nothing. Keep the list: re-runs use it.
5. **The forge.** Run `git remote get-url origin`, then:

   ```bash
   node "<skill dir>/scripts/docs-ci.mjs" classify --remote "<remote url>"
   ```

   It answers `forge` (`github`, `gitlab.com` or `gitlab-self-managed`), the trust `profile` and `issuer`, and the `identityLabel` and `trustName` to use. `ok: false` stops with its `reason`: an unsupported forge, or a self-managed issuer that is not a public HTTPS host (Leed runs OIDC discovery against it when the trust is created). For a self-managed host, confirm with the user that it is a GitLab instance and that the issuer is right (`confirm`); for one served under a path, run `classify` again with `--issuer <url>`.

## 1. Re-running: never duplicate

Before anything is created, look for an existing setup:

```bash
node "<skill dir>/scripts/docs-ci.mjs" find --root <repo> --forge <forge>
```

When `setUp` is true, the release job is already there: find its `audience` among the trusts from step 4 and report the trust (its name, `active`, page types and minimum status) and the job's file. **Change nothing.** If that trust is revoked (`active: false`), say so, and that replacing it means creating a new trust and putting its audience into the job; do neither unasked. When `setUp` is false but an active trust has the same `issuer` and `identityLabel`, ask whether to reuse its audience rather than create a second trust.

**A trust cannot be edited.** When the user wants a different configuration on a re-run (another page type, such as a blog or changelog type releases should now carry, another minimum status, another release ref or environment), that is a new trust: create it (§3), put its new `audience` into the CI file in place of the old one, and tell the user to revoke the old trust (`leed settings oidctrust delete <trustId> --company <companyId>`, which revokes it) only after that CI change has merged, never before, or every release in between fails with a 401. Never revoke it yourself.

## 2. The branch model

Read `references/branch-model.md`. Read the repository's settings, then ask what the API cannot tell:

- **GitHub:** `gh api repos/<owner>/<repo>` for the numeric `id`, `default_branch` and the `allow_merge_commit`, `allow_squash_merge` and `allow_rebase_merge` fields.
- **GitLab:** `glab repo view <path or URL> --output json` for the numeric `id`, `default_branch`, `ci_config_path`, `merge_method` and `squash_option`.

Then ask which branch feature work merges into, what a release is (a push to which branch, or a tag matching which pattern), and, when those branches differ, how the integration branch reaches the release branch. Run:

```bash
node "<skill dir>/scripts/docs-ci.mjs" plan --forge <forge> --merge-into <branch> --release-branch <branch> \
  [--release-tag '<pattern>'] [--promote merge|ff|squash|rebase] [--allowed <methods>] --id <numeric id>
```

When feature work is squashed into the release branch and a release workflow (often a `workflow_dispatch`) pushes a release commit, pass `--release-dispatch --release-workflow '<the release workflow's name>' --release-commit-grep '<a git log --grep pattern matching the release commit>' --default-branch <default_branch>` in place of `--release-tag` and `--promote`: the docs job then runs when that workflow completes, with the range from the previous release commit to this one. `--default-branch` is the `default_branch` read above: a `workflow_run` job always runs on the default branch, so `plan` refuses this model when the release branch is another one (the trust's `ref` would never match). docs-ci writes this model for GitHub; on GitLab `plan` refuses it with the hand-written route.

**On a refusal, stop.** Three setups are refused, each with the change that would make it work: squashing straight into the release branch when every push to it is a release (there is no gap between stamping and release: propose tag releases, a release commit pushed by a release workflow, or an integration branch, and stop until the user picks one), an integration branch squashed or rebased into the release branch (every stamp is rewritten away: the user must change that step to a merge commit or a fast-forward first), and a release commit on a branch that is not the default branch (the `workflow_run` job runs on the default branch, so its token never matches the trust). Show the `reason` and the `remedy`, write nothing and create no trust. Pass every warning on.

## 3. Create the trust

1. **On a GitHub tag release, protect the tags first.** `plan` warns that GitHub has no protected-ref claim and any workflow can declare the `leed-release` environment, so until two settings are in place any user with write access can push a tag and mint a token the trust accepts. Before creating the trust, have the user (a repository administrator) restrict the `leed-release` environment's deployments to the release tags (Settings → Environments → leed-release → Deployment branches and tags → Selected branches and tags, a tag rule for the pattern), and restrict who can create tags matching the pattern with a tag ruleset (Settings → Rules → Rulesets). Wait until they confirm both. On GitLab, the tags must be protected (Settings → Repository → Protected tags), as `plan` warns.
2. **Choose every page type up front.** The trust's page types are the only pages a release can schedule: a page of any other type stamped with a release commit stays where it is, the job stays green, and the page just does not publish with the release. **A trust cannot be widened later**: adding a type means a new trust, a new `audience` in the CI file and revoking the old trust once that change merges (the replace flow in §1). So list the company's page types (`leed settings pagetype list --json --company <companyId>`) and ask which ones a release will ever carry, naming the usual candidates beyond docs: **blog posts or release announcements**, a **changelog or release-notes** type, and **API reference**. When the user is unsure, propose docs plus any blog or changelog type the company has, and include only the types the user confirms; never add one they have not. Keep the chosen types and the reason for each: the stamping rule records them (§5). Then ask the minimum status a page must have reached. Suggest `approved`, so nothing unreviewed is published by a pipeline; `in_revision` or `draft` suit a team whose review happens in code review.
3. Show the command first, as a dry run:

   ```bash
   leed settings oidctrust create --company <companyId> --name "<trustName>" --profile <profile> \
     --issuer <issuer> --identity-label <identityLabel> --claim-constraints '<claimConstraintsJson>' \
     --page-type-ids '["<pageTypeId>", ...]' --minimum-status approved --dry-run --json
   ```

   `claimConstraintsJson` is `plan`'s: the numeric `repository_id` (GitHub) or `project_id` (GitLab), never the path, plus the release `ref` (`refs/heads/main` and the `leed-release` environment on GitHub, `main` and `ref_type: "branch"` on GitLab) or, for a tag release, the deployment `environment` and the tag claims. A repository-only trust is refused by the CMS. Never pin `sub` (see `references/github-workflow.md`). Tell the user what the trust grants: tokens from that pipeline may schedule pages of those types from that status up.
4. Only after the user agrees, run the same command with `--yes` in place of `--dry-run`. Take `data.audience` (`leed-cms:<trustId>`) and `data.trustId` from the output. The audience is not a secret: it is committed in the CI file.

A `permission_denied` from a 402 here means the plan does not include it; a refusal naming page types means the user cannot publish those types themselves. Report either and stop. For any other refusal, read `references/troubleshooting.md`, which starts with the GitHub repository-age cause (the `sub` format change), before changing the command.

## 4. Write the CI job

Read the reference for the forge: `references/github-workflow.md`, `references/gitlab-component.md` or `references/gitlab-self-managed.md`. Ask whether the user wants a fixed publish time (usually not) and the manual re-run job Leed uses itself (`--manual`, for re-running a release's docs by hand with `since` and `dry-run` from pipeline variables). Then preview, and write:

```bash
node "<skill dir>/scripts/docs-ci.mjs" write --root <repo> --forge <forge> <the same branch model flags as plan> \
  --audience <audience> [--stage <stage>] [--manual] [--file <ci file>] --dry-run
node "<skill dir>/scripts/docs-ci.mjs" write --root <repo> --forge <forge> <the same branch model flags as plan> \
  --audience <audience> [--stage <stage>] [--manual] [--file <ci file>]
```

**On self-managed GitLab**, `write` includes the component's template by its public URL, pinned to the `1.1.0` tag (never a branch) and checked with `integrity`, with the same inputs and rules as on gitlab.com (`references/gitlab-self-managed.md`). Before writing, confirm with the user:

- **The instance reaches gitlab.com over HTTPS when it builds the pipeline.** It fetches the template then, on every pipeline.
- **The instance runs GitLab 17.9 or later**, which `integrity` needs. On an older instance, pass `--no-integrity` and tell the user that the pin is then only the tag.
- **An instance that cannot reach gitlab.com** mirrors the `leed-ai-oss/schedule-release` project onto itself, with its tags, and passes the mirrored component as `--mirror <host>/<path>/schedule@1.1.0`.

Show the user `added` from the dry run before writing. On GitLab pass `--file <ci_config_path>` when the project names one. `write` only adds lines: the customer's existing jobs keep every byte. Its other answers:

- `already-set-up`: the job is there already (step 1). Nothing was written.
- `refused`: a stage the pipeline does not have (ask which stage and run again with `--stage`), a job name already in use, or an existing workflow file of that name (`--file`). Nothing was written.
- `needs-manual-merge`: the file's `include:` is not a block list. Show both snippets (`include` and `jobs`) and let the user merge them. Nothing was written.

**The first job written is a dry run** (`dry-run: "true"`): its first runs report what they would schedule and change nothing.

## 5. Write the stamping rule

Read `references/stamping-rule.md` and add its section to the repository's `CLAUDE.md`, or to `AGENTS.md` when that is the file the repository uses, at the end, with the stamp branch from `plan`, the trust's page types (and why each was chosen) and its minimum status filled in. When neither file exists, create `CLAUDE.md` only after the user agrees. When the section's heading is already there, change nothing.

## 6. Verify

Check the trust and the stamps against a real page before the first release, with the CMS MCP tool `schedule_pages_by_source_id` (connected by `leed mcp add --cms` during `/leed:setup`) as a dry run: `confirm: false`, `sourceIds` holding one stamped page's commit, the trust's `minimumStatus`, and a `publishedAt` in the future. It changes nothing; the page must be listed under matched. If no page is stamped yet, say how to stamp the first one: after the next merge to the stamp branch, edit or stamp a page with that branch's commit as the stamping rule says (`leed page stamp <pageId> --source-id <commit>` for a page that is already current).

## 7. The first pipeline

Tell the user what the first release's job will show (the reference's "Reading the first run"): `matched` pages, the ones that would be scheduled, a `✗` line with a reason for each that would not, and unmatched commits, which are normal. Once a dry run lists the right pages, they change `dry-run: "true"` to `"false"` and merge it; from then on every release schedules its docs. When the first run fails with `401 OIDC token rejected`, work through `references/troubleshooting.md`: it leads with the GitHub repository-age cause, then gives a step that decodes the token's payload and prints the named claims only (never the token), to compare with the trust.

## If Cloudflare blocks a request

Cloudflare's firewall sits in front of the Leed CMS and now and then mistakes legitimate content for an attack. When it does, the request never reaches Leed.

1. **Recognize it.** The CLI fails with `request_blocked` (exit `5`). An MCP tool call, or any other request to the CMS, comes back with a 403 and an HTML page ("Just a moment…" or "Attention Required"), `server: cloudflare` or a `cf-ray` value, and no JSON error. It is not a permissions problem: do not ask for a different role or sign in again.
2. **Stop.** Retry the same write at most once. Never alter, encode, split or obfuscate the user's content to get past the filter: the content is theirs, and the false positive is Leed's to fix.
3. **Report it.** From the CLI, run the `leed feedback blocked` command in the error's `hint`; it carries the ray id, method, path and time (add `--excerpt-base64` from `error.request` when it is there). From MCP, call `report_blocked_request` with the `rayId`, the time as `occurredAt`, the method and path if you know them, the tool name and its argument names written as `name=` with no value as `command` (for example `update_page_body pageId= ops=`), and at most 2 KB of the body base64-encoded as `excerptBase64`. Never put the blocked text itself in `command` or `note`: the report crosses the same firewall.
4. **Tell the user.** Say what was blocked (which page, setting or asset, and which command or tool) and give the ray id, then continue with the rest of the work.

## Final report

Report: the trust (name, id, audience, page types, minimum status, and whether it was created or already there), the CI file written (or found), the stamp branch and the release trigger, the stamping-rule file, the verify result, and what is still the user's to do: review and merge the CI and instruction changes, the tag protection `plan` warned about, if it is not done yet, and set `dry-run` to `"false"` after a good dry run.
