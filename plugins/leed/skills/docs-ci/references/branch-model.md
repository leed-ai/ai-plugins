# The branch model

**A stamp must survive and must still be unreleased when it is written.**

A docs page is stamped with a commit (its `sourceId`), and the release job schedules every page whose stamp is one of the commits the release brings in. Two things break that. A commit that is squashed, rebased or amended away later never matches, because the release contains a different commit. And a commit whose release job has already run is never scheduled: the job looks at the commits of its own release, once. So the stamp branch is the branch feature work merges into, and the release has to come later: on another branch that the stamp branch reaches without rewriting, or on a tag.

## The table

`scripts/docs-ci.mjs plan` applies it. Each row names the flags that describe it.

| Setup | Flags | Stamp with | Release trigger | Trust pins |
|---|---|---|---|---|
| Squash (or merge) into `develop`/`staging`, merge (no squash) to `main` | `--merge-into develop --release-branch main --promote merge` (or `ff`) | the squash commit on the integration branch | push to `main` (`before..HEAD`) | GitHub: `ref`: `refs/heads/main` and `environment`: `leed-release`. GitLab: `ref`: `main` and `ref_type`: `branch` |
| Squash straight into `main`, release by tag | `--merge-into main --release-branch main --release-tag 'v*'` | the commit on `main` | tag push (previous tag..tag) | `environment`: `leed-release`, plus `ref_type`: `tag` (and on GitLab `ref_protected`: `"true"`) |
| Squash into `main`, release by dispatch or a release commit | `--merge-into main --release-branch main --release-dispatch --release-workflow 'Release' --release-commit-grep '^chore(release): version packages$' --default-branch main` | the commit on `main` | the release workflow completing (`workflow_run`); the range from the previous release commit to this one, passed as `since`/`until` | `ref`: `refs/heads/main` and `environment`: `leed-release` (GitHub only) |
| Squash into `main`, deploy on every push | `--merge-into main --release-branch main` | none: there is no gap between stamping and release | refused: propose tag releases, a release commit, or an integration branch, and stop until the user picks one | none |
| Integration branch squashed into `main` at release | `--merge-into develop --release-branch main --promote squash` (or `rebase`) | refused: every stamp is rewritten away | refused: the user must change the merge method first | none |

A tag release can also sit behind an integration branch (`--merge-into develop --release-branch main --release-tag 'v*' --promote merge`): the stamp is the `develop` commit, `develop` reaches `main` by a merge commit, and the tag cut on `main` is the release.

**Why a tag release pins an environment, not a ref.** The trust matches claims exactly, and the tag changes every release, so a `ref` pin would match one release only. The job declares the deployment environment `leed-release` instead, and the trust pins it together with `ref_type: "tag"`, so only a tag pipeline's docs job can use the trust. On GitLab, `ref_protected: "true"` also requires the tag to be protected: protect the release tags (Settings → Repository → Protected tags), or the trust never matches. **On GitHub that is not enough on its own:** GitHub has no protected-ref claim and any workflow can declare the environment, so until both of these are set any user with write access can push a tag and mint a token the trust accepts. Before the trust is created, restrict the `leed-release` environment to the release tags (Settings → Environments → leed-release → Deployment branches and tags → Selected branches and tags, a tag rule for the pattern), and restrict who can create matching tags with a tag ruleset (Settings → Rules → Rulesets, target the pattern, restrict creations).

**Why a GitHub branch release pins an environment too.** Leed's production GitHub trusts pin `repository_id`, the long `ref` and `environment: leed-release`, and the job declares that environment. It carries no protection rules, so the job never waits on an approval: it exists to be a claim, so a workflow that does not declare it cannot use the trust. GitLab sends the short ref, so its branch pin adds `ref_type: "branch"`, which keeps a tag named `main` from matching.

**Squash into `main`, release by a release commit.** Pull requests are squashed into `main`, and a release is a `workflow_dispatch` that pushes a release commit (`chore(release): version packages`). A feature commit on `main` survives and stays unreleased until the next dispatch, so it is the stamp. A dispatch has no previous ref and a squash leaves no merge commit for the action to fall back on, so the range is passed explicitly as `since`/`until`: from the previous release commit (`git log --grep`) to the latest one. docs-ci writes it on GitHub as its own workflow triggered by `workflow_run` when the release workflow completes successfully, so a page never goes live before the version it describes has been released. A `workflow_run` job always runs on the repository's default branch, so its token's `ref` is the default branch's: this row works only when the release branch is the default branch, and `plan` (given `--default-branch`) refuses it otherwise. On GitLab `plan` refuses it: set the job up by hand from `gitlab-component.md`, with a rule on the release commit (`$CI_COMMIT_MESSAGE`) and `since` and `until` set from the previous release commit to this one, or use one of the other rows.

## Reading the repository's merge settings

Read what the forge can tell you, and ask only for the rest. Pass the methods the repository allows as `--allowed` (a comma list of `merge`, `ff`, `squash`, `rebase`), so `plan` can warn when a rewriting method is also allowed for the release step, and refuse when the method the user named is not allowed at all.

**GitHub:** `gh api repos/<owner>/<repo>` returns `id` (the numeric repository id), `default_branch`, and, when the signed-in user can push, `allow_merge_commit` (`merge`), `allow_squash_merge` (`squash`) and `allow_rebase_merge` (`rebase`). A release by `git push origin develop:main` is a fast-forward (`ff`). When the three `allow_*` fields are missing, ask which merge methods the repository uses.

**GitLab:** `glab repo view <path or URL> --output json` returns `id` (the numeric project id), `default_branch`, `ci_config_path`, `merge_method` and `squash_option`:

- `merge_method`: `merge` is `merge`; `ff` is `ff`; `rebase_merge` (merge commit with semi-linear history) rebases the source branch onto the target first, which rewrites the integration branch's commits, so count it as `rebase`.
- `squash_option`: `never` adds nothing; `default_on` and `default_off` let each merge request choose, so add `squash`; `always` forces it, so the only method is `squash`.

## The questions the API cannot answer

1. Which branch does feature work merge into? (`--merge-into`)
2. What is a release: a push to a branch (which one), or a tag (which pattern, cut from which branch)? (`--release-branch`, `--release-tag`)
3. When the two branches differ, how does the integration branch reach the release branch: a merge commit, a fast-forward, a squash or a rebase? (`--promote`)

When `plan` refuses, show the user its `reason` and its `remedy`, and stop: write nothing and create no trust. When it warns, pass the warning on before going further.
