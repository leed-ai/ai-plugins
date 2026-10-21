#!/usr/bin/env node
/**
 * Sandbox move: replace placeholders with the real ids the CMS returned.
 *
 * Takes an id map and rewrites every text file under each `--root`:
 *
 *   {
 *     "ph-pt-2": "k3x9qa",
 *     "/static/images/tmp/hero.png": {
 *       "src": "/cdn-cgi/imagedelivery/<hash>/<imageId>/original",
 *       "assetId": "<assetId>",
 *       "markdown": "![Hero =1200x630](/cdn-cgi/imagedelivery/<hash>/<imageId>/original){data-assetid=\"<assetId>\"}"
 *     }
 *   }
 *
 * A placeholder key is replaced as a whole token only, so `ph-page-1` never rewrites inside `ph-page-10`, while one
 * embedded after a hyphen (`collections.pageTypeId-ph-pt-2:paged`) is still found. A staged-image key takes the values
 * the asset upload returned: in Markdown an image (`![alt](path "title"){attrs}`) keeps its own alt, title and
 * attributes, takes `src` for its path and gains `data-assetid`; in a template, `src="path"` becomes `src` plus `data-assetid`; anywhere else the path becomes `src`.
 *
 *   node rewrite.mjs --root <dir> [--root <dir> …] --map <map.json> [--dry-run]
 *
 * It writes only inside the given roots, never through a symlink. Prints one JSON document. Exit codes: 0 rewritten
 * (or planned, with --dry-run), 2 a usage error or an invalid map, in which case nothing was written.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertWritable,
  fail,
  finish,
  PLACEHOLDER_ID,
  parseFlags,
  placeholderToken,
  realDir,
  ScriptError,
  STAGED_IMAGE_PREFIX,
  textFiles,
} from "./lib/placeholders.mjs";

/** A real CMS id: letters, digits, `-` and `_`, and never itself a placeholder. */
const REAL_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** The characters a staged-image path is made of; a match must not continue into one. */
const PATH_END = "(?![^\\s\"'()<>`{}\\\\])";

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Check every map entry before anything is written, so a bad map changes nothing. */
export function validateMap(map) {
  if (!map || typeof map !== "object" || Array.isArray(map)) throw new ScriptError("the map must be a JSON object");
  const ids = new Map();
  const images = new Map();
  for (const [key, value] of Object.entries(map)) {
    if (PLACEHOLDER_ID.test(key)) {
      if (typeof value !== "string" || !REAL_ID.test(value) || PLACEHOLDER_ID.test(value)) {
        throw new ScriptError(`${key} must map to a real CMS id string, got ${JSON.stringify(value)}`);
      }
      ids.set(key, value);
    } else if (key.startsWith(STAGED_IMAGE_PREFIX)) {
      if (!value || typeof value !== "object" || typeof value.src !== "string" || value.src === "") {
        throw new ScriptError(`${key} must map to { src, assetId, markdown } from the asset upload`);
      }
      for (const field of ["assetId", "markdown"]) {
        if (value[field] !== undefined && typeof value[field] !== "string") {
          throw new ScriptError(`${key}.${field} must be a string`);
        }
      }
      images.set(key, value);
    } else {
      throw new ScriptError(`${key} is neither a ph-<kind>-<n> placeholder nor a ${STAGED_IMAGE_PREFIX} image path`);
    }
  }
  return { ids, images };
}

/** A Leed image alt's dimension suffix, ` =1200x630`. */
const DIMENSIONS = /\s=\d*x\d*$/;

/**
 * One Markdown image of a staged file, pointed at its upload. The author's own alt text, title and attributes are
 * kept: only the path becomes `src`, and `data-assetid` is merged into the attribute block (replacing a stale one, or
 * in a new block). The upload's alt is used only for an image that had none, and its `=WxH` suffix is added to an alt
 * that has no dimensions of its own.
 */
