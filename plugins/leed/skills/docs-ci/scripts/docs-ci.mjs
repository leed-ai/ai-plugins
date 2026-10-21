#!/usr/bin/env node
/**
 * docs-ci: the deterministic half of /leed:docs-ci. It classifies the repository's forge, applies the branch model,
 * finds an existing setup, and writes the release job into the customer's CI without touching what is there.
 *
 *   node docs-ci.mjs classify --remote <git remote url> [--issuer <url>]
 *   node docs-ci.mjs plan  <branch model flags> [--id <numeric id>]
 *   node docs-ci.mjs find  --root <repo> --forge <forge> [--file <ci file>] [--mirror <component>]
 *   node docs-ci.mjs write --root <repo> <branch model flags> --audience leed-cms:<trust id> [--stage <stage>]
 *                          [--manual] [--publish-at <iso time>] [--file <ci file>] [--mirror <component>]
 *                          [--no-integrity] [--dry-run]
 *
 * Branch model flags: --forge github|gitlab.com|gitlab-self-managed --merge-into <branch> --release-branch <branch>
 * [--release-tag <pattern>] [--promote merge|ff|squash|rebase] [--allowed <comma list of merge,ff,squash,rebase>]
 * [--release-dispatch --release-workflow <workflow name> --release-commit-grep <git log --grep pattern>
 * --default-branch <the repository's default branch>].
 *
 * It makes no network call, follows no symlink, and writes only `write`'s one file inside --root, never with
 * --dry-run. It prints one JSON document. Exit codes: 0 done (written, planned, found or already set up), 1 refused
 * or left for a manual merge, with nothing written, 2 a usage error, with nothing written.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { plan } from "./lib/branch-model.mjs";
import {
  checked,
  fail,
  finish,
  insideRoot,
  onlyFlags,
  parseFlags,
  readIfExists,
  realDir,
  required,
  UsageError,
} from "./lib/common.mjs";
import { classify } from "./lib/forge.mjs";
import { audienceIn, DEFAULT_WORKFLOW, renderWorkflow, usesAction } from "./lib/github.mjs";
import { COMPONENT, componentItems, findIn, JOB, MANUAL_JOB, ruleJobs } from "./lib/gitlab.mjs";
import { collidingJobs, fileWarnings, mergeGitlab, stageProblem, topLevelKeys } from "./lib/merge.mjs";

const FORGES = ["github", "gitlab.com", "gitlab-self-managed"];
const BRANCH = /^(?!-)[A-Za-z0-9._/-]+$/;
const TAG = /^(?!-)[A-Za-z0-9._/*?-]+$/;
const AUDIENCE = /^leed-cms:[A-Za-z0-9-]+$/;
const STAGE = /^[A-Za-z0-9._-]+$/;
const ISO_TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/;
const MIRROR = /^[A-Za-z0-9.-]+(?::\d+)?\/[A-Za-z0-9._/-]+@[A-Za-z0-9._-]+$/;
const WORKFLOW_NAME = /^[A-Za-z0-9 ._()-]+$/;
const COMMIT_GREP = /^[A-Za-z0-9 ^$().*:_/[\]+?-]+$/;
const MODEL_FLAGS = [
  "forge",
  "merge-into",
  "release-branch",
  "release-tag",
  "promote",
  "allowed",
  "release-dispatch",
  "release-workflow",
  "release-commit-grep",
  "default-branch",
];

function forgeOf(flags) {
  const forge = required(flags, "forge");
  if (!FORGES.includes(forge)) throw new UsageError(`--forge must be one of ${FORGES.join(", ")}`);
  return forge;
}

/** The branch model from the flags, through the table in `lib/branch-model.mjs`. */
function modelFrom(flags) {
  const allowed = flags.allowed ? flags.allowed.split(",").map((method) => method.trim()) : [];
  for (const method of allowed) {
    if (!["merge", "ff", "squash", "rebase"].includes(method)) throw new UsageError(`--allowed has ${method}`);
  }
  const result = plan({
    forge: forgeOf(flags),
    mergeInto: checked(required(flags, "merge-into"), BRANCH, "merge-into", "a branch name"),
    releaseBranch: checked(required(flags, "release-branch"), BRANCH, "release-branch", "a branch name"),
    releaseTag: checked(flags["release-tag"], TAG, "release-tag", "a tag pattern such as v*"),
    promote: flags.promote,
    allowed,
    id: checked(flags.id, /^\d+$/, "id", "the numeric repository or project id"),
    releaseDispatch: flags["release-dispatch"] === true,
    releaseWorkflow: checked(
      flags["release-workflow"],
      WORKFLOW_NAME,
      "release-workflow",
      "the release workflow's name",
    ),
    releaseCommitGrep: checked(
      flags["release-commit-grep"],
      COMMIT_GREP,
      "release-commit-grep",
      "a git log --grep pattern such as '^chore(release): version packages$', without quotes, backslashes or braces",
    ),
    defaultBranch: checked(flags["default-branch"], BRANCH, "default-branch", "a branch name"),
  });
  if (result.usage) throw new UsageError(result.usage);
  return result;
}

