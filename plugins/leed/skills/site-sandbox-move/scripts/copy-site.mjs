#!/usr/bin/env node
/**
 * Sandbox move: copy the sandbox's own site files into the real site checkout.
 *
 * Copies what the site repository owns — Handlebars templates under `src/`, everything under `tailwind/`, and the
 * site's own files under `src/static/` — and nothing the CMS owns or the build makes. It never copies `identity.json`,
 * `src/_data/`, any `*.11tydata.json`, page content (`.md`), the staged images under `src/static/images/tmp/` (the
 * asset upload replaced them), the CMS's favicon and logo, Leed's generated `leed-*` files, the build's versioned
 * scripts and installed web fonts, or `leed-import/`.
 *
 * A file that still holds a placeholder or a staged-image reference is never copied: it is listed under `held`, so
 * nothing of the sandbox reaches the real checkout. `--layouts` copies only `src/_layouts/`, which is what the move
 * pushes before it creates the page types, because the CMS refuses a page type whose layout is not on staging.
 *
 * A template that replaces one whose frontmatter names a `pageId` keeps that `pageId`: it is the id the CMS minted for
 * the real page (the home page's at provisioning), and losing it would orphan the page and every `pageid:` link to it.
 * Each such file is listed under `keptPageId`. A template that would replace one with a `pageId` but has no
 * frontmatter of its own to carry it is held instead.
 *
 *   node copy-site.mjs --from <sandbox-dir> --to <site-checkout> [--layouts] [--dry-run]
 *
 * `--from` must be a sandbox (its identity.json names non-cms-company) and `--to` a real checkout (an identity.json
 * naming any other company). It writes only inside `--to`, never through a symlink, and never follows one in the
 * sandbox. Prints one JSON document listing what it created and overwrote. Exit codes: 0 copied (or planned), 2 a
 * usage error, in which case nothing was written.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertWritable,
  fail,
  findTokens,
  finish,
  parseFlags,
  realDir,
  ScriptError,
  toRel,
} from "./lib/placeholders.mjs";

const SANDBOX_COMPANY_ID = "non-cms-company";

/** The copied files that can hold a placeholder; images and fonts cannot. */
const TEXT = /\.(?:hbs|css|js|mjs|json|html|txt|svg)$/i;

/** Directories the copy never enters, relative to the sandbox root. */
const SKIPPED_DIRS = new Set([
  "node_modules",
  ".build",
  "leed-import",
  "src/_data",
  "src/_includes/leed",
  "src/static/images/tmp",
  "src/static/webfonts",
]);

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const PAGE_ID = /("pageId"\s*:\s*)"([^"]*)"/;

/** The `pageId` in a template's JSON frontmatter, if it names one. */
function frontmatterPageId(text) {
  const front = FRONTMATTER.exec(text)?.[1];
  return front ? PAGE_ID.exec(front)?.[2] : undefined;
}

/** `source` with its frontmatter `pageId` set to `pageId`, or null when it has no JSON frontmatter to carry one. */
function withPageId(source, pageId) {
  const match = FRONTMATTER.exec(source);
  if (!match) return null;
  const front = match[1];
  let merged;
  if (PAGE_ID.test(front)) merged = front.replace(PAGE_ID, (_, key) => `${key}${JSON.stringify(pageId)}`);
  else if (/^\s*\{/.test(front)) {
    const comma = /^\s*\{\s*\}/.test(front) ? "" : ",";
    merged = front.replace("{", `{\n  "pageId": ${JSON.stringify(pageId)}${comma}`);
  } else return null;
  return source.replace(match[0], () => match[0].replace(front, () => merged));
}

/** Whether the sandbox file at `rel` is one the site repository owns. */
export function copied(rel) {
  const name = path.posix.basename(rel);
  if (name.startsWith("leed-") || name.endsWith(".11tydata.json")) return false;
  if (rel.startsWith("tailwind/")) return true;
  if (rel.startsWith("src/static/")) {
    if (/^src\/static\/js\/l\.[^/]+\.js$/.test(rel)) return false;
    if (/^src\/static\/images\/(?:favicon|logo)-/.test(rel)) return false;
    return true;
  }
  return rel.startsWith("src/") && rel.endsWith(".hbs");
}

function companyOf(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, "identity.json"), "utf-8")).companyId;
  } catch {
    return undefined;
  }
}

/** The files to copy from the sandbox at `from` (a real path), sorted. Symlinks are never followed. */
function sourceFiles(from) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      const rel = toRel(from, full);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(rel) && !SKIPPED_DIRS.has(entry.name)) walk(full);
      } else if (entry.isFile() && copied(rel)) out.push(rel);
    }
  };
  walk(from);
  return out;
}

/** Copy the site files from the sandbox `from` into the checkout `to` (both real paths). */
export function copySite(from, to, { dryRun = false, layouts = false } = {}) {
  if (companyOf(from) !== SANDBOX_COMPANY_ID) throw new ScriptError(`--from ${from} is not a sandbox site`);
  const company = companyOf(to);
  if (!company || company === SANDBOX_COMPANY_ID) {
    throw new ScriptError(`--to ${to} is not a real Leed site checkout; run /leed:setup to get one`);
  }
  const created = [];
  const overwritten = [];
  const held = [];
  const keptPageId = [];
  const plan = [];
  // Every target is checked before the first write, so a refused path leaves the checkout untouched.
  for (const rel of sourceFiles(from)) {
    if (layouts && !rel.startsWith("src/_layouts/")) continue;
    const source = path.join(from, ...rel.split("/"));
    const leftovers = TEXT.test(rel) ? findTokens(fs.readFileSync(source, "utf-8")) : [];
    if (leftovers.length > 0) {
      held.push({ file: rel, tokens: [...new Set(leftovers.map((hit) => hit.token))] });
      continue;
    }
    const target = assertWritable(path.join(to, ...rel.split("/")), [to]);
    const exists = fs.lstatSync(target, { throwIfNoEntry: false }) !== undefined;
    let text;
    if (exists && rel.endsWith(".hbs")) {
      const realId = frontmatterPageId(fs.readFileSync(target, "utf-8"));
      const sourceText = fs.readFileSync(source, "utf-8");
      if (realId !== undefined && frontmatterPageId(sourceText) !== realId) {
        text = withPageId(sourceText, realId);
        if (text === null) {
          held.push({ file: rel, tokens: [], reason: `it has no frontmatter to keep the real pageId ${realId}` });
          continue;
        }
        keptPageId.push({ file: rel, pageId: realId });
      }
    }
    (exists ? overwritten : created).push(rel);
    plan.push({ source, target, text });
  }
  if (!dryRun) {
    for (const { source, target, text } of plan) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (text === undefined) fs.copyFileSync(source, target);
      else fs.writeFileSync(target, text);
    }
  }
  return { ok: true, dryRun, from, to, created, overwritten, held, keptPageId };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const flags = parseFlags(process.argv.slice(2), { booleans: ["dry-run", "layouts"] });
    const from = realDir(flags.from, "--from");
    const to = realDir(flags.to, "--to");
    finish(copySite(from, to, { dryRun: flags["dry-run"] === true, layouts: flags.layouts === true }));
  } catch (error) {
    fail(error);
  }
}
