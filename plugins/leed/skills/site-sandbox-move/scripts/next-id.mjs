#!/usr/bin/env node
/**
 * The next free placeholder id of a kind, for a skill that adds a record to a sandbox site.
 *
 * A skill working in a sandbox writes records into `src/_data` itself instead of asking the CMS, and names each one
 * with a placeholder the move will later replace. This returns `ph-<kind>-<max + 1>` over every id of that kind
 * already in the sandbox, defined or referenced, so two records never share one.
 *
 *   node next-id.mjs --root <sandbox-dir> --kind <kind> [--count <n>]
 *
 * Kinds: pt, page, label, author, menu, menuitem, form, asset, cta, index, autolink. Read-only. Prints one JSON
 * document, `{ ok, kind, ids }`. Exit codes: 0 ids allocated, 2 a usage error.
 */

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import {
  fail,
  finish,
  PLACEHOLDER_KINDS,
  parseFlags,
  placeholderToken,
  realDir,
  ScriptError,
  textFiles,
} from "./lib/placeholders.mjs";

/** The next `count` free ids of `kind` in the sandbox at `root` (a real path). */
export function nextIds(root, kind, count = 1) {
  if (!PLACEHOLDER_KINDS.includes(kind)) {
    throw new ScriptError(`--kind ${kind} is not one of ${PLACEHOLDER_KINDS.join(", ")}`);
  }
  let max = 0;
  for (const { full } of textFiles(root)) {
    for (const match of fs.readFileSync(full, "utf-8").matchAll(placeholderToken())) {
      if (match[1] === kind) max = Math.max(max, Number(match[2]));
    }
  }
  return Array.from({ length: count }, (_, i) => `ph-${kind}-${max + i + 1}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const flags = parseFlags(process.argv.slice(2));
    const count = flags.count === undefined ? 1 : Number(flags.count);
    if (!Number.isInteger(count) || count < 1 || count > 1000) throw new ScriptError("--count must be 1 to 1000");
    if (!flags.kind) throw new ScriptError("--kind is required");
    finish({ ok: true, kind: flags.kind, ids: nextIds(realDir(flags.root, "--root"), flags.kind, count) });
  } catch (error) {
    fail(error);
  }
}
