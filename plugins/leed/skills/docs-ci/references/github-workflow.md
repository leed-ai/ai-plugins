# GitHub: the workflow

The release job is the published action `leed-ai/schedule-release@v1` (v1 is v1.1.0), in a workflow file of its own, `.github/workflows/leed-docs-release.yml`. A file of its own never changes a byte of the repository's other workflows, and its trigger is the release, which their triggers usually are not. When that file already exists and is not docs-ci's, `write` refuses; pick another name with `--file .github/workflows/<name>.yml`.

## The trust

- Profile `github`, issuer `https://token.actions.githubusercontent.com`, identity label `<owner>/<repo>`.
- Pin the repository by its numeric `repository_id`, from `gh api repos/<owner>/<repo> --jq .id`. Never by path: a path can be renamed and then claimed by someone else, and an id is never re-issued.
- Push release, and release by a release commit: `--claim-constraints '{"repository_id":"<repository id>","ref":"refs/heads/main","environment":"leed-release"}'`, and the jobs declare `environment: leed-release`. GitHub sends the long form of the ref. This is the shape of Leed's production GitHub trusts. The `leed-release` environment carries no protection rules, so the job never waits on an approval: it exists to be a claim. GitHub creates it on the first run if it does not exist.
- Tag release: `--claim-constraints '{"repository_id":"<repository id>","environment":"leed-release","ref_type":"tag"}'`, and the job declares `environment: leed-release`.

`plan --id <repository id>` prints these as `claimConstraintsJson`, ready to pass.

### Tag release: protect the environment and the tags first

GitHub's token has no protected-ref claim, and any workflow in the repository can declare the `leed-release` environment. So with a tag trust, any user with write access could push a tag of their own (`x`) on a commit whose workflow declares the environment, mint a token the trust accepts, and schedule pages of the trusted types early. Before the trust is created, a repository administrator sets both of these:

1. **The environment's deployment rule:** Settings → Environments → leed-release → Deployment branches and tags → Selected branches and tags, with a tag rule for the release pattern (`v*`). A job on any other ref then cannot use the environment.
2. **A tag ruleset:** Settings → Rules → Rulesets → New tag ruleset, targeting the release pattern, with "Restrict creations" on and only the people or app that cut releases on the bypass list. Then only they can create a tag the environment accepts.

`plan` warns about this for every GitHub tag release; the skill waits for the user to confirm both before creating the trust.

### Never pin `sub`

The custom `github` profile pins the discrete `repository_id`, `ref` and `environment` claims. **Never pin `sub`.** Its format depends on the repository: GitHub changed the default `sub` for repositories created, renamed or transferred after July 15, 2026 to an immutable form, `repo:<owner>@<owner id>/<repo>@<repo id>:ref:refs/heads/main`, while older repositories keep `repo:<owner>/<repo>:ref:…` unless the organization or the repository opts in, and GitHub Enterprise Server is unchanged. A trust pinned on `sub` works today and breaks on a rename or transfer. The discrete claims are the same in both formats: a repository created before that date (the old format) and one created after it (the new format) take the same constraint shape, and Leed runs both in production.

You may tell the user the repository's `created_at` (from `gh api repos/<owner>/<repo>`) and which `sub` format it gets, for their information, and that it does not matter for the trust. If a user insists on pinning `sub`, read its current format first (`gh api repos/<owner>/<repo>/actions/oidc/customization/sub`, and the repository's `created_at`) and warn that a rename or transfer changes it.

## What `write` adds

```yaml
# Leed continuous documentation (schedule-release v1)
name: Leed docs release

on:
  push:
    branches:
      - "main"            # or tags: - "v*" for a tag release

permissions:
  id-token: write         # mints the OIDC token
  contents: read          # declaring id-token drops every other permission

jobs:
  schedule-docs:
    runs-on: ubuntu-latest
    environment: leed-release  # the claim the trust pins
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # the action reads the release's commits with git log
          persist-credentials: false  # the job never pushes
      - uses: leed-ai/schedule-release@v1
        with:
          audience: leed-cms:<trust id>
          dry-run: "true"
```

- `audience` is the trust's, from `oidctrust create`. It is not a secret and is committed.
- `publish-at` is left out unless the user asked for a fixed time (`--publish-at`). Left out, the pages publish 15 minutes after the job starts, which leaves room for the whole release to be scheduled first.
- A tag release adds `tag-pattern` (the release tag pattern) to the action, so a tag between two releases that does not match is skipped when the action looks for the previous release.
- A release by a release commit (`--release-dispatch`) triggers on `workflow_run` of the release workflow (`--release-workflow`, its `name:`) on the release branch, and runs only when that run succeeded, so the docs never go live before the release. A step finds the last two commits matching `--release-commit-grep` with `git log --grep` (the pattern reaches the shell through `env:`, never inside the script) and passes them to the action as `since` and `until`. With no earlier release commit, the step fails with a message: run the manual job once with `since`. A `workflow_run` job always runs on the repository's default branch, whatever branch the release workflow ran on, so its token's `ref` is `refs/heads/<default branch>`: `plan` takes `--default-branch` and refuses this model when the release branch is not the default branch. The job's `if:` also skips a run started by a pull request or from a fork, so a fork branch named like the release branch never gets an `id-token: write` job.
- `--manual` adds a `workflow_dispatch` trigger with the inputs `since` and `dry-run` (default `"true"`) and a second job, `schedule-docs-manual`, that runs only on a dispatch: Actions → Leed docs release → Run workflow, with `since` set to the commit the release starts after. Run it from the release branch with a branch trust, and from a release tag with a tag trust: the trust matches no other ref. The release job only runs on the release, so its `dry-run` stays `"true"` until the user changes it.

The action's other inputs (`since`, `merge-commit`, `source-ids`, `until`, `minimum-status`, `leed-url`, `fail-on-unmatched`) are left at their defaults: on a push the range is the push's own `before..HEAD`, and on a tag the previous matching tag to this one. `minimum-status` can only narrow the trust's own floor.

`leed-ai/schedule-release@v1` and `actions/checkout@v4` are tags, which can move. A customer who wants the job holding `id-token: write` to run only code they have reviewed can pin each to a commit SHA (the SHA of `v1.1.0` for the action), at the cost of updating it by hand.

## Reading the first run

The first runs are dry runs. The job log and the action's outputs say:

- `matched`: pages whose `sourceId` is one of the release's commits.
- `would-schedule`: the matched pages that clear the trust's page types and status floor. On a run with `dry-run: "false"`, `scheduled` is how many were scheduled.
- `unmatched-source-ids`: commits no page is stamped with. That is normal: most commits change code, not docs.
- Each `✗` line is a matched page that would not be scheduled, with the reason (a page type outside the trust, a status below the floor, a missing required field).

Once a dry run lists the right pages under matched and would-schedule, change `dry-run: "true"` to `"false"` in the push job and commit it through the repository's normal review. From then on every release schedules its docs.

If the job fails with "No OIDC token available", the workflow is missing `permissions: id-token: write`. A 401 means the token's claims do not match the trust: work through `troubleshooting.md`, which starts with the repository's age and decodes the claims to compare.
