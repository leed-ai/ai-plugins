import fs from "node:fs";
import path from "node:path";

/**
 * Walking a handoff safely: no link is followed, nothing outside the root is read, and the walk stops
 * with a clear error at a cap instead of reading an unbounded tree.
 */

export class ShapeError extends Error {}

export const LIMITS = { files: 5000, textBytes: 50 * 1024 * 1024, depth: 32 };

const KINDS = [
  ["page", /\.(?:html?)$/i],
  ["component", /\.(?:jsx|tsx)$/i],
  ["style", /\.css$/i],
  ["json", /\.json$/i],
  ["script", /\.(?:[cm]?js|ts)$/i],
  ["doc", /\.(?:md|markdown|txt)$/i],
  ["image", /\.(?:png|jpe?g|gif|webp|avif|svg|ico|bmp|tiff?)$/i],
  ["font", /\.(?:woff2?|ttf|otf|eot)$/i],
  ["video", /\.(?:mp4|webm|mov|m4v)$/i],
  ["audio", /\.(?:mp3|wav|ogg|m4a)$/i],
  ["document", /\.pdf$/i],
];

const TEXT_KINDS = new Set(["page", "component", "style", "json", "script", "doc"]);
export const ASSET_KINDS = new Set(["image", "font", "video", "audio", "document"]);

/** Directories an archive tool or an editor adds, which belong to no design. */
const IGNORED_DIRS = new Set(["__MACOSX", "node_modules", ".git"]);

/** True for a directory the walk never enters: an archive tool's, an editor's, or a hidden one. */
export function ignoredDir(name) {
  return IGNORED_DIRS.has(name) || name.startsWith(".");
}

export function kindOf(rel) {
  return KINDS.find(([, pattern]) => pattern.test(rel))?.[0] ?? null;
}

export function toRel(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function inside(root, target) {
  const rel = path.relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * A symlink is never followed. One whose target, written or resolved, leaves the root is an error; one
 * that stays inside is listed in `ignored`.
 */
function checkLink(root, full, rel, ignored) {
  let written;
  try {
    written = path.resolve(path.dirname(full), fs.readlinkSync(full));
  } catch (error) {
    throw new ShapeError(`cannot read the symlink ${rel}: ${error.message}`);
  }
  let resolved = written;
  try {
    resolved = fs.realpathSync(full);
  } catch {
    // A dangling link: its written target is all there is to check.
  }
  if (!inside(root, written) || !inside(root, resolved)) {
    throw new ShapeError(
      `symlink ${rel} points outside the handoff; a handoff must hold its own files, so the inspection stopped`,
    );
  }
  ignored.push({ file: rel, reason: "a symlink, which is never followed" });
}

/**
 * Every regular file below `root` (a real path), sorted, with its kind and size. Text files are read
 * here, once, so the size cap covers everything the inspection reads.
 */
export function collect(root) {
  const files = [];
  const ignored = [];
  let textBytes = 0;
  const visit = (dir, depth) => {
    if (depth > LIMITS.depth) throw new ShapeError(`${toRel(root, dir)} is nested deeper than ${LIMITS.depth} levels`);
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      throw new ShapeError(`cannot read the directory ${toRel(root, dir) || "."}: ${error.message}`);
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = toRel(root, full);
      if (entry.isSymbolicLink()) {
        checkLink(root, full, rel, ignored);
      } else if (entry.isDirectory()) {
        if (ignoredDir(entry.name)) {
          ignored.push({ file: `${rel}/`, reason: "a tool's or system's directory, not part of the design" });
        } else visit(full, depth + 1);
      } else if (!entry.isFile()) {
        ignored.push({ file: rel, reason: "not a regular file" });
      } else if (entry.name.startsWith(".")) {
        ignored.push({ file: rel, reason: "a hidden file, not part of the design" });
      } else {
        if (files.length >= LIMITS.files) {
          throw new ShapeError(`the handoff holds more than ${LIMITS.files} files; unpack only the design`);
        }
        const kind = kindOf(rel);
        let bytes;
        let text = null;
        try {
          bytes = fs.statSync(full).size;
          if (TEXT_KINDS.has(kind)) {
            textBytes += bytes;
            if (textBytes > LIMITS.textBytes) {
              throw new ShapeError(`the handoff holds more than ${LIMITS.textBytes / 1024 / 1024} MB of text`);
            }
            text = fs.readFileSync(full, "utf-8");
          }
        } catch (error) {
          if (error instanceof ShapeError) throw error;
          throw new ShapeError(`cannot read ${rel}: ${error.message}`);
        }
        files.push({ rel, kind, bytes, text });
      }
    }
  };
  visit(root, 0);
  return { files, ignored };
}

/** Resolves a reference found in `fromRel` to a handoff-relative path, or null when it is not a local file. */
export function resolveRef(fromRel, ref) {
  const clean = ref.trim().split(/[?#]/)[0];
  if (!clean || /^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(ref.trim())) return null;
  let decoded = clean;
  try {
    decoded = decodeURIComponent(clean);
  } catch {}
  const joined = decoded.startsWith("/")
    ? path.posix.normalize(decoded.slice(1))
    : path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), decoded));
  return joined.startsWith("..") ? null : joined;
}

export function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
  return starts;
}

export function lineOf(starts, index) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** Replaces a span with spaces, keeping newlines so line numbers stay right. */
export function blank(text) {
  return text.replace(/[^\n]/g, " ");
}
