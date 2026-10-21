#!/usr/bin/env node
/**
 * Sandbox move, step 1: list every placeholder record a sandbox site holds.
 *
 * Reads the sandbox's data files, page type data, templates, CSS and staged content, and reports each `ph-<kind>-<n>`
 * id and each staged image under `src/static/images/tmp/`: where it is defined, and every file and line that refers
 * to it. A reference with no definition is listed under `undefined`, because the move could not create it.
 *
 *   node inventory.mjs --root <sandbox-dir>
 *
 * Read-only: it never writes, and never follows a symlink. Prints one JSON document. Exit codes: 0 an inventory was
 * produced, 2 a usage error. Plain Node ESM with no dependencies; runs with node or bun.
 */

import { pathToFileURL } from "node:url";
import { fail, finish, PLACEHOLDER_KINDS, parseFlags, realDir } from "./lib/placeholders.mjs";
import { addAssetRecords, collectRecords, collectReferences } from "./lib/records.mjs";

/** The inventory of the sandbox at `root` (a real path). */
export function inventory(root) {
  const references = collectReferences(root);
  const records = addAssetRecords(collectRecords(root), references);
  const byId = new Map();
  for (const ref of references) {
    const list = byId.get(ref.token) ?? [];
    list.push({ file: ref.file, line: ref.line });
    byId.set(ref.token, list);
  }

  const kinds = Object.fromEntries([...PLACEHOLDER_KINDS, "image"].map((kind) => [kind, []]));
  for (const record of records.values()) {
    kinds[record.kind].push({
      id: record.id,
      name: record.name,
      definedIn: record.definedIn,
      references: byId.get(record.id) ?? [],
    });
  }
  for (const list of Object.values(kinds)) list.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));

  const undefinedRefs = [...byId.keys()]
    .filter((id) => !records.has(id))
    .sort()
    .map((id) => ({ id, references: byId.get(id) }));
  const totals = Object.fromEntries(Object.entries(kinds).map(([kind, list]) => [kind, list.length]));
  return { ok: true, root, totals, kinds, undefined: undefinedRefs };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const flags = parseFlags(process.argv.slice(2));
    finish(inventory(realDir(flags.root, "--root")));
  } catch (error) {
    fail(error);
  }
}