/** The CI file docs-ci reads and writes for this forge, relative to the root. */
function ciFile(forge, flags) {
  const file = flags.file ?? (forge === "github" ? DEFAULT_WORKFLOW : ".gitlab-ci.yml");
  if (forge === "github" && !/^\.github\/workflows\/[^/]+\.ya?ml$/.test(file)) {
    throw new UsageError("--file must be a workflow under .github/workflows/, ending in .yml or .yaml");
  }
  return file;
}

/** An existing setup: the GitHub workflows that use the action, or the GitLab CI file that holds the job. */
function find(root, forge, flags) {
  if (forge === "github") {
    const dir = insideRoot(root, ".github/workflows");
    const files = fs.existsSync(dir)
      ? fs
          .readdirSync(dir, { withFileTypes: true })
          .filter((entry) => entry.isFile() && /\.ya?ml$/.test(entry.name))
          .map((entry) => entry.name)
          .sort()
      : [];
    for (const name of files) {
      const text = fs.readFileSync(path.join(dir, name), "utf-8");
      if (usesAction(text)) return { setUp: true, file: `.github/workflows/${name}`, audience: audienceIn(text) };
    }
    return { setUp: false, file: ciFile(forge, flags), audience: null };
  }
  const file = ciFile(forge, flags);
  const text = readIfExists(insideRoot(root, file)) ?? "";
  return { file, ...findIn(text, flags.mirror ?? COMPONENT) };
}

function refusedResult(file, refusal) {
  return { ok: false, status: "refused", file, written: false, ...refusal };
}

