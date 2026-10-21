#!/usr/bin/env node
/**
 * Sandbox move, step 2: the order the records are created in.
 *
 * The order is the CMS's own dependency order, the one its import process uses: page types first, then labels and
 * authors (so a page is created with its real ones), a placeholder page per `ph-page-*` (so links and menus have real
 * page ids to point at), the staged images and `ph-asset-*` ids, menus and their items, forms, search indexes, calls to
 * action and autolinks.
 * After every record is real come two terminal steps: copy the templates and CSS into the real checkout, then import
 * the content.
 *
 * Some dependencies point backwards on purpose, and are reported as notes rather than problems:
 *  - a documentation page type names its left menu and its search index; creating the page type creates both, so
 *    those records are mapped from the new page type rather than created (`createdWith`);
 *  - a documentation page type names its starting page, which is set on it once that page exists;
 *  - a page's images, assets, forms and links are content, applied in `import-content`, not when the placeholder
 *    page is created. Its labels and authors are not: they come before it, so `page-fields.mjs` can create the page
 *    with its real labels and summary, and its authors are set when the page is filled.
 * The site's root page type, its home page (`src/index.hbs`) and its Header and Footer menus exist in every Leed site,
 * so they are marked `existing`: the move maps them to the real records instead of creating them.
 *
 * A page defined by a Handlebars template (`src/about.hbs` naming `"pageId": "ph-page-2"`) is marked `template`: the
 * template is the page, copied in `copy-templates`. In the page step it gets a locally minted UUID from
 * `template-ids.mjs`, as provisioning gives the pages it writes, and no CMS record; `import-content` never lists it.
 * A `.md` page is content, created in the CMS in the page step and filled in `import-content`.
 *
 * Any other dependency on a later step, and any placeholder nothing defines, is a problem: the move cannot satisfy it.
 *
 * A plan is safe to re-run on resume. Each rewrite replaces placeholders in the sandbox with real ids, so a record
 * created in an earlier run is named by its real id, or (a page, a `ph-asset-*`) not named at all. `--map` (the move's
 * id map) is how the plan still accounts for it: every record the map names, by its placeholder or its real id, stays
 * in its step marked `done`, with its `placeholder` and `realId`, and is never created again. A page stays listed for
 * `import-content` by the real `pageId` its frontmatter now names, and `--filled` (the move's filled list) marks the
 * pages whose content an earlier run already imported.
 *
 *   node plan.mjs --root <sandbox-dir> [--map <move-map.json>] [--filled <move-filled.json>]
 *
 * Read-only. Prints one JSON document. Exit codes: 0 a plan with no problems, 1 a plan with problems, 2 a usage error.
 */

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { pagesOf, readFilled, readMap } from "./lib/move-state.mjs";
import {
  fail,
  finish,
  PLACEHOLDER_ID,
  parseFlags,
  realDir,
  ScriptError,
  siteSourceFiles,
  textFiles,
} from "./lib/placeholders.mjs";
import {
  addAssetRecords,
  collectRecords,
  collectReferences,
  DATA,
  frontmatterAnyPageId,
  frontmatterText,
  HOME_PAGE,
  isTemplatePage,
} from "./lib/records.mjs";

/** The record steps, in order. `asset` covers staged images and `ph-asset-*` ids. */
export const STEP_ORDER = [
  "pt",
  "label",
  "author",
  "page",
  "asset",
  "menu",
  "menuitem",
  "form",
  "index",
  "cta",
  "autolink",
];

const stepOf = (kind) => (kind === "image" ? "asset" : kind);

/**
 * The pages `import-content` deals with, as `{ file, id, pageId?, filled?, template? }`: each page still named by its
 * placeholder, and each page a `mappedPages` entry (placeholder to real id) names by its real `pageId`. The home page
 * is a template, copied with the rest; its CMS record already exists, so it is never listed. A page whose file is a
 * template is marked `template`: it is copied, never filled.
 */
function contentPages(root, records, mappedPages, filled) {
  const byFile = new Map();
  for (const record of records.values()) {
    if (record.kind !== "page" || record.seeded) continue;
    for (const file of record.definedIn) byFile.set(file, { file, id: record.id });
  }
  if (mappedPages.size > 0) {
    const placeholderOf = new Map([...mappedPages].map(([id, real]) => [real, id]));
    for (const { rel, full } of siteSourceFiles(root)) {
      if (rel === HOME_PAGE || rel.startsWith(`${DATA}/`) || byFile.has(rel)) continue;
      const front = frontmatterText(fs.readFileSync(full, "utf-8"));
      const pageId = front && frontmatterAnyPageId(front);
      if (pageId && placeholderOf.has(pageId)) byFile.set(rel, { file: rel, id: placeholderOf.get(pageId), pageId });
    }
  }
  return [...byFile.values()]
    .map((page) => (isTemplatePage(page.file) ? { ...page, template: true } : page))
    .map((page) => (filled.has(page.id) && !page.template ? { ...page, filled: true } : page))
    .sort((a, b) => a.file.localeCompare(b.file));
}

/**
 * Mark each record the id map names as done, and add to `records` one for each mapped placeholder the rewrite left nothing of in
 * the sandbox (a page's frontmatter `pageId` is read only while it is a placeholder; a `ph-asset-*` exists only where
 * it is named). Returns each done record's `{ placeholder, realId }` by record id.
 */
