# GitLab.com: the component

On gitlab.com the release job is the published CI/CD component `gitlab.com/leed-ai-oss/schedule-release/schedule@1.1.0`, added to the project's existing `.gitlab-ci.yml` (or the file the project's `ci_config_path` names, passed as `--file`). The component sets `id_tokens: LEED_OIDC_TOKEN: aud:` to the audience and `GIT_DEPTH: 0` itself, so the job has its token and the whole history.

## The trust

- Profile `gitlab`, issuer `https://gitlab.com`, identity label `<group>/<project>`.
- Pin the project by its numeric `project_id`, the `id` from `glab repo view <path> --output json`. Never by path: a path can be renamed and then claimed by someone else, and an id is never re-issued.
- Push release: `--claim-constraints '{"project_id":"<project id>","ref":"main","ref_type":"branch"}'`. GitLab sends the short form of the ref, which a tag named `main` would carry too, so `ref_type: "branch"` is pinned beside it. This is the shape of Leed's own production trust.
- Tag release: `--claim-constraints '{"project_id":"<project id>","environment":"leed-release","ref_type":"tag","ref_protected":"true"}'`, the job declares `environment: name: leed-release`, and the release tags must be protected (Settings → Repository → Protected tags).

`plan --id <project id>` prints these as `claimConstraintsJson`, ready to pass.

## What `write` adds

`write` never re-serializes the file. It adds whole lines, and every existing line keeps its bytes and its order:

- When the file has a block-list `include:`, the component item goes after its last item, at the same indentation. When it has no `include:`, one is added at the end. When its `include:` is a single string, a mapping or a flow list (`include: 'ci/main.yml'`, `include: [ … ]`), `write` changes nothing and answers `needs-manual-merge` with both snippets: show them to the user and let them merge the include item by hand.
- The jobs' `rules:` are added at the end of the file, by declaring each job again by name. GitLab merges that into the component's job, which is how Leed's own pipeline gives its docs job rules.

```yaml
include:
  # Leed continuous documentation (schedule-release 1.1.0), set up by /leed:docs-ci.
  - component: gitlab.com/leed-ai-oss/schedule-release/schedule@1.1.0
    inputs:
      job-name: leed-docs-release
      stage: deploy
      audience: leed-cms:<trust id>
      dry-run: "true"

leed-docs-release:
  rules:
    - if: '$CI_COMMIT_BRANCH == "main" && $CI_PIPELINE_SOURCE == "push"'
```

- A tag release adds `tag-pattern` to the inputs, `environment: name: leed-release` to the job, and the rule `$CI_COMMIT_TAG =~ /^v.*$/ && $CI_PIPELINE_SOURCE == "push"` (the tag pattern as an anchored regex).
- `--stage` picks the stage, `deploy` by default. When the file declares `stages:` and the stage is not in it (or, with no `stages:`, it is not one of GitLab's defaults), `write` refuses with the list: ask the user which stage the docs job belongs in, usually the last deploy or release stage, and run it again with `--stage`. docs-ci never edits `stages:`.
- `publish-at` is left out unless the user asked for a fixed time (`--publish-at`). Left out, the pages publish 15 minutes after the job starts.
- `--manual` adds Leed's own re-run job: a second component item, `job-name: leed-docs-release-manual`, with `since: $DOCS_SINCE` and `dry-run: $DOCS_DRY_RUN`, and its rule `$CI_PIPELINE_SOURCE == "web" && $DOCS_SINCE` on the release ref, with `needs: []`. Run it from Build → Pipelines → Run pipeline on the release branch (or a release tag), with `DOCS_SINCE` set to the commit the release starts after. It is a dry run unless `DOCS_DRY_RUN` is set to `"false"` as well.
- A job name docs-ci uses that the file already has for something else is refused. A top-level `workflow:` adds a warning: its rules must still create the release pipeline, or the docs job never runs.

If the docs should wait for the project's own deploy, add `needs: [<deploy job>]` to the `leed-docs-release:` block, as Leed's own pipeline does.

## Reading the first run

The first runs are dry runs. The job log says:

- `Dry run: N page(s) matched, M would be scheduled, K would fail.` `matched` is pages whose `sourceId` is one of the release's commits; `would be scheduled` is the matched pages that clear the trust's page types and status floor.
- Each `✗` line is a matched page that would not be scheduled, with the reason.
- `source id(s) matched no page`: commits no page is stamped with. That is normal: most commits change code, not docs.

Once a dry run lists the right pages, change `dry-run: "true"` to `"false"` in the `leed-docs-release` item and merge it through the project's normal review. From then on every release schedules its docs.

A 401 means the token's claims do not match the trust: work through `troubleshooting.md`, which decodes the claims to compare (check the audience, and that the pipeline ran on the pinned ref or environment). A 402 means the company's plan does not include scheduling by source.