/** Write (or with --dry-run, plan) the release job. */
function write(root, flags) {
  const forge = forgeOf(flags);
  const model = modelFrom(flags);
  const file = ciFile(forge, flags);
  if (!model.ok) return refusedResult(file, model.refusal);
  const audience = checked(required(flags, "audience"), AUDIENCE, "audience", "leed-cms:<trust id>");
  const stage = checked(flags.stage ?? "deploy", STAGE, "stage", "a stage name");
  const publishAt = checked(
    flags["publish-at"],
    ISO_TIME,
    "publish-at",
    "an ISO 8601 time with a zone, such as 2026-11-02T09:00:00Z",
  );
  const mirror = checked(
    flags.mirror,
    MIRROR,
    "mirror",
    "a component path such as gitlab.example.com/ci/schedule-release/schedule@1.1.0",
  );
  const noIntegrity = flags["no-integrity"] === true;
  if (noIntegrity && (forge !== "gitlab-self-managed" || mirror)) {
    throw new UsageError("--no-integrity applies only to self-managed GitLab's gitlab.com include, without --mirror");
  }
  const options = { audience, trigger: model.trigger, stage, manual: flags.manual === true, publishAt };
  const dryRun = flags["dry-run"] === true;

  const existing = find(root, forge, flags);
  if (existing.setUp) {
    return { ok: true, status: "already-set-up", file: existing.file, audience: existing.audience, written: false };
  }
  const target = insideRoot(root, file);
  const before = readIfExists(target);
  let after;
  let insertions;
  let warnings = [...model.warnings];

  if (forge === "github") {
    if (before !== null) {
      return refusedResult(file, {
        reason: `${file} already exists and is not a docs-ci workflow.`,
        remedy: "Pick another workflow file name with --file .github/workflows/<name>.yml.",
      });
    }
    after = renderWorkflow(options);
    insertions = [{ afterLine: 0, lines: after.replace(/\n$/, "").split("\n") }];
  } else {
    const lines = (before ?? "").split(/\r?\n/);
    const collisions = collidingJobs(lines, [JOB, MANUAL_JOB]);
    if (collisions.length > 0) {
      return refusedResult(file, {
        reason: `${file} already has a job named ${collisions.join(" and ")} that is not docs-ci's.`,
        remedy: "Rename that job, or set up the docs job by hand from the references.",
      });
    }
    const problem = stageProblem(lines, topLevelKeys(lines), stage);
    if (problem) return refusedResult(file, problem);
    warnings = [...warnings, ...fileWarnings(lines)];
    // Self-managed GitLab includes the component's template by its gitlab.com URL, unless it mirrors the component.
    const items = componentItems({
      ...options,
      component: mirror ?? COMPONENT,
      remote: forge === "gitlab-self-managed" && !mirror,
      integrity: !noIntegrity,
    });
    const merged = mergeGitlab(before ?? "", { items, tail: ruleJobs(options) });
    if (merged.status === "needs-manual-merge") {
      return {
        ok: false,
        status: "needs-manual-merge",
        file,
        written: false,
        reason: `The include: on line ${merged.line} is not a block list, so docs-ci cannot add an item without rewriting it.`,
        remedy: "Show the user both snippets: add the include item to their include: by hand, and the jobs at the end.",
        include: items.join("\n"),
        jobs: ruleJobs(options).join("\n"),
      };
    }
    after = merged.text;
    insertions = merged.insertions;
  }

  if (!dryRun) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, after);
  }
  return {
    ok: true,
    status: dryRun ? "planned" : "written",
    file,
    created: before === null,
    written: !dryRun,
    added: insertions.map((insertion) => insertion.lines.join("\n")).join("\n...\n"),
    insertions,
    stampBranch: model.stampBranch,
    trigger: model.trigger,
    warnings,
  };
}

/** Run one subcommand and return its document and exit code. */
export function run(argv) {
  const [command, ...rest] = argv;
  if (command === "classify") {
    const flags = parseFlags(rest);
    onlyFlags(flags, ["remote", "issuer"]);
    const result = classify(required(flags, "remote"), flags.issuer);
    return { document: result, code: result.ok ? 0 : 1 };
  }
  if (command === "plan") {
    const flags = parseFlags(rest, ["release-dispatch"]);
    onlyFlags(flags, [...MODEL_FLAGS, "id"]);
    const result = modelFrom(flags);
    return { document: result, code: result.ok ? 0 : 1 };
  }
  if (command === "find") {
    const flags = parseFlags(rest);
    onlyFlags(flags, ["root", "forge", "file", "mirror"]);
    return { document: { ok: true, ...find(realDir(flags.root, "root"), forgeOf(flags), flags) }, code: 0 };
  }
  if (command === "write") {
    const flags = parseFlags(rest, ["manual", "dry-run", "release-dispatch", "no-integrity"]);
    onlyFlags(flags, [
      ...MODEL_FLAGS,
      "root",
      "audience",
      "stage",
      "manual",
      "publish-at",
      "file",
      "mirror",
      "no-integrity",
      "dry-run",
    ]);
    const result = write(realDir(flags.root, "root"), flags);
    return { document: result, code: result.ok ? 0 : 1 };
  }
  throw new UsageError("the first argument must be classify, plan, find or write");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const { document, code } = run(process.argv.slice(2));
    finish(document, code);
  } catch (error) {
    fail(error);
  }
}