function markdownImage(image, alt, title, attrs) {
  const uploadAlt = /^!\[([^\]\n]*)\]/.exec(image.markdown)?.[1] ?? "";
  const dimensions = DIMENSIONS.exec(uploadAlt)?.[0] ?? "";
  const ownAlt = alt.trim() === "" ? uploadAlt : DIMENSIONS.test(alt) ? alt : `${alt}${dimensions}`;
  const assetId = image.assetId ?? /data-assetid="([^"]*)"/.exec(image.markdown)?.[1];
  const kept = (attrs ?? "").replace(/(?:^|\s+)data-assetid=(?:"[^"]*"|'[^']*'|\S+)/g, "").trim();
  const merged = [kept, assetId ? `data-assetid="${assetId}"` : ""].filter(Boolean).join(" ");
  return `![${ownAlt}](${image.src}${title})${merged ? `{${merged}}` : ""}`;
}

/** `text` with every mapped image and placeholder replaced, and what was replaced. */
export function rewriteText(text, file, { ids, images }) {
  const counts = new Map();
  const count = (from, to, n) => {
    if (n === 0) return;
    const key = `${from}\u0000${to}`;
    counts.set(key, (counts.get(key) ?? 0) + n);
  };
  let out = text;
  const ext = path.extname(file).toLowerCase();

  for (const [sitePath, image] of images) {
    const quoted = escapeRegExp(sitePath);
    if (ext === ".md" && image.markdown) {
      const pattern = new RegExp(
        `!\\[([^\\]\\n]*)\\]\\(\\s*${quoted}(\\s+"[^"\\n]*")?\\s*\\)(?:\\{([^}\\n]*)\\})?`,
        "g",
      );
      out = out.replace(pattern, (_, alt, title, attrs) => {
        count(sitePath, image.src, 1);
        return markdownImage(image, alt, title ?? "", attrs);
      });
    }
    if ((ext === ".hbs" || ext === ".html") && image.assetId) {
      const pattern = new RegExp(`(\\ssrc=)(["'])${quoted}\\2`, "g");
      out = out.replace(pattern, (_, attr, q) => {
        count(sitePath, image.src, 1);
        return `${attr}${q}${image.src}${q} data-assetid=${q}${image.assetId}${q}`;
      });
    }
    out = out.replace(new RegExp(`${quoted}${PATH_END}`, "g"), () => {
      count(sitePath, image.src, 1);
      return image.src;
    });
  }

  out = out.replace(placeholderToken(), (token) => {
    const real = ids.get(token);
    if (real === undefined) return token;
    count(token, real, 1);
    return real;
  });

  const replacements = [...counts].map(([key, n]) => {
    const [from, to] = key.split("\u0000");
    return { from, to, count: n };
  });
  return { text: out, replacements };
}

/** Rewrite every text file under `roots` (real paths). Nothing is written with `dryRun`. */
export function rewrite(roots, map, { dryRun = false } = {}) {
  const parsed = validateMap(map);
  const files = [];
  const used = new Set();
  const pending = [];
  for (const root of roots) {
    for (const { rel, full } of textFiles(root)) {
      const before = fs.readFileSync(full, "utf-8");
      const { text, replacements } = rewriteText(before, rel, parsed);
      if (replacements.length === 0) continue;
      for (const { from } of replacements) used.add(from);
      // Checked for every file before the first write, so a refused path leaves the whole tree untouched.
      pending.push({ target: assertWritable(full, roots), text });
      files.push({ root, file: rel, replacements });
    }
  }
  if (!dryRun) for (const { target, text } of pending) fs.writeFileSync(target, text);
  const unused = Object.keys(map).filter((key) => !used.has(key));
  return { ok: true, dryRun, files, unused };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const flags = parseFlags(process.argv.slice(2), { repeatable: ["root"], booleans: ["dry-run"] });
    if (!flags.root) throw new ScriptError("--root is required");
    if (!flags.map) throw new ScriptError("--map is required");
    let map;
    try {
      map = JSON.parse(fs.readFileSync(flags.map, "utf-8"));
    } catch (error) {
      throw new ScriptError(`--map ${flags.map} could not be read as JSON: ${error.message}`);
    }
    const roots = flags.root.map((root) => realDir(root, "--root"));
    finish(rewrite(roots, map, { dryRun: flags["dry-run"] === true }));
  } catch (error) {
    fail(error);
  }
}
