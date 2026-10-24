#!/usr/bin/env node
/**
 * Leed site audit: the deterministic half of the site-audit skill.
 *
 * Checks a site repo's templates (`src/**`) and stylesheets (`tailwind/**`) against the
 * site-patterns rules and reports every finding with its rule number, file and line.
 * It only reads files and prints a report: it never writes, deletes or fetches anything.
 *
 *   node audit.mjs [--root <dir>] [--app-root <dir>] [--eject-json <file|->] [--json]
 *   node audit.mjs --changed <file> [<file>...] [--root <dir>] [--app-root <dir>] [--json]
 *   node audit.mjs --print-constants
 *
 * Exit codes: 0 no error findings, 1 at least one error finding, 2 usage error.
 * Plain Node ESM with no dependencies, so it runs with node or bun in any site repo, offline.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { constants } from "./lib/constants.mjs";
import { checkMissingLayouts, namedLayouts } from "./lib/layouts.mjs";
import { auditStyle } from "./lib/styles.mjs";
import { auditTemplate } from "./lib/templates.mjs";
import { isArchived, isLeedOwned, Report, readText, siteFiles, toRel, UsageError } from "./lib/text.mjs";
import { checkSiteTokens } from "./lib/tokens.mjs";
import { checkUnusedAndTier, parseEjectJson } from "./lib/used.mjs";

function isSiteRepo(root) {
  try {
    return fs.statSync(path.join(root, "src")).isDirectory();
  } catch {
    return false;
  }
}

/** Narrows the site's files to the changed ones; anything else (deleted, data, scripts) is noted and skipped. */
function changedFiles(root, all, changed, report) {
  const wanted = new Set();
  for (const file of changed) {
    const rel = toRel(root, path.resolve(root, file));
    if (isArchived(rel)) report.note(`skipped ${file}: in an _archive folder, which the build ignores`);
    else if (isLeedOwned(rel)) report.note(`skipped ${file}: a Leed template the CLI provides`);
    else if (all.templates.includes(rel) || all.styles.includes(rel)) wanted.add(rel);
    else report.note(`skipped ${file}: deleted, or not a template or stylesheet the audit checks`);
  }
  report.note("changed-files mode: missing layouts, unset tokens and unreferenced files were not checked");
  return {
    templates: all.templates.filter((rel) => wanted.has(rel)),
    styles: all.styles.filter((rel) => wanted.has(rel)),
  };
}

/**
 * Runs the audit and returns the report. `options`: `root` (default the cwd), `appRoot` (the installed
 * CLI's `dist/`), `ejectJson` (a file holding `leed site eject --json`, or `-`), `changed` (files to
 * audit on their own; null for a full audit).
 */
export function audit(options) {
  const root = path.resolve(options.root ?? process.cwd());
  if (!isSiteRepo(root)) throw new UsageError(`${root} is not a Leed site repo (no src/ directory)`);
  const appRoot = options.appRoot ? path.resolve(options.appRoot) : null;
  const eject = options.ejectJson ? parseEjectJson(options.ejectJson) : null;
  const read = (rel) => readText(root, rel);
  const report = new Report();
  const all = siteFiles(root);
  const full = !options.changed;
  const scope = full ? all : changedFiles(root, all, options.changed, report);

  for (const rel of scope.templates) {
    if (!full && rel.endsWith(".md")) report.note(`skipped ${rel}: Markdown pages are not checked`);
    const text = read(rel);
    if (text !== null && !isLeedOwned(rel)) auditTemplate(rel, text, report);
  }
  const styleDecls = new Map();
  for (const rel of scope.styles) {
    const text = read(rel);
    if (text !== null) styleDecls.set(rel, auditStyle(rel, text, report, read));
  }
  // In changed-files mode a --site-* literal is checked in any changed stylesheet, theme.css or not.
  if (full || styleDecls.size > 0) checkSiteTokens(appRoot, styleDecls, report, full);

  if (full) {
    // Leed's own partials are replaced by the build, so what they call is read from the app root instead.
    // A disabled scaffold is followed only if something calls it, and the layout it names is not checked.
    const site = { ...all, templates: all.templates.filter((rel) => !rel.startsWith("src/_includes/leed/")) };
    const pages = [...all.html, ...all.staticPages];
    const named = namedLayouts(root, [...all.templates.filter((rel) => !isLeedOwned(rel)), ...pages], read);
    checkMissingLayouts(root, named, appRoot, report);
    checkUnusedAndTier(root, site, named, eject, appRoot, report, read);
  }

  const findings = report.result();
  const result = { root, mode: full ? "full" : "changed", findings, justified: report.justified };
  result.tier = eject ? eject.tier : null;
  if (eject)
    result.ejectable = eject.templates.map(({ name, customized }) => ({ name, customized: Boolean(customized) }));
  result.notes = report.notes;
  result.summary = {
    error: findings.filter((f) => f.severity === "error").length,
    review: findings.filter((f) => f.severity === "review").length,
  };
  return result;
}

