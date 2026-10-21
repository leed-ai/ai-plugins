import { DOCS_ENVIRONMENT } from "./branch-model.mjs";

/**
 * The GitHub Actions workflow for continuous documentation, using the published `leed-ai/schedule-release@v1`
 * action (v1 is v1.1.0). It is always its own file: its trigger differs from the repository's other workflows, and a
 * new file never touches a byte of theirs.
 */

export const ACTION_REF = "leed-ai/schedule-release@v1";
export const DEFAULT_WORKFLOW = ".github/workflows/leed-docs-release.yml";
export const MARKER = "# Leed continuous documentation (schedule-release v1)";

const quote = (value) => JSON.stringify(value);

/** The steps a job runs: the checkout, any `extra` steps, then the action with its `with:` lines. */
function steps(withLines, extra = []) {
  return [
    "    steps:",
    "      # The action reads the release's commits with git log, so it needs the whole history and the tags. The job",
    "      # never pushes, so the checkout keeps no credentials.",
    "      - uses: actions/checkout@v4",
    "        with:",
    "          fetch-depth: 0",
    "          persist-credentials: false",
    ...extra,
    `      - uses: ${ACTION_REF}`,
    "        with:",
    ...withLines.map((line) => `          ${line}`),
  ];
}

/**
 * The step that finds a release-commit release's range: from the previous release commit to the latest one, both
 * matched by `git log --grep`. A release workflow pushes the release commit, so there is no push range and no merge
 * commit for the action to fall back on. The pattern reaches the shell through `env:`, never inside the script.
 */
function rangeStep(grep, manual) {
  return [
    "      - id: range",
    "        name: Find the release's range, from the previous release commit to this one",
    "        env:",
    `          RELEASE_COMMIT_GREP: ${quote(grep)}`,
    "        run: |",
    '          releases=$(git log --grep="$RELEASE_COMMIT_GREP" --format=%H -n 2 HEAD)',
    '          until=$(echo "$releases" | sed -n 1p)',
    '          since=$(echo "$releases" | sed -n 2p)',
    '          if [ -z "$until" ] || [ -z "$since" ]; then',
    manual
      ? '            echo "::error::Two release commits matching $RELEASE_COMMIT_GREP are needed. For the first release, run the workflow by hand with since set to the commit the release starts after."'
      : '            echo "::error::Two release commits matching $RELEASE_COMMIT_GREP are needed. The first release has no earlier one to start from: schedule its pages by hand from Claude (schedule_pages_by_source_id), or run /leed:docs-ci again to add a manual run."',
    "            exit 1",
    "          fi",
    '          echo "since=$since" >> "$GITHUB_OUTPUT"',
    '          echo "until=$until" >> "$GITHUB_OUTPUT"',
  ];
}

/** The `on:` block for the release itself. */
function releaseOn(trigger) {
  if (trigger.kind === "tag") return ["on:", "  push:", "    tags:", `      - ${quote(trigger.pattern)}`];
  if (trigger.kind === "release-commit") {
    return [
      "on:",
      "  # The release workflow pushes the release commit; the docs job runs once it has finished.",
      "  workflow_run:",
      "    workflows:",
      `      - ${quote(trigger.workflow)}`,
      "    types:",
      "      - completed",
      "    branches:",
      `      - ${quote(trigger.branch)}`,
    ];
  }
  return ["on:", "  push:", "    branches:", `      - ${quote(trigger.branch)}`];
}

/**
 * The workflow text. `trigger` comes from the branch model; `manual` adds a `workflow_dispatch` job for re-running a
 * release's docs by hand, with `since` and `dry-run` as its inputs. The release job's `dry-run` is always the literal
 * "true": the user changes it to "false" once a dry run has listed the right pages. Every job declares the deployment
 * environment the trust pins.
 */
export function renderWorkflow({ audience, trigger, manual = false, publishAt }) {
  const tag = trigger.kind === "tag";
  const releaseCommit = trigger.kind === "release-commit";
  const on = releaseOn(trigger);
  if (manual) {
    on.push(
      "  workflow_dispatch:",
      "    inputs:",
      "      since:",
      "        description: The commit or ref the release starts after (the previous release's tip)",
      "        required: true",
      "        type: string",
      "      dry-run:",
      '        description: Report only. Set to "false" to schedule the pages',
      "        required: true",
      "        type: choice",
      '        default: "true"',
      "        options:",
      '          - "true"',
      '          - "false"',
    );
  }
  const shared = [`audience: ${audience}`];
  if (publishAt) shared.push(`publish-at: ${quote(publishAt)}`);
  if (tag) shared.push(`tag-pattern: ${quote(trigger.pattern)}`);
  const environment = [`    environment: ${DOCS_ENVIRONMENT}`];
  const condition = releaseCommit
    ? [
        "    if: github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event != 'pull_request' && github.event.workflow_run.head_repository.full_name == github.repository",
      ]
    : manual
      ? ["    if: github.event_name == 'push'"]
      : [];
  const job = [
    "  schedule-docs:",
    ...condition,
    "    runs-on: ubuntu-latest",
    ...environment,
    ...(releaseCommit
      ? steps(
          [
            ...shared,
            // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, written into the workflow as it is.
            "since: ${{ steps.range.outputs.since }}",
            // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, written into the workflow as it is.
            "until: ${{ steps.range.outputs.until }}",
            'dry-run: "true"',
          ],
          rangeStep(trigger.grep, manual),
        )
      : steps([...shared, 'dry-run: "true"'])),
  ];
  const manualJob = manual
    ? [
        "",
        `  # Re-run a release's docs by hand: Actions → Leed docs release → Run workflow, ${tag ? "from a release tag" : `from the ${trigger.branch} branch`}: the trust matches no other ref.`,
        "  schedule-docs-manual:",
        "    if: github.event_name == 'workflow_dispatch'",
        "    runs-on: ubuntu-latest",
        ...environment,
        // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expressions, written into the workflow as they are.
        ...steps([...shared, "since: ${{ inputs.since }}", "dry-run: ${{ inputs.dry-run }}"]),
      ]
    : [];
  return [
    MARKER,
    "# Schedules the docs pages stamped with this release's commits to publish with it. Set up by /leed:docs-ci.",
    "# The audience identifies the Leed CI trust and is not a secret. The first runs are dry runs: change",
    '# dry-run to "false" once a run lists the right pages under matched.',
    "name: Leed docs release",
    "",
    ...on,
    "",
    "# Minting an OIDC token needs id-token: write, and declaring it drops every other permission, so contents: read",
    "# is listed for the checkout.",
    "permissions:",
    "  id-token: write",
    "  contents: read",
    "",
    "jobs:",
    ...job,
    ...manualJob,
    "",
  ].join("\n");
}

/** The audience a workflow text passes to the action, if it names one. */
export function audienceIn(text) {
  return /audience:\s*["']?(leed-cms:[A-Za-z0-9-]+)/.exec(text)?.[1] ?? null;
}

/**
 * Whether a workflow text already uses the action, at any version, in a `uses:` line (not a comment). Matched in any
 * casing, since GitHub resolves `Leed-AI/` as well as the canonical `leed-ai/`; `write` only ever emits `ACTION_REF`.
 */
export function usesAction(text) {
  return /^\s*(?:-\s+)?uses:\s*["']?leed-ai\/schedule-release@/im.test(text);
}
