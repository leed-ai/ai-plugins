/**
 * The branch model: which branch a docs edit is stamped from, what triggers the release job, and what the trust pins.
 *
 * The rule behind it: a stamp must survive and must still be unreleased when it is written. A commit that a later
 * squash or rebase rewrites never matches a release's commits, and a commit whose release job has already run is
 * never scheduled. So the stamp branch is the branch feature work merges into, and the release has to happen later,
 * on a different branch reached by a merge commit or a fast-forward, or by a tag.
 */

/**
 * The deployment environment the docs job declares. On a tag release it is the only stable thing to pin, since the
 * tag changes every release; on a GitHub branch release it is pinned next to the ref, as Leed's production trusts do.
 * It carries no protection rules, so the job never waits on an approval: it exists to be a claim.
 */
export const DOCS_ENVIRONMENT = "leed-release";

/** How work reaches the release branch from the stamp branch. Only these two keep every commit. */
const KEEPS_COMMITS = new Set(["merge", "ff"]);
const PROMOTE_METHODS = new Set(["merge", "ff", "squash", "rebase"]);

const REFUSAL_NO_GAP = {
  row: "squash-into-release-branch-deploy-every-push",
  reason:
    "Feature work merges straight into the release branch and every push to it is a release, so there is no gap between stamping and release: by the time an agent stamps a docs edit with the merge commit, that commit's release job has already run, and the page is never scheduled.",
  remedy:
    "Pick one: release by tag (stamp with the commit on the branch, and the tag push is the release); release by a release workflow that pushes a release commit (on GitHub, --release-dispatch with --release-workflow and --release-commit-grep); or merge feature work into an integration branch such as develop or staging first and release by merging it into the release branch without squashing. Then run docs-ci again.",
};

const REFUSAL_DISPATCH_GITLAB = {
  row: "squash-into-release-branch-release-commit",
  reason:
    "docs-ci writes the release-commit model (a release workflow that pushes a release commit, with the range passed as since/until) for GitHub Actions only.",
  remedy:
    'On GitLab, release by tag or through an integration branch, which docs-ci writes, or set the job up by hand from references/branch-model.md ("Squash into main, release by a release commit"), passing since and until from the previous release commit to this one. Then run docs-ci again.',
};

/** `workflow_run` always runs on the default branch, so the token's `ref` is the default branch's, whatever the release branch. */
const REFUSAL_DISPATCH_NOT_DEFAULT = (releaseBranch, defaultBranch) => ({
  row: "release-commit-not-on-default-branch",
  reason: `A job triggered by workflow_run always runs on the repository's default branch (${defaultBranch}), so its OIDC token carries ref refs/heads/${defaultBranch} and its checkout reads ${defaultBranch}'s tip. A trust pinned to refs/heads/${releaseBranch} never matches it, and every release would fail with 401 OIDC token rejected.`,
  remedy: `Make ${releaseBranch} the repository's default branch, or release by tag (--release-tag) or through an integration branch (--promote), which run on the release ref itself. Then run docs-ci again.`,
});

/** The warning a GitHub tag release must act on before the trust is created. */
const GITHUB_TAG_WARNING = (pattern) =>
  `GitHub has no protected-ref claim, and any workflow can declare the ${DOCS_ENVIRONMENT} environment, so without two settings any user with write access can push a tag and mint a token this trust accepts. Before the trust is created: (1) restrict the ${DOCS_ENVIRONMENT} environment's deployments to the release tags (Settings → Environments → ${DOCS_ENVIRONMENT} → Deployment branches and tags → Selected branches and tags, a tag rule for ${pattern}); (2) restrict who can create tags matching ${pattern} with a tag ruleset (Settings → Rules → Rulesets, target tags ${pattern}, restrict creations, bypass only for the people or app that cut releases).`;

const REFUSAL_REWRITTEN = {
  row: "integration-branch-squashed-into-release",
  reason:
    "The integration branch reaches the release branch by a squash or a rebase, which rewrites every commit on the way. A docs page stamped with an integration-branch commit names a commit the release never contains, so it never matches.",
  remedy:
    "Change the merge method for the integration-to-release step to a merge commit (no squash) or a fast-forward, in the repository's merge settings, and never squash that merge request or pull request. Then run docs-ci again.",
};

/**
 * Plan the setup from the user's answers.
 *
 * - `mergeInto`: the branch feature work merges into.
 * - `releaseBranch`: the branch whose push is the release, or the branch release tags are cut from.
 * - `releaseTag`: the release tag pattern (`v*`), when a tag push is the release.
 * - `promote`: how `mergeInto` reaches `releaseBranch` when they differ (`merge`, `ff`, `squash` or `rebase`).
 * - `allowed`: the merge methods the repository allows, when known, for the warnings.
 * - `releaseDispatch`: the release is a workflow (named `releaseWorkflow`) that pushes a release commit to the
 *   release branch, matched by `releaseCommitGrep`; the docs job runs when that workflow completes, with the range
 *   from the previous release commit to the latest one passed as `since`/`until`. It needs `defaultBranch`, the
 *   repository's default branch, since a `workflow_run` job runs there and nowhere else.
 * - `forge`: `github`, `gitlab.com` or `gitlab-self-managed`, which decides the claim names and the ref form.
 * - `id`: the numeric repository or project id, put into the claim constraints when given.
 */
