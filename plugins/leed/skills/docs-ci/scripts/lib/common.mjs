import fs from "node:fs";
import path from "node:path";

/** Flag parsing, the JSON report, and the safe-write check every docs-ci subcommand shares. */

/** A usage error: the script prints `{ ok: false, error }` and exits 2, having written nothing. */
export class UsageError extends Error {}

/** Parse `--name value` flags into `{ name: value }`, with the named booleans as `true`. */
export function parseFlags(argv, booleans = []) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new UsageError(`unexpected argument ${arg}`);
    const name = arg.slice(2);
    if (booleans.includes(name)) {
      flags[name] = true;
      continue;
    }
    const value = argv[++i];
    if (value === undefined || value.startsWith("--")) throw new UsageError(`--${name} needs a value`);
    if (flags[name] !== undefined) throw new UsageError(`--${name} was given twice`);
    flags[name] = value;
  }
  return flags;
}

/** Refuse any flag the subcommand does not take, so a typo never silently changes what is written. */
export function onlyFlags(flags, known) {
  for (const name of Object.keys(flags)) {
    if (!known.includes(name)) throw new UsageError(`unknown flag --${name}`);
  }
}

export function required(flags, name) {
  const value = flags[name];
  if (value === undefined || value === true) throw new UsageError(`--${name} is required`);
  return value;
}

/** `value`, when it matches `pattern`; otherwise a usage error naming the flag and what it takes. */
export function checked(value, pattern, flag, what) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !pattern.test(value)) throw new UsageError(`--${flag} must be ${what}`);
  return value;
}

/** Print one JSON document and exit with `code`. */
export function finish(document, code = 0) {
  process.stdout.write(`${JSON.stringify(document, null, 2)}\n`);
  process.exit(code);
}

export function fail(error) {
  if (error instanceof UsageError) finish({ ok: false, error: error.message }, 2);
  throw error;
}

/** The real path of an existing directory. */
export function realDir(dir, flag) {
  if (!dir) throw new UsageError(`--${flag} is required`);
  let real;
  try {
    real = fs.realpathSync(path.resolve(dir));
  } catch {
    throw new UsageError(`--${flag} ${dir} does not exist`);
  }
  if (!fs.statSync(real).isDirectory()) throw new UsageError(`--${flag} ${dir} is not a directory`);
  return real;
}

/**
 * The absolute path of `rel` inside `root` (a real path), refusing anything that leaves the root: an absolute or `..`
 * path, a symlink at the file itself, or a symlink in any directory between the root and the file. It is what keeps
 * a link planted in the repository from steering a write out of it.
 */
export function insideRoot(root, rel) {
  if (path.isAbsolute(rel) || rel.split(/[\\/]/).includes("..")) {
    throw new UsageError(`${rel} must be a path inside the repository, relative to --root`);
  }
  const base = path.resolve(root);
  const target = path.resolve(base, rel);
  // A file, never the repository itself: `.` or an empty --file (GitLab's ci_config_path is empty when unset).
  if (!target.startsWith(base + path.sep)) {
    throw new UsageError(`${JSON.stringify(rel)} must name a file inside the repository, relative to --root`);
  }
  for (let dir = path.dirname(target); dir.startsWith(base + path.sep); dir = path.dirname(dir)) {
    if (fs.lstatSync(dir, { throwIfNoEntry: false })?.isSymbolicLink()) {
      throw new UsageError(`${rel} is under a symlink; docs-ci never writes through one`);
    }
  }
  if (fs.lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink()) {
    throw new UsageError(`${rel} is a symlink; docs-ci never writes through one`);
  }
  return target;
}

/** The file's text, or null when it does not exist. */
export function readIfExists(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : null;
}
