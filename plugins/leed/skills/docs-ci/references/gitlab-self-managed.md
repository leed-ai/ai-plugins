# Self-managed GitLab: the template from gitlab.com

A self-managed GitLab instance cannot include a component from gitlab.com, so `write` includes the component's own template by its public URL instead, with GitLab's `include:remote`. The template is the published one, served from the `leed-ai-oss/schedule-release` project at the `1.1.0` tag, and it is never copied into the project or into this skill: the job always runs what the component publishes. Pin it to the tag, never a branch.

- **The instance must reach gitlab.com over HTTPS when it builds the pipeline.** It fetches the template then, on every pipeline; the URL is public and needs no sign-in.
- **`integrity` needs GitLab 17.9 or later.** It is the Base64 SHA-256 of the file at that tag, and GitLab fails the pipeline when the file it fetched does not match, so the pin holds even if the tag were moved. On an older instance, `integrity` is rejected: pass `--no-integrity` to `write`, and tell the user that the pin is then only the tag.
- **An instance that cannot reach gitlab.com** mirrors the `leed-ai-oss/schedule-release` project onto itself, with its tags, and passes the mirrored component as `--mirror <host>/<path>/schedule@1.1.0`. `write` then adds the include and the rules exactly as on gitlab.com (`gitlab-component.md`).

## The trust

- Profile `gitlab`, identity label `<group>/<project>`.
- The issuer is the instance's own URL, `https://<host>`, as `classify` derives it from the remote. For an instance served under a path, pass the real URL with `classify --issuer`. It must be a public HTTPS host: Leed fetches the instance's OIDC discovery document (`<issuer>/.well-known/openid-configuration`) when the trust is created, and an instance that only resolves inside a private network cannot be registered.
- Pin by the numeric `project_id` (the `id` from `glab repo view <URL> --output json`), with the same `ref` or `environment` pin as on gitlab.com: `{"project_id":"<project id>","ref":"main","ref_type":"branch"}`, or for a tag release `{"project_id":"<project id>","environment":"leed-release","ref_type":"tag","ref_protected":"true"}`.

## What `write` adds

The same lines as on gitlab.com (`gitlab-component.md`), with the include item naming the template by URL in place of the component. It never re-serializes the file: the item goes after the last item of a block-list `include:` (or a new `include:` at the end), and the jobs' `rules:` at the end.

```yaml
include:
  # Leed continuous documentation (schedule-release 1.1.0), set up by /leed:docs-ci.
  - remote: "https://gitlab.com/leed-ai-oss/schedule-release/-/raw/1.1.0/templates/schedule.yml"
    integrity: "sha256-cTmr5Kl/wlu8W5UgBJwc+wmOJvsVjY6ONgJjqu7O7ng="
    inputs:
      job-name: leed-docs-release
      stage: deploy
      audience: leed-cms:<trust id>
      dry-run: "true"

leed-docs-release:
  rules:
    - if: '$CI_COMMIT_BRANCH == "main" && $CI_PIPELINE_SOURCE == "push"'
```

- The template sets `id_tokens: LEED_OIDC_TOKEN: aud:` to the audience, so GitLab mints the token for it, and `GIT_DEPTH: 0`, so the job has the whole history. The audience is not a secret and is committed.
- A tag release adds `tag-pattern` to the inputs, `environment: name: leed-release` to the job and the tag rule, as on gitlab.com. Protected environments are a paid GitLab feature, so on GitLab Free the pin's strength comes from `ref_protected: "true"` and protected release tags.
- `--manual` adds a second include of the same URL with `job-name: leed-docs-release-manual`, `since: $DOCS_SINCE` and `dry-run: $DOCS_DRY_RUN`, and the web-pipeline rule, as on gitlab.com. GitLab includes one file more than once when the inputs differ.
- The stage, job-name and `workflow:` checks are the same as on gitlab.com. The job's image needs internet access to install `bash`, `curl`, `jq` and `git`, and the runner must reach the Leed CMS.
- `find` recognizes this include, the gitlab.com component and a `--mirror` include, so a re-run reports the setup and changes nothing.

## Reading the first run

The log reads as on gitlab.com: `matched`, `would be scheduled`, `✗` lines with reasons, and unmatched commits, which are normal. Once a dry run lists the right pages, change `dry-run: "true"` to `"false"` in the `leed-docs-release` item and merge it through the project's normal review.

When the pipeline will not start, read its error: a `remote` include the instance could not fetch means it cannot reach gitlab.com (mirror the project and use `--mirror`); an unknown `integrity` keyword means the instance is older than 17.9 (delete the `integrity:` lines, and tell the user that the pin is then only the tag); an integrity mismatch means the file served at the tag is not the published 1.1.0 template, and the pipeline must not run it.
