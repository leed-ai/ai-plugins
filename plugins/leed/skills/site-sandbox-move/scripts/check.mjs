#!/usr/bin/env node
/**
 * Sandbox move, last step: prove nothing of the sandbox is left.
 *
 * Lists every `ph-<kind>-<n>` placeholder and every reference to a staged image under `/static/images/tmp/` that is
 * still in a text file under any `--root`: templates, data files, CSS and content. A move is finished only when this
 * finds nothing; a placeholder left behind is a link, author or menu that points at a record the CMS never made.
 *
 * With `--map` (the move's id map) and `--filled` (the move's filled list), it also lists every page the move created
 * as a placeholder but never filled: a page in the map that is not in the filled list. The rewrite has already put the
 * page's real id everywhere, so no placeholder gives it away, yet the CMS holds an empty page. A template page is never
 * filled: the site's home page is mapped, never created, and any other `.hbs` page has a locally minted id and no CMS
 * record at all. So a map entry whose real id is the `pageId` of a Handlebars template under a root's `src/` is not counted.
 *
 *   node check.mjs --root <dir> [--root <dir> …] [--map <move-map.json> --filled <move-filled.json>]
 *
 * Read-only. Prints one JSON document. Exit codes: 0 nothing left, 1 something left (each one is listed with its file
 * and line, each unfilled page with its ids), 2 a usage error.
 */

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { readFilled, readMappedPages } from "./lib/move-state.mjs";
import { fail, findTokens, finish, parseFlags, realDir, ScriptError, textFiles } from "./lib/placeholders.mjs";
import { frontmatterAnyPageId, frontmatterText, isTemplatePage } from "./lib/records.mjs";

/** Every leftover under `roots` (real paths), as `{ root, file, line, token, kind }`. */
export function leftovers(roots) {
  const found = [];
  for (const root of roots) {
    for (const { rel, full } of textFiles(root)) {
      for (const hit of findTokens(fs.readFileSync(full, "utf-8"))) found.push({ root, file: rel, ...hit });
    }
  }
  return found;
}

/** The real page ids the Handlebars templates under each root's `src/` name: the home page and every template page. */
function templatePageIds(roots) {
  const ids = new Set();
  for (const root of roots) {
    for (const { rel, full } of textFiles(root)) {
      if (!rel.startsWith("src/") || !isTemplatePage(rel)) continue;
      const front = frontmatterText(fs.readFileSync(full, "utf-8"));
      const pageId = front && frontmatterAnyPageId(front);
      if (pageId) ids.add(pageId);
    }
  }
  return ids;
}

/** Every mapped page that is not a template page and not filled, as `{ id, pageId }`. */
export function unfilledPages(roots, mappedPages, filled) {
  const templates = templatePageIds(roots);
  return [...mappedPages]
    .filter(([id, pageId]) => !templates.has(pageId) && !filled.has(id))
    .map(([id, pageId]) => ({ id, pageId }))
    .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const flags = parseFlags(process.argv.slice(2), { repeatable: ["root"] });
    if (!flags.root) throw new ScriptError("--root is required");
    if (Boolean(flags.map) !== Boolean(flags.filled)) {
      throw new ScriptError("--map and --filled go together: the map names the pages, the filled list the ones done");
    }
    const roots = flags.root.map((root) => realDir(root, "--root"));
    const found = leftovers(roots);
    const ids = [...new Set(found.map((hit) => hit.token))].sort();
    const result = { ok: found.length === 0, leftovers: found, ids };
    if (flags.map) {
      const unfilled = unfilledPages(roots, readMappedPages(flags.map), readFilled(flags.filled));
      Object.assign(result, { ok: result.ok && unfilled.length === 0, unfilled });
    }
    finish(result, result.ok ? 0 : 1);
  } catch (error) {
    fail(error);
  }
}
