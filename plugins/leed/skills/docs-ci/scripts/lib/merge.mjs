/**
 * Merging the docs-ci job into a customer's existing `.gitlab-ci.yml` without re-serializing it.
 *
 * The file is read as lines and only its top-level keys are looked at. New text is inserted as whole lines, either
 * after the last line of a block-sequence `include:` or at the end of the file, so every original line keeps its
 * bytes and its order: removing the inserted lines gives back the original file exactly. An `include:` in any other
 * form (a single string, a mapping, a flow list) cannot be extended that way, and is left for the user to merge.
 */

/** GitLab's stages when a file declares none. */
const DEFAULT_STAGES = [".pre", "build", "test", "deploy", ".post"];

const isContent = (line) => line.trim() !== "" && !line.trimStart().startsWith("#");
// A comment starts at a `#` that opens the value or follows whitespace; `rest` arrives with its leading space gone.
const stripComment = (value) => value.replace(/(^|\s+)#.*$/, "").trim();

/** The top-level keys of a YAML file, with their line index and whatever follows the colon. */
export function topLevelKeys(lines) {
  const keys = [];
  lines.forEach((line, index) => {
    const match = /^(?:"([^"]+)"|'([^']+)'|([^\s#'"-][^#]*?)):(?:\s+(.*))?$/.exec(line);
    if (match) keys.push({ key: match[1] ?? match[2] ?? match[3], index, rest: stripComment(match[4] ?? "") });
  });
  return keys;
}

/**
 * How the file's `include:` can take new items: `none` (there is no include), `block` (a block sequence, with the
 * index of its last line and the items' indentation), or `other` (a form docs-ci never edits).
 */
export function includeShape(lines, keys) {
  const include = keys.find((entry) => entry.key === "include");
  if (!include) return { kind: "none" };
  if (include.rest !== "") return { kind: "other", line: include.index + 1 };
  let first = include.index + 1;
  while (first < lines.length && !isContent(lines[first])) first++;
  const itemMatch = /^(\s*)- /.exec(lines[first] ?? "") ?? /^(\s*)-$/.exec(lines[first] ?? "");
  if (!itemMatch) return { kind: "other", line: include.index + 1 };
  const indent = itemMatch[1];
  let last = first;
  for (let index = first + 1; index < lines.length; index++) {
    const line = lines[index];
    if (!isContent(line)) continue;
    const belongs = /^\s/.test(line) || (indent === "" && /^-(\s|$)/.test(line));
    if (!belongs) break;
    last = index;
  }
  return { kind: "block", last, indent };
}

/** The stages the file declares under a top-level `stages:`, or null when it declares none. */
export function declaredStages(lines, keys) {
  const entry = keys.find((key) => key.key === "stages");
  if (!entry) return null;
  if (entry.rest.startsWith("[")) {
    return entry.rest
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map((stage) => stage.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  const stages = [];
  for (let index = entry.index + 1; index < lines.length; index++) {
    const line = lines[index];
    if (!isContent(line)) continue;
    const item = /^\s*- (.+)$/.exec(line);
    if (!item) break;
    stages.push(stripComment(item[1]).replace(/^["']|["']$/g, ""));
  }
  return stages;
}

/** Why `stage` cannot be used in this file, or null when it can. */
export function stageProblem(lines, keys, stage) {
  const stages = declaredStages(lines, keys);
  const available = stages ?? DEFAULT_STAGES;
  if (available.includes(stage)) return null;
  return {
    reason: `The stage ${stage} is not one this pipeline has. Its stages are: ${available.join(", ")}.`,
    remedy:
      "Ask the user which existing stage the docs job belongs in (usually the last deploy or release stage) and run write again with --stage <name>. docs-ci never edits the stages list.",
    stages: available,
  };
}

/**
 * Insert `items` (include items, unindented) and append `tail` (top-level lines) to `text`. Returns the new text and
 * each insertion as `{ afterLine, lines }`, where `afterLine` counts the original file's lines (0 is the very top).
 */
export function mergeGitlab(text, { items, tail }) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const endsWithNewline = text === "" || text.endsWith("\n");
  if (endsWithNewline) lines.pop();
  const keys = topLevelKeys(lines);
  const shape = includeShape(lines, keys);
  if (items.length > 0 && shape.kind === "other") return { status: "needs-manual-merge", line: shape.line };

  const insertions = [];
  let appended = [];
  if (items.length > 0 && shape.kind === "block") {
    insertions.push({ afterLine: shape.last + 1, lines: items.map((line) => `${shape.indent}${line}`) });
  } else if (items.length > 0) {
    appended = ["", "include:", ...items.map((line) => `  ${line}`)];
  }
  appended.push("", ...tail);
  insertions.push({ afterLine: lines.length, lines: appended });

  // An empty file gets the appended text alone, without the blank line that separates it from existing content.
  const out = lines.length === 0 ? appended.slice(1) : [];
  lines.forEach((line, index) => {
    out.push(line);
    for (const insertion of insertions) if (insertion.afterLine === index + 1) out.push(...insertion.lines);
  });
  // A file that did not end in a newline gets one after its last line, before the appended text; nothing else changes.
  return { status: "merged", text: `${out.join(eol)}${eol}`, insertions, addedFinalNewline: !endsWithNewline };
}

/** Whether a top-level key in the file already uses one of `names`. */
export function collidingJobs(lines, names) {
  const keys = new Set(topLevelKeys(lines).map((entry) => entry.key));
  return names.filter((name) => keys.has(name));
}

/** Warnings about the rest of the file that the job's rules depend on. */
export function fileWarnings(lines) {
  const keys = topLevelKeys(lines);
  return keys.some((entry) => entry.key === "workflow")
    ? [
        "The file has a top-level workflow: block. Its rules must still create pipelines for the release (a push to the release branch, or a release tag) and, with --manual, for pipelines run from the web, or the docs job never runs.",
      ]
    : [];
}
