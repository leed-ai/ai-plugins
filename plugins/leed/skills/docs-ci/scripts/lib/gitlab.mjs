import { DOCS_ENVIRONMENT } from "./branch-model.mjs";

/**
 * The GitLab CI text for continuous documentation: the published component on gitlab.com; on a self-managed instance
 * the same template included by its public URL at the 1.1.0 tag (`include:remote`, pinned by `integrity`), since a
 * gitlab.com component cannot be included there; or a mirror of the component on the instance itself. Job `rules:`
 * are added by declaring each job again by name after the include, which GitLab merges into the template's job.
 */

export const COMPONENT = "gitlab.com/leed-ai-oss/schedule-release/schedule@1.1.0";
/** The component's template at the 1.1.0 tag, as GitLab serves it raw: public, no sign-in. Never a branch. */
export const REMOTE = "https://gitlab.com/leed-ai-oss/schedule-release/-/raw/1.1.0/templates/schedule.yml";
/** The Base64 SHA-256 of the file at REMOTE, which `include:integrity` checks (GitLab 17.9 or later). */
export const INTEGRITY = "sha256-cTmr5Kl/wlu8W5UgBJwc+wmOJvsVjY6ONgJjqu7O7ng=";
export const MARKER = "# Leed continuous documentation (schedule-release 1.1.0)";
export const JOB = "leed-docs-release";
export const MANUAL_JOB = "leed-docs-release-manual";

const quote = (value) => JSON.stringify(value);

/** A glob tag pattern (`v*`) as the anchored regex a GitLab `rules: if:` compares `$CI_COMMIT_TAG` with. */
export function tagRegex(pattern) {
  const body = pattern
    .split("")
    .map((char) => {
      if (char === "*") return ".*";
      if (char === "?") return ".";
      if (char === "/") return "\\/";
      return /[.+^${}()|[\]\\-]/.test(char) ? `\\${char}` : char;
    })
    .join("");
  return `/^${body}$/`;
}

/** The `rules:` condition for the release job and for the manual re-run job. */
function conditions(trigger) {
  if (trigger.kind === "tag") {
    return {
      release: `$CI_COMMIT_TAG =~ ${tagRegex(trigger.pattern)} && $CI_PIPELINE_SOURCE == "push"`,
      manual: '$CI_COMMIT_TAG && $CI_PIPELINE_SOURCE == "web" && $DOCS_SINCE',
    };
  }
  const branch = `$CI_COMMIT_BRANCH == ${quote(trigger.branch)}`;
  return {
    release: `${branch} && $CI_PIPELINE_SOURCE == "push"`,
    manual: `${branch} && $CI_PIPELINE_SOURCE == "web" && $DOCS_SINCE`,
  };
}

/** A `rules:` block holding one `if:`, single-quoted for YAML. */
function rules(condition) {
  return ["  rules:", `    - if: '${condition.replaceAll("'", "''")}'`];
}

function environment(trigger) {
  return trigger.kind === "tag" ? ["  environment:", `    name: ${DOCS_ENVIRONMENT}`] : [];
}

/**
 * The first lines of one `include:` item: the component by path, or the template by its public URL with its
 * integrity, unless `integrity` is false (an instance older than GitLab 17.9, where the pin is the tag alone).
 */
function source({ component, remote, integrity }) {
  if (!remote) return [`- component: ${component}`];
  return [`- remote: ${quote(REMOTE)}`, ...(integrity === false ? [] : [`  integrity: ${quote(INTEGRITY)}`])];
}

/**
 * The `include:` items, without indentation; `indent` is prefixed to every line by the caller. `remote: true` includes
 * the template by URL (self-managed GitLab) in place of the component.
 */
export function componentItems({
  audience,
  trigger,
  stage,
  manual,
  publishAt,
  component = COMPONENT,
  remote = false,
  integrity = true,
}) {
  const inputs = [`job-name: ${JOB}`, `stage: ${stage}`, `audience: ${audience}`];
  if (publishAt) inputs.push(`publish-at: ${quote(publishAt)}`);
  if (trigger.kind === "tag") inputs.push(`tag-pattern: ${quote(trigger.pattern)}`);
  const head = source({ component, remote, integrity });
  const item = (lines) => [...head, "  inputs:", ...lines.map((line) => `    ${line}`)];
  const items = [`${MARKER}, set up by /leed:docs-ci.`];
  if (remote) {
    items.push(
      "# The component's template from gitlab.com at the 1.1.0 tag: the instance fetches it over HTTPS when it builds",
      integrity === false
        ? "# the pipeline. Pinned by the tag alone: integrity needs GitLab 17.9 or later."
        : "# the pipeline, and integrity fails the pipeline if the file served there ever changes.",
    );
  }
  items.push(
    '# The first runs are dry runs: change dry-run to "false" once a run lists the right pages under matched.',
    ...item([...inputs, 'dry-run: "true"']),
  );
  if (manual) {
    items.push(
      "# Re-run a release's docs by hand: Build → Pipelines → Run pipeline on the release ref, with DOCS_SINCE set to",
      '# the commit the release starts after. It is a dry run unless DOCS_DRY_RUN is set to "false" as well.',
      ...item([
        ...inputs.map((line) => (line.startsWith("job-name:") ? `job-name: ${MANUAL_JOB}` : line)),
        "since: $DOCS_SINCE",
        "dry-run: $DOCS_DRY_RUN",
      ]),
    );
  }
  return items;
}

/** The jobs declared again by name to give the component's jobs their `rules:`. */
export function ruleJobs({ trigger, manual }) {
  const when = conditions(trigger);
  const lines = [`${MARKER}: when its jobs run.`, `${JOB}:`, ...environment(trigger), ...rules(when.release)];
  if (manual) lines.push(`${MANUAL_JOB}:`, ...environment(trigger), "  needs: []", ...rules(when.manual));
  return lines;
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// The template's raw URL at any ref, so a setup pinned to another tag is found too.
const REMOTE_ANY_REF = escapeRegex(REMOTE).replace(escapeRegex("/-/raw/1.1.0/"), "/-/raw/[^/\\s]+/");

/**
 * Whether a CI file already holds the docs-ci job, in any form (the component, a mirror of it, or the template by
 * its gitlab.com URL), and the audience it uses.
 */
export function findIn(text, component = COMPONENT) {
  // A `component:` or `remote:` line names the integration; a mention in a comment does not count.
  const componentLine = (path) =>
    new RegExp(`^\\s*(?:-\\s+)?component:\\s*["']?${escapeRegex(path.split("@")[0])}@`, "m");
  const remoteLine = new RegExp(`^\\s*(?:-\\s+)?remote:\\s*["']?${REMOTE_ANY_REF}["']?\\s*$`, "m");
  const setUp =
    componentLine(component).test(text) ||
    componentLine(COMPONENT).test(text) ||
    remoteLine.test(text) ||
    text.includes(MARKER);
  const audience = /(?:audience|aud):\s*["']?(leed-cms:[A-Za-z0-9-]+)/.exec(text)?.[1] ?? null;
  return { setUp, audience };
}
