#!/usr/bin/env node
/**
 * Sandbox move, page step: a local id for each template page.
 *
 * A template page is a Handlebars file under `src/` whose frontmatter names a `ph-page-*` id (`src/about.hbs`, a
 * contact page), other than the home page. Leed treats such a page the way provisioning does: the template IS the
 * page, its `pageId` is a UUID minted locally (provisioning's `performTemplateReplacements` fills `###NEW_PAGE_ID###`
 * with a v4 UUID), and the CMS holds no record for it. The build resolves a `pageid:` link or a menu item to it from
 * the pages it rendered, so nothing else is needed. This adds `"<placeholder>": "<v4 uuid>"` to the id map for every
 * template page the map does not name yet; the rewrite then writes the id into the template.
 *
 *   node template-ids.mjs --root <sandbox-dir> --map <move-map.json> [--dry-run]
 *
 * It writes only the map, and only when it adds an id; a page already mapped keeps its id, so a re-run adds nothing.
 * A map that does not exist yet is created. Prints one JSON document, `{ ok, dryRun, added, kept }`. Exit codes: 0
 * done (or planned), 2 a usage error, in which case nothing was written.
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readMap } from "./lib/move-state.mjs";
import { fail, finish, parseFlags, realDir, ScriptError } from "./lib/placeholders.mjs";
import { collectRecords } from "./lib/records.mjs";

/** The template pages of the sandbox at `root` (a real path), as `{ id, file }`, sorted by id. */
export function templatePages(root) {
  return [...collectRecords(root).values()]
    .filter((record) => record.kind === "page" && record.template)
    .map((record) => ({ id: record.id, file: record.definedIn[0] }))
    .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
}

/** Add a local id to the map file for every template page it lacks. */
export function mintTemplateIds(root, mapFile, { dryRun = false } = {}) {
  const exists = fs.existsSync(mapFile);
  const { ids } = exists ? readMap(mapFile) : { ids: new Map() };
  const raw = exists ? JSON.parse(fs.readFileSync(mapFile, "utf-8")) : {};
  const added = [];
  const kept = [];
  for (const page of templatePages(root)) {
    if (ids.has(page.id)) kept.push({ ...page, pageId: ids.get(page.id) });
    else {
      const pageId = randomUUID();
      raw[page.id] = pageId;
      added.push({ ...page, pageId });
    }
  }
  if (!dryRun && added.length > 0) {
    if (exists && fs.lstatSync(mapFile).isSymbolicLink()) throw new ScriptError(`--map ${mapFile} is a symlink`);
    fs.mkdirSync(path.dirname(mapFile), { recursive: true });
    fs.writeFileSync(mapFile, `${JSON.stringify(raw, null, 2)}\n`);
  }
  return { ok: true, dryRun, added, kept };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const flags = parseFlags(process.argv.slice(2), { booleans: ["dry-run"] });
    if (!flags.map) throw new ScriptError("--map is required");
    const root = realDir(flags.root, "--root");
    finish(mintTemplateIds(root, path.resolve(flags.map), { dryRun: flags["dry-run"] === true }));
  } catch (error) {
    fail(error);
  }
}
