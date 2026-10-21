import fs from "node:fs";
import path from "node:path";

/**
 * Placeholder ids and the safe file walk every sandbox-move script shares.
 *
 * A sandbox site names every record with a readable placeholder, `ph-<kind>-<n>`. The kind list and the token pattern
 * are the CLI's (`packages/site-management/src/cli/sandbox/placeholders.ts`), copied here because these scripts run
 * with no dependencies; the plugin's tests fail when the two copies disagree.
 */

export class ScriptError extends Error {}

/** Record kinds a placeholder can name. Keep in step with the CLI's PLACEHOLDER_KINDS. */
export const PLACEHOLDER_KINDS = [
  "pt",
  "page",
  "label",
  "author",
  "menu",
  "menuitem",
  "form",
  "asset",
  "cta",
  "index",
  "autolink",
];

const KIND_ALTERNATION = PLACEHOLDER_KINDS.join("|");

/** One whole placeholder id. */
export const PLACEHOLDER_ID = new RegExp(`^ph-(${KIND_ALTERNATION})-[1-9]\\d*$`);

/** A fresh global token pattern: `ph-page-1` never matches inside `ph-page-10`, and a leading `-` is allowed. */
export function placeholderToken() {
  return new RegExp(`(?<![A-Za-z0-9_])ph-(${KIND_ALTERNATION})-([1-9]\\d*)(?![A-Za-z0-9_])`, "g");
}

/** Where a sandbox stages images until the move uploads them, as pages and templates reference it. */
export const STAGED_IMAGE_PREFIX = "/static/images/tmp/";

/** Every staged-image reference in a text: the site path up to a quote, bracket, space or the end. */
export function stagedImageToken() {
  return /\/static\/images\/tmp\/[^\s"'()<>`{}\\]+/g;
}

/** Directories no move step reads: build output, installed packages, VCS and editor state. */
const SKIPPED_DIRS = new Set(["node_modules", ".build", "_site", "dist", ".git", ".husky", ".claude", ".vscode"]);

/** The text files a placeholder can live in. */
const TEXT_EXTENSIONS = new Set([
  ".hbs",
  ".json",
  ".md",
  ".css",
  ".js",
  ".mjs",
  ".html",
  ".svg",
  ".txt",
  ".yaml",
  ".yml",
]);

/** Every regular text file under `root` (a real path), sorted, as `{ rel, full }`. Symlinks are never followed. */
export function textFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) walk(full);
      } else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        out.push({ rel: toRel(root, full), full });
      }
    }
  };
  walk(root);
  return out;
}

/**
 * The directories that hold the site itself: templates, data and content under `src/`, the stylesheets under
 * `tailwind/`, and the Leed Markdown waiting under `leed-import/`. What a sandbox defines and uses is read from these
 * alone, so a README or a note beside the site that mentions a placeholder does not change the plan.
 */
export const SITE_SOURCE_DIRS = ["src/", "tailwind/", "leed-import/"];

/** The text files of the site itself under `root` (a real path): {@link textFiles} inside {@link SITE_SOURCE_DIRS}. */
export function siteSourceFiles(root) {
  return textFiles(root).filter(({ rel }) => SITE_SOURCE_DIRS.some((dir) => rel.startsWith(dir)));
}

export function toRel(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

/** Whether `target` is `root` or below it. Both are compared as given; callers pass real paths. */
export function inside(root, target) {
  const rel = path.relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** The real path of an existing directory, or a ScriptError naming the flag it came from. */
export function realDir(dir, flag) {
  if (!dir) throw new ScriptError(`${flag} is required`);
  let real;
  try {
    real = fs.realpathSync(path.resolve(dir));
  } catch {
    throw new ScriptError(`${flag} ${dir} does not exist`);
  }
  if (!fs.statSync(real).isDirectory()) throw new ScriptError(`${flag} ${dir} is not a directory`);
  return real;
}

/**
 * Refuse to write `file` unless its real location is inside one of `roots`: the file itself must not be a symlink
 * (dangling or not), no directory between the root and the file may be a symlink, even one pointing back inside, and
 * the real path of its nearest existing ancestor must be inside a root. This is what keeps a link planted in a
 * tree from steering a write — or a directory created for one — out of it. Returns the path to write.
 */
export function assertWritable(file, roots) {
  const resolved = path.resolve(file);
  const lstat = (entry) => fs.lstatSync(entry, { throwIfNoEntry: false });
  // lstat, not exists: a dangling link is an entry, and following it would create its target wherever it points.
  let existing = path.dirname(resolved);
  const missing = [];
  while (!lstat(existing)) {
    missing.unshift(path.basename(existing));
    existing = path.dirname(existing);
  }
  let realExisting;
  try {
    realExisting = fs.realpathSync(existing);
  } catch {
    throw new ScriptError(`${file} is under a symlink that points nowhere; the move never writes through one`);
  }
  const target = path.join(realExisting, ...missing, path.basename(file));
  if (!roots.some((root) => inside(root, target))) {
    throw new ScriptError(`${file} is outside the trees the move was given, and it writes only inside them`);
  }
  // Every existing directory between the root and the file must be a real one, and so must the file itself.
  const lexicalRoot = roots.find((root) => inside(root, resolved));
  if (lexicalRoot) {
    for (let dir = path.dirname(resolved); dir !== lexicalRoot && inside(lexicalRoot, dir); dir = path.dirname(dir)) {
      if (lstat(dir)?.isSymbolicLink())
        throw new ScriptError(`${file} is under a symlink; the move never writes through one`);
    }
  }
  if (lstat(resolved)?.isSymbolicLink() || lstat(target)?.isSymbolicLink()) {
    throw new ScriptError(`${file} is a symlink; the move never writes through one`);
  }
  return target;
}

/** Each placeholder and staged-image reference in `text`, with its 1-based line. */
export function findTokens(text) {
  const found = [];
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    for (const match of line.matchAll(placeholderToken()))
      found.push({ token: match[0], kind: match[1], line: index + 1 });
    for (const match of line.matchAll(stagedImageToken()))
      found.push({ token: match[0], kind: "image", line: index + 1 });
  });
  return found;
}

/** Parse `--name value` and repeated flags into `{ name: [values] }`, with bare `--flag` as `true`. */
export function parseFlags(argv, { repeatable = [], booleans = [] } = {}) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new ScriptError(`unexpected argument ${arg}`);
    const name = arg.slice(2);
    if (booleans.includes(name)) {
      flags[name] = true;
      continue;
    }
    const value = argv[++i];
    if (value === undefined || value.startsWith("--")) throw new ScriptError(`--${name} needs a value`);
    if (repeatable.includes(name)) {
      flags[name] = [...(flags[name] ?? []), value];
    } else if (flags[name] !== undefined) throw new ScriptError(`--${name} was given twice`);
    else flags[name] = value;
  }
  return flags;
}

/** Print one JSON document and exit with `code`. Usage errors exit 2 with `{ ok: false, error }`. */
export function finish(document, code = 0) {
  process.stdout.write(`${JSON.stringify(document, null, 2)}\n`);
  process.exit(code);
}

export function fail(error) {
  if (error instanceof ScriptError) finish({ ok: false, error: error.message }, 2);
  throw error;
}