/** A comment on one line, cut short for the text report; the JSON report keeps it whole. */
function oneLine(comment, max = 160) {
  const flat = comment.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function formatText(result) {
  const lines = [];
  for (const f of result.findings) {
    const at = f.line > 0 ? `${f.file}:${f.lines.join(",")}` : f.file;
    lines.push(`${at}  ${f.severity}  rule ${f.rule} (${f.check})  ${f.message}`);
    lines.push(`    fix: ${f.fix}`);
  }
  for (const j of result.justified) {
    const what = j.check === "hand-filtered-collection" ? "custom loop, comment above it" : "allowed by comment";
    lines.push(
      `${j.file}:${j.line}  justified  rule ${j.rule} (${j.check})  ${what}: "${oneLine(j.comment)}"; confirm the reason`,
    );
  }
  for (const note of result.notes) lines.push(`note: ${note}`);
  lines.push(`${result.summary.error} error(s), ${result.summary.review} to review`);
  return lines.join("\n");
}

const USAGE = `usage: audit.mjs [--root <dir>] [--app-root <dir>] [--eject-json <file|->] [--json]
       audit.mjs --changed <file> [<file>...] [--root <dir>] [--app-root <dir>] [--json]
       audit.mjs --print-constants`;

const OPTIONS = {
  root: { type: "string" },
  "app-root": { type: "string" },
  "eject-json": { type: "string" },
  changed: { type: "string", multiple: true },
  json: { type: "boolean", default: false },
  "print-constants": { type: "boolean", default: false },
  help: { type: "boolean", short: "h", default: false },
};

function usageError(message) {
  process.stderr.write(`${message}\n${USAGE}\n`);
  return 2;
}

export function main(argv) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, allowPositionals: true, options: OPTIONS });
  } catch (error) {
    return usageError(error.message);
  }
  const { values, positionals } = parsed;
  if (values.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  if (values["print-constants"]) {
    process.stdout.write(`${JSON.stringify(constants(), null, 2)}\n`);
    return 0;
  }
  if (positionals.length > 0 && !values.changed) return usageError(`unexpected argument ${positionals[0]}`);
  try {
    const result = audit({
      root: values.root,
      appRoot: values["app-root"],
      ejectJson: values["eject-json"],
      changed: values.changed ? [...values.changed, ...positionals] : null,
    });
    process.stdout.write(`${values.json ? JSON.stringify(result, null, 2) : formatText(result)}\n`);
    return result.summary.error > 0 ? 1 : 0;
  } catch (error) {
    if (error instanceof UsageError) return usageError(error.message);
    throw error;
  }
}

/** True when this file is the entry point. Node resolves import.meta.url through symlinks, so compare real paths. */
function isEntryPoint() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  process.exitCode = main(process.argv.slice(2));
}
