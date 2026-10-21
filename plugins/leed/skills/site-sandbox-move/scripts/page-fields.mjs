#!/usr/bin/env node
/**
 * Sandbox move: the fields a sandbox page carries, split by the call that sets them.
 *
 * `leed page create` reads `title`, `slug`, `summary`, `labels` and `keywords` from a piped document's frontmatter and
 * drops every other key; `leed page update` writes the body only. So a page's metadata reaches the CMS in two parts:
 *
 *  - `create.document`: a placeholder document whose frontmatter holds exactly the fields `leed page create` applies,
 *    piped into it in the page step. Labels come before pages in the plan, so by then they are real ids;
 *  - `metadata.fields`: every other field of the page's frontmatter (`authors`, `featureImage`, `formId`, …), which no
 *    `leed` command sets. They are applied with the CMS `update_page_metadata` tool once the page is filled.
 *
 * `pageId` and `pageTypeId` are reported on their own: the first is the id being mapped, the second is the page
 * create's `--page-type-id`. `path` is derived by the CMS and never set.
 *
 * A Handlebars page (`src/about.hbs`) is a template page: it has no CMS record (`template-ids.mjs` gives it a local
 * id), so it has no fields to split, and is refused with exit 2.
 *
 *   node page-fields.mjs --root <sandbox-dir> --file <page file, relative to the root>
 *
 * Read-only. Prints one JSON document. Exit codes: 0 the create fields and page type hold no placeholder or staged
 * image, 1 they still do (each is listed under `create.unresolved`; map and rewrite first), 2 a usage error.
 * `metadata.unresolved` lists what the other fields still name; it must be empty before they are applied.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fail, findTokens, finish, inside, parseFlags, realDir, ScriptError } from "./lib/placeholders.mjs";
import { frontmatterText, isTemplatePage, parseFrontmatter } from "./lib/records.mjs";

/** The frontmatter keys `leed page create` applies (the CMS validator's modeled keys). */
export const CREATE_KEYS = ["title", "slug", "summary", "labels", "keywords"];

/** Keys reported separately or never sent. */
const OWN_KEYS = new Set(["pageId", "pageTypeId", "path"]);

const unresolvedIn = (value) => [...new Set(findTokens(JSON.stringify(value ?? null)).map((hit) => hit.token))].sort();

/** The page file `rel` under `root` (a real path), refusing a symlink or a path out of the root. */
function readPage(root, rel) {
  if (!rel) throw new ScriptError("--file is required");
  const full = path.resolve(root, rel);
  if (!inside(root, full)) throw new ScriptError(`--file ${rel} is outside --root`);
  let stat;
  try {
    stat = fs.lstatSync(full);
  } catch {
    throw new ScriptError(`--file ${rel} does not exist`);
  }
  if (stat.isSymbolicLink()) throw new ScriptError(`--file ${rel} is a symlink; the move never reads through one`);
  if (!stat.isFile()) throw new ScriptError(`--file ${rel} is not a file`);
  if (!inside(root, fs.realpathSync(full))) throw new ScriptError(`--file ${rel} is outside --root`);
  return fs.readFileSync(full, "utf-8");
}

/** The fields of the page at `rel` under `root`, split as the module comment describes. */
export function pageFields(root, rel) {
  const front = frontmatterText(readPage(root, rel));
  if (front === null) throw new ScriptError(`${rel} has no frontmatter`);
  const fields = parseFrontmatter(front);
  if (!fields) throw new ScriptError(`${rel} has frontmatter that is not valid JSON`);
  if (typeof fields.pageId !== "string") throw new ScriptError(`${rel} names no pageId`);

  if (isTemplatePage(rel)) {
    throw new ScriptError(
      `${rel} is a template page: it gets a local id from template-ids.mjs and no CMS record, so it has no fields to set`,
    );
  }
  const createFields = {};
  const metadata = {};
  for (const [key, value] of Object.entries(fields)) {
    if (CREATE_KEYS.includes(key)) createFields[key] = value;
    else if (!OWN_KEYS.has(key)) metadata[key] = value;
  }
  const pageTypeId = typeof fields.pageTypeId === "string" ? fields.pageTypeId : undefined;
  const createUnresolved = unresolvedIn([pageTypeId, createFields]);
  return {
    ok: createUnresolved.length === 0,
    file: rel,
    pageId: fields.pageId,
    ...(pageTypeId ? { pageTypeId } : {}),
    create: {
      document: `---\n${JSON.stringify(createFields, null, 2)}\n---\n\nPlaceholder.\n`,
      unresolved: createUnresolved,
    },
    metadata: { fields: metadata, unresolved: unresolvedIn(metadata) },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const flags = parseFlags(process.argv.slice(2));
    const result = pageFields(realDir(flags.root, "--root"), flags.file);
    finish(result, result.ok ? 0 : 1);
  } catch (error) {
    fail(error);
  }
}