function markDone(records, { ids, images }, pages) {
  const done = new Map();
  const placeholderOf = new Map([...ids].map(([placeholder, realId]) => [realId, placeholder]));
  for (const record of records.values()) {
    if (ids.has(record.id)) done.set(record.id, { placeholder: record.id, realId: ids.get(record.id) });
    else if (placeholderOf.has(record.id))
      done.set(record.id, { placeholder: placeholderOf.get(record.id), realId: record.id });
    else if (record.kind === "image" && images.has(record.id)) {
      const image = images.get(record.id);
      done.set(record.id, { placeholder: record.id, realId: image.assetId ?? image.src });
    }
  }
  for (const [placeholder, realId] of ids) {
    if (records.has(placeholder) || records.has(realId)) continue;
    const kind = PLACEHOLDER_ID.exec(placeholder)[1];
    const definedIn = pages.filter((page) => page.id === placeholder).map((page) => page.file);
    const template = definedIn.length > 0 && definedIn.every(isTemplatePage);
    records.set(realId, { id: realId, kind, name: "", definedIn, dependsOn: [], ...(template ? { template } : {}) });
    done.set(realId, { placeholder, realId });
  }
  return done;
}

/**
 * The plan for the sandbox at `root` (a real path). `map` is the id map (`{ ids, images }`, as `readMap` returns it)
 * and `filled` the placeholder pages already imported, both from an earlier run of the move.
 */
export function plan(root, { map = { ids: new Map(), images: new Map() }, filled = new Set() } = {}) {
  const references = collectReferences(root);
  const records = addAssetRecords(collectRecords(root), references);
  const pages = contentPages(root, records, pagesOf(map.ids), filled);
  const done = markDone(records, map, pages);
  const problems = [];
  const createdWith = new Map();
  const undefinedIds = [...new Set(references.map((ref) => ref.token))].filter((id) => !records.has(id)).sort();
  for (const id of undefinedIds) {
    const where = references.find((ref) => ref.token === id);
    problems.push(`${id} is referenced (${where.file}:${where.line}) but nothing in the sandbox defines it`);
  }

  const notes = new Map();
  const note = (id, text) => notes.set(id, [...(notes.get(id) ?? []), text]);
  for (const record of records.values()) {
    if (record.seeded)
      note(record.id, "every Leed site already has this record: map it to the real one, do not create it");
    else if (record.template)
      note(
        record.id,
        "a template page: template-ids.mjs mints its id locally and the CMS gets no record; the template is copied in copy-templates and never filled",
      );
  }
  for (const record of records.values()) {
    const rank = STEP_ORDER.indexOf(stepOf(record.kind));
    for (const dependency of record.dependsOn) {
      const target = records.get(dependency);
      if (!target || STEP_ORDER.indexOf(stepOf(target.kind)) <= rank) continue;
      if (record.kind === "pt" && (target.kind === "menu" || target.kind === "index")) {
        createdWith.set(dependency, record.id);
        note(dependency, `created with ${record.id}: read its real id from the new page type, do not create it`);
      } else if (record.kind === "pt" && target.kind === "page") {
        note(record.id, `${dependency} is set on this page type once the page exists (its starting page)`);
      } else if (record.kind === "page") {
        note(record.id, `${dependency} is content: it is applied in import-content, after every record is real`);
      } else {
        problems.push(`${record.id} needs ${dependency}, which is created in a later step`);
      }
    }
  }

  const steps = [];
  for (const step of STEP_ORDER) {
    const ids = [...records.values()]
      .filter((record) => stepOf(record.kind) === step)
      .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }))
      .map((record) => ({
        id: record.id,
        kind: record.kind,
        name: record.name,
        definedIn: record.definedIn,
        dependsOn: record.dependsOn,
        ...(record.parent ? { parent: record.parent } : {}),
        ...(record.seeded ? { existing: true } : {}),
        ...(record.template ? { template: true } : {}),
        ...(createdWith.has(record.id) ? { createdWith: createdWith.get(record.id) } : {}),
        ...(notes.has(record.id) ? { notes: notes.get(record.id) } : {}),
        ...(done.has(record.id) ? { done: true, ...done.get(record.id) } : {}),
      }));
    if (ids.length > 0) steps.push({ step, ids });
  }

  // A page with a placeholder id is created on its own in the page step and filled here; everything else waiting
  // under leed-import/ goes through the bulk import, which mints its own ids.
  // A template page has no CMS record, so there is nothing to fill: it is copied with the templates.
  const filledPages = pages.filter((page) => !page.template);
  const pageFiles = filledPages.map((page) => page.file);
  const importFiles = textFiles(root)
    .map((file) => file.rel)
    .filter((file) => file.startsWith("leed-import/") && file.endsWith(".md") && !pageFiles.includes(file));
  steps.push({ step: "copy-templates", from: root });
  steps.push({ step: "import-content", pageFiles, pages: filledPages, importFiles });
  return { ok: problems.length === 0, root, steps, problems };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const flags = parseFlags(process.argv.slice(2));
    if (flags.filled && !flags.map) throw new ScriptError("--filled needs --map: the map names the pages it lists");
    const result = plan(realDir(flags.root, "--root"), {
      ...(flags.map ? { map: readMap(flags.map) } : {}),
      filled: flags.filled ? readFilled(flags.filled) : new Set(),
    });
    finish(result, result.ok ? 0 : 1);
  } catch (error) {
    fail(error);
  }
}
