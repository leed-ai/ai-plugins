# Troubleshooting a failing trust

A trust fails in one of two places: Leed refuses to register it (`leed settings oidctrust create`), or it registers and the first pipeline run gets `401 OIDC token rejected`. On GitHub, check the repository's age first: it is the most likely cause, and it is the one nothing else in the setup reveals.

## First: a GitHub repository created, renamed or transferred after July 15, 2026

GitHub changed the default `sub` claim for repositories created, renamed or transferred after July 15, 2026 to an immutable form, `repo:<owner>@<owner id>/<repo>@<repo id>:ref:refs/heads/main`. Older repositories keep `repo:<owner>/<repo>:ref:…` unless the organization or the repository opts in, and GitHub Enterprise Server is unchanged. So two repositories in the same organization can send `sub` in different formats, and a repository that is renamed or transferred switches format.

The github profile docs-ci uses never depends on `sub`: it pins the discrete claims `repository_id`, `ref` and `environment`, which are the same in both formats. The repository's age breaks a trust only when something pinned `sub`.

**Check the repository's history.** Run `gh api repos/<owner>/<repo>` and read `created_at`; ask the user whether the repository was ever renamed or transferred (the API does not say). Then read the repository's `sub` customization:

```bash
gh api repos/<owner>/<repo>/actions/oidc/customization/sub
```

Report which `sub` format the repository gets (the new one when it was created, renamed or transferred after July 15, 2026, the old one otherwise; a customization with `use_default: false` replaces either with its own claim keys), and whether any of the trust's constraints depends on it. When none does, the repository's age is not the cause: go on to the causes below.

### Registration refused

Registration never reads a CI token: Leed checks the trust's shape and runs OIDC discovery against the issuer, nothing more. So with the github profile (`repository_id` plus `ref` or `environment`), the repository's age cannot make registration fail. When it is refused, look at how the trust was described:

- Someone (the user, or an older guide) tried to pin `sub` through the custom profile, or copied a `sub` value from another repository. That value does not match this repository's format, or it bakes in a name a rename changes. **The fix is the github profile's discrete claims, never `sub`:** run `plan` again and pass its `claimConstraintsJson` (`repository_id`, `ref`, `environment`) unchanged.
- A repository-only trust (no `ref`, `environment` or tag claims) is refused by design: pin the release ref or environment as `plan` does.
- A refusal naming page types means the person creating the trust cannot publish those types themselves; one naming the plan means the company is below Growth.

### The first run gets `401 OIDC token rejected`

The 401 body says only `OIDC token rejected`, by design: it never says which check failed, so a token sent to the wrong place learns nothing. To find out, have the user add a temporary diagnostic step to the docs job that decodes the token's **payload** and prints named claims only, then compare each one with the trust (`leed settings oidctrust list --json --company <companyId>`: its `issuer`, `audience` and `claimConstraints`).

**Never print the token itself, or its signature.** A job log is readable by everyone with access to the repository, and a printed token is a credential until it expires. The steps below keep only the middle (payload) segment, print only the claims listed, and never trace the shell. Remove the step once the cause is found.

GitHub (a step in the docs job, which already has `id-token: write`; the audience is the trust's):

```yaml
      - name: Show the OIDC claims Leed compares (payload only)
        env:
          LEED_AUDIENCE: leed-cms:<trustId>
        run: |
          payload=$(curl -sS -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=$LEED_AUDIENCE" | jq -r '.value' | cut -d. -f2 | tr '_-' '/+')
          while [ $(( ${#payload} % 4 )) -ne 0 ]; do payload="$payload="; done
          printf '%s' "$payload" | base64 -d | jq '{iss, aud, sub, repository_id, ref, ref_type, environment}'
```

GitLab (a temporary job in the same stage, with the same `rules:` and `environment:` as the docs job, so its token carries the same claims):

```yaml
leed-docs-claims:
  stage: deploy
  image: alpine:3.20
  id_tokens:
    LEED_ID_JWT:
      aud: leed-cms:<trustId>
  script:
    - apk add --no-cache jq >/dev/null
    - payload=$(printf '%s' "$LEED_ID_JWT" | cut -d. -f2 | tr '_-' '/+')
    - while [ $(( ${#payload} % 4 )) -ne 0 ]; do payload="$payload="; done
    - printf '%s' "$payload" | base64 -d | jq '{iss, aud, sub, project_id, ref, ref_type, ref_protected, environment}'
```

The claims to compare: `iss`, `aud`, `sub`, `repository_id`, `ref`, `ref_type` and `environment` on GitHub; `iss`, `aud`, `sub`, `project_id`, `ref`, `ref_type` (and `ref_protected` for a tag trust) and `environment` on GitLab.

**Compare each value exactly**, as Leed does:

- `ref` is the long form on GitHub (`refs/heads/main`, `refs/tags/v1.2.0`) and the short form on GitLab (`main`, `v1.2.0`). A trust holding the other form never matches.
- A job without `environment:` has no `environment` claim, so a trust that pins `environment` rejects it. The docs job docs-ci writes declares `environment: leed-release`; a job copied without it does not.
- `repository_id` and `project_id` are numbers sent as strings; the trust holds the same digits.
- `aud` must be the trust's audience exactly, and `iss` the trust's issuer (on self-managed GitLab, including any path, exactly as registered).

Then compare `sub` with the repository-age check above: when a constraint depends on `sub`, that is the cause, and the fix is a new trust on the discrete claims (the replace flow in SKILL.md §1).

## Other causes, after the repository's age

- **The wrong audience.** The audience is `leed-cms:<trustId>` from the create output (`data.audience`), and nothing else. A re-created trust has a new one: when a trust was replaced, the CI file must carry the new audience, and the old one stops matching once the old trust is revoked.
- **A revoked trust.** `leed settings oidctrust list` shows `active: false`. A revoked trust cannot be restored: create a new one and put its audience into the CI file.
- **A mistyped numeric id.** `repository_id` or `project_id` in the trust is not this repository's (`gh api repos/<owner>/<repo>` `id`, or `glab repo view` `id`): a digit off, or another repository's id. Compare it with the decoded claim.
- **A run on a ref or environment the trust does not pin.** A `workflow_dispatch` started from another branch sends that branch's `ref`; a manual re-run from a feature branch does the same. A tag pipeline against a branch-pinned GitLab trust (`ref_type: branch`) sends `ref_type: tag` and the tag's name, and a branch pipeline against a tag trust the reverse. On GitHub, a `workflow_run` job always runs on the default branch, so its `ref` is the default branch's, whatever branch the release ran on.
- **A `403`, not a 401.** The token was accepted and the trust matched; the request asked for more than the trust allows, such as a `minimum-status` input below the trust's floor. Use the trust's own minimum status, or leave the input empty. A page of a type outside the trust is not an error at all: it is a `✗` line in the job log, and the job stays green.
- **`No OIDC token available`** on GitHub: the workflow is missing `permissions: id-token: write`.
- **A 402**: the company's plan does not include scheduling by source (Growth and above).