export function plan({
  forge,
  mergeInto,
  releaseBranch,
  releaseTag,
  promote,
  allowed = [],
  id,
  releaseDispatch = false,
  releaseWorkflow,
  releaseCommitGrep,
  defaultBranch,
}) {
  const github = forge === "github";
  const warnings = [];
  const sameBranch = mergeInto === releaseBranch;
  if (releaseDispatch) {
    if (!sameBranch || releaseTag || promote) {
      return usage(
        "--release-dispatch is the squash-into-the-release-branch model: --merge-into and --release-branch must be the same branch, with no --release-tag or --promote",
      );
    }
    if (!releaseWorkflow || !releaseCommitGrep) {
      return usage(
        "--release-dispatch needs --release-workflow (the release workflow's name) and --release-commit-grep (a git log --grep pattern matching the release commit)",
      );
    }
    if (!github) return refused(REFUSAL_DISPATCH_GITLAB);
    if (!defaultBranch) {
      return usage(
        "--release-dispatch needs --default-branch (the repository's default_branch): a workflow_run job runs on the default branch only",
      );
    }
    if (defaultBranch !== releaseBranch) return refused(REFUSAL_DISPATCH_NOT_DEFAULT(releaseBranch, defaultBranch));
  } else if (releaseWorkflow || releaseCommitGrep || defaultBranch) {
    return usage("--release-workflow, --release-commit-grep and --default-branch go with --release-dispatch");
  }
  if (sameBranch && !releaseTag && !releaseDispatch) return refused(REFUSAL_NO_GAP);
  if (!sameBranch) {
    if (!promote || !PROMOTE_METHODS.has(promote)) {
      return usage(`--promote is required when --merge-into and --release-branch differ: merge, ff, squash or rebase`);
    }
    if (!KEEPS_COMMITS.has(promote)) return refused(REFUSAL_REWRITTEN);
    if (allowed.length > 0 && !allowed.includes(promote)) {
      const keeping = allowed.filter((method) => KEEPS_COMMITS.has(method));
      if (keeping.length > 0) {
        return usage(
          `The repository does not allow ${methodName(promote)} merges, but it allows ${keeping.map(methodName).join(" and ")}, which also keeps every stamp: run plan again with --promote ${keeping[0]} if that is how ${mergeInto} reaches ${releaseBranch}.`,
        );
      }
      return refused({
        ...REFUSAL_REWRITTEN,
        reason: `The repository does not allow ${methodName(promote)} merges, so the integration branch can only reach ${releaseBranch} by ${allowed.map(methodName).join(" or ")}, which rewrites every stamp.`,
      });
    }
    const rewriting = allowed.filter((method) => method === "squash" || method === "rebase");
    if (rewriting.length > 0) {
      warnings.push(
        `The repository also allows ${rewriting.join(" and ")} merges. The ${mergeInto} → ${releaseBranch} merge must always be a ${promote === "ff" ? "fast-forward" : "merge commit"}: one ${rewriting.join(" or ")} rewrites every stamp since the last release. Tell the user, and suggest turning ${rewriting.join(" and ")} off for that step if the forge allows it.`,
      );
    }
    if (promote === "ff") {
      warnings.push(
        `A fast-forward keeps the stamps only while ${releaseBranch} has no commits of its own. If the forge offers to rebase ${mergeInto} first, merge with a merge commit instead.`,
      );
    }
  }

  const idClaim = github ? "repository_id" : "project_id";
  const idValue = id ?? (github ? "<repository id>" : "<project id>");
  let pin;
  let trigger;
  if (releaseTag) {
    trigger = { kind: "tag", pattern: releaseTag, branch: releaseBranch };
    const extra = github ? { ref_type: "tag" } : { ref_type: "tag", ref_protected: "true" };
    pin = { environment: DOCS_ENVIRONMENT, ...extra };
    warnings.push(
      github
        ? GITHUB_TAG_WARNING(releaseTag)
        : `GitLab sets ref_protected to "true" only for a protected tag: protect the release tags (${releaseTag}) in Settings → Repository → Protected tags, or the trust never matches.`,
    );
  } else {
    trigger = releaseDispatch
      ? { kind: "release-commit", branch: releaseBranch, workflow: releaseWorkflow, grep: releaseCommitGrep }
      : { kind: "push", branch: releaseBranch };
    // GitHub sends the long ref and gets the environment beside it; GitLab sends the short ref, so ref_type keeps a
    // tag with the branch's name from matching.
    pin = github
      ? { ref: `refs/heads/${releaseBranch}`, environment: DOCS_ENVIRONMENT }
      : { ref: releaseBranch, ref_type: "branch" };
  }
  const claimConstraints = { [idClaim]: idValue, ...pin };
  return {
    ok: true,
    stampBranch: mergeInto,
    trigger,
    pin,
    claimConstraints,
    claimConstraintsJson: JSON.stringify(claimConstraints),
    warnings,
  };
}

function methodName(method) {
  return { merge: "merge-commit", ff: "fast-forward", squash: "squash", rebase: "rebase" }[method];
}

function refused(refusal) {
  return { ok: false, refusal };
}

function usage(error) {
  return { ok: false, usage: error };
}
