import fs from "node:fs";
import path from "node:path";
import {
  BUILD_USED_INCLUDES,
  EJECT_TEMPLATES,
  LOOKUP_PARTIALS,
  PARTIAL_SHORTCODES,
  STARTER_LAYOUT,
  TAILWIND_ENTRY,
} from "./constants.mjs";
import { dataFileValue, frontmatter, frontmatterValue, UNKNOWN } from "./frontmatter.mjs";
import { globalDataFiles, globalValue, layoutFile, templateDataFiles } from "./layouts.mjs";
import { blank, blankMarkdownCode, CSS_COMMENT, HBS_COMMENT, isLeedOwned, UsageError, walk } from "./text.mjs";

/** Repo-wide check: what the build uses (rule 13). Layouts named anywhere (rule 8) are in layouts.mjs. */

function partialFile(name) {
  const clean = name
    .replace(/^\[(.*)\]$/, "$1")
    .replace(/^["']|["']$/g, "")
    .replace(/^\.\//, "")
    .replace(/\.hbs$/, "");
  return `src/_includes/${clean}.hbs`;
}

const PARTIAL_CALL = /\{\{~?\s*#?>\s*(\(|"[^"]+"|'[^']+'|\[[^\]]*\]|[^\s}~]+)([^}]*)/g;
/**
 * A partial-rendering shortcode wherever a helper call can stand: a mustache (`{{ x }}`, `{{{ x }}}`,
 * `{{~{ x }~}}`, `{{& x }}`, a block `{{# x }}`, `{{else x }}`) or a subexpression `(x "name")`.
 * Eleventy registers every shortcode as a Handlebars helper, so each form renders the partial.
 */
const SHORTCODE_CALL = new RegExp(
  `(?:\\{\\{~?\\{?~?\\s*(?:[#^&]\\s*|else\\s+)?|\\(\\s*)(?:${PARTIAL_SHORTCODES.join("|")})(?=[\\s)}~])\\s*([^\\s)}~]*)`,
  "g",
);
const LOOKUP_CALL = /\{\{~?\s*#?>\s*\(\s*lookup\s+(?:\.|this)\s+["']([\w-]+)["']\s*\)/g;

/**
 * Leed partials that render a partial named by a hash value (`{{> (lookup . "header") }}`): read from
 * Leed's own `_includes` when the app root is known, else the built-in list.
 */
export function lookupPartials(appRoot) {
  if (!appRoot) return LOOKUP_PARTIALS;
  const includes = path.join(appRoot, "static", "site", "_includes");
  const found = [];
  for (const file of walk(includes)) {
    if (!file.endsWith(".hbs")) continue;
    const partial = path
      .relative(includes, file)
      .split(path.sep)
      .join("/")
      .replace(/\.hbs$/, "");
    for (const match of fs.readFileSync(file, "utf-8").matchAll(LOOKUP_CALL)) found.push({ partial, key: match[1] });
  }
  return found.length > 0 ? found : LOOKUP_PARTIALS;
}

/**
 * Partials a template uses, and whether it names one by a computed value: `{{> name}}` and
 * `{{#> name}}`, a partial-rendering shortcode's argument (`{{ svgDiagram "svg/chart-1" }}`), and the
 * hash value a Leed lookup partial renders (`{{#> leed/docs/shell header="my-header" }}`).
 */
export function partialRefs(text, lookups = LOOKUP_PARTIALS) {
  const refs = [];
  let dynamic = false;
  for (const match of text.matchAll(PARTIAL_CALL)) {
    if (match[1] === "(") {
      dynamic = true;
      continue;
    }
    if (match[1].startsWith("@")) continue;
    const name = partialFile(match[1]);
    refs.push(name);
    for (const { partial, key } of lookups) {
      if (name !== `src/_includes/${partial}.hbs`) continue;
      const value = match[2].match(new RegExp(`(?:^|\\s)${key}\\s*=\\s*(["'][^"']*["']|[^\\s~]+)`));
      if (!value) {
        // With no hash value the partial reads the key from its context: another object than the page's is unknown.
        const context = match[2]
          .replace(/\b[\w-]+\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/g, " ")
          .trim()
          .split(/\s+/)[0];
        if (context && !["this", ".", "~", "/"].includes(context)) dynamic = true;
        continue;
      }
      if (/^["'][^"']+["']$/.test(value[1])) refs.push(partialFile(value[1]));
      else dynamic = true;
    }
  }
  for (const match of text.matchAll(SHORTCODE_CALL)) {
    if (/^["'][\w/-]+["']$/.test(match[1])) refs.push(partialFile(match[1]));
    else dynamic = true;
  }
  return { refs, dynamic };
}

/**
 * A value a lookup partial may read from the page context when the call passes no hash value: from
 * `values` (frontmatter or data-file values of each key). A value the script cannot read is unknown.
 */
function lookupValueRefs(values) {
  const refs = [];
  let dynamic = false;
  for (const value of values) {
    if (value === UNKNOWN) dynamic = true;
    else if (typeof value === "string" && /^[\w/.-]+$/.test(value.trim())) refs.push(partialFile(value.trim()));
  }
  return { refs, dynamic };
}

/** Lookup-key values every page may inherit: from template and directory data files, and from global data. */
function dataLookupRefs(root, lookups, read) {
  const values = [];
  const dataFiles = templateDataFiles(root);
  for (const { key } of lookups) {
    for (const rel of dataFiles) values.push(dataFileValue(rel, read(rel) ?? "", key));
    for (const rel of globalDataFiles(root, key)) values.push(globalValue(rel, read(rel) ?? ""));
  }
  return lookupValueRefs(values);
}

/**
 * Stylesheets an `@import` or `@reference` names. Tailwind resolves a relative import with the `.css`
 * extension or a directory's `index.css` added when the name has none, so each of those counts too.
 */
function cssImports(rel, text) {
  const masked = text.replace(CSS_COMMENT, blank);
  return [...masked.matchAll(/@(?:import|reference)\s+(?:url\(\s*)?(?:"([^"]+)"|'([^']+)'|([^\s"')]+)\s*\))/g)]
    .map((m) => (m[1] ?? m[2] ?? m[3]).split(/[?#]/)[0])
    .filter((target) => target.startsWith("."))
    .flatMap((target) => {
      const file = path.posix.normalize(path.posix.join(path.posix.dirname(rel), target));
      return file.endsWith(".css") ? [file] : [file, `${file}.css`, `${file}/index.css`];
    });
}

/** `leed site eject --json` output: the whole envelope, or its `data`. `-` reads stdin. */
export function parseEjectJson(source) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(source === "-" ? 0 : source, "utf-8"));
  } catch (error) {
    throw new UsageError(`cannot read --eject-json ${source} as JSON (${error.message}); run leed site eject --json`);
  }
  const data = parsed && typeof parsed === "object" && "data" in parsed ? parsed.data : parsed;
  if (!data || !Array.isArray(data.templates)) {
    throw new UsageError(`--eject-json ${source} has no templates list; run leed site eject --json`);
  }
  return { tier: data.tier ?? null, templates: data.templates };
}

/** The set of files the build uses: by name, by reference from a used file, or by import. */
function usedFiles(root, files, named, eject, appRoot, read) {
  const used = new Set([...BUILD_USED_INCLUDES, STARTER_LAYOUT, ...EJECT_TEMPLATES.map((t) => t.destination)]);
  for (const t of eject?.templates ?? []) if (t.destination) used.add(t.destination);
  for (const { layout, unknown } of named) if (!unknown) used.add(`src/_layouts/${layoutFile(layout)}`);
  const lookups = lookupPartials(appRoot);
  const inherited = dataLookupRefs(root, lookups, read);
  for (const ref of inherited.refs) used.add(ref);
  if (appRoot) {
    // Leed's own templates call some site partials by name (a site header inside the docs shell, say).
    for (const file of walk(path.join(appRoot, "static", "site"))) {
      if (file.endsWith(".hbs"))
        for (const ref of partialRefs(fs.readFileSync(file, "utf-8"), lookups).refs) used.add(ref);
    }
  }

  const isPage = (rel) => !rel.startsWith("src/_includes/") && !rel.startsWith("src/_layouts/");
  const known = new Set(files.templates);
  // `.html` pages go through Handlebars too (htmlTemplateEngine), so they can call partials and name layouts.
  const html = [...(files.html ?? []), ...(files.staticPages ?? [])];
  const queue = [...html, ...files.templates.filter((rel) => isPage(rel) || used.has(rel))];
  const visited = new Set();
  let dynamic = inherited.dynamic;
  let unknownLayout = named.some((n) => n.unknown);
  while (queue.length > 0) {
    const rel = queue.pop();
    if (visited.has(rel)) continue;
    visited.add(rel);
    const text = read(rel) ?? "";
    const code = rel.endsWith(".md") ? blankMarkdownCode(text) : text;
    const refs = partialRefs(code.replace(HBS_COMMENT, blank), lookups);
    dynamic ||= refs.dynamic;
    const fm = frontmatter(text);
    const own = lookupValueRefs(lookups.map(({ key }) => frontmatterValue(fm, key)));
    dynamic ||= own.dynamic;
    refs.refs.push(...own.refs);
    const layout = frontmatterValue(fm, "layout");
    if (layout === UNKNOWN) unknownLayout = true;
    else if (typeof layout === "string" && layout.trim()) refs.refs.push(`src/_layouts/${layoutFile(layout.trim())}`);
    for (const target of refs.refs) {
      used.add(target);
      if (known.has(target)) queue.push(target);
    }
  }

  const styles = [TAILWIND_ENTRY];
  while (styles.length > 0) {
    const rel = styles.pop();
    used.add(rel);
    for (const imported of cssImports(rel, read(rel) ?? "")) if (!used.has(imported)) styles.push(imported);
  }
  for (const rel of files.styles) if (/@utility\s+color-theme-/.test(read(rel) ?? "")) used.add(rel);
  return { used, dynamic, unknownLayout };
}

export function checkUnusedAndTier(root, files, named, eject, appRoot, report, read) {
  const { used, dynamic, unknownLayout } = usedFiles(root, files, named, eject, appRoot, read);
  if (dynamic) report.note("a template calls a partial by a computed name, so no partial was reported as unreferenced");
  if (unknownLayout)
    report.note(
      "a frontmatter or data-file layout value could not be read (a block scalar, alias, tag, eleventyComputed or JavaScript value), so no layout was reported as unreferenced",
    );
  // A template in another language Eleventy builds, or in a directory the script skips, may call partials
  // and name layouts this script does not read.
  const foreign = [...(files.other ?? []), ...(files.skipped ?? []).map((dir) => `${dir}/`)];
  if (foreign.length > 0)
    report.note(
      `${foreign[0]}${foreign.length > 1 ? ` and ${foreign.length - 1} more` : ""} is a template or directory the script does not read, so no partial or layout was reported as unreferenced`,
    );
  // Without the page type list, a layout only a page type names would look unreferenced.
  const pageTypes = read("src/_data/pageTypeList.json") !== null;
  if (!pageTypes)
    report.note(
      "no src/_data/pageTypeList.json (the CMS writes it into the repo), so no layout was reported as unreferenced",
    );
  const layouts = pageTypes && !unknownLayout && foreign.length === 0;
  const partials = !dynamic && foreign.length === 0;
  const candidate = (rel) =>
    rel.endsWith(".hbs") &&
    ((layouts && rel.startsWith("src/_layouts/")) || (partials && rel.startsWith("src/_includes/")));
  const candidates = [...files.templates.filter(candidate), ...files.styles];
  const usedLower = new Set([...used].map((rel) => rel.toLowerCase()));
  for (const rel of candidates) {
    // Compared without case too: on a case-insensitive disk Eleventy finds `layout: Main` as main.hbs.
    if (used.has(rel) || usedLower.has(rel.toLowerCase()) || isLeedOwned(rel)) continue;
    report.add(
      13,
      "unreferenced",
      "review",
      rel,
      0,
      "nothing references this: no template, layout, page type or stylesheet import names it, and the build does not look it up",
      "confirm with the site owner before deleting it, and check the live site; it may be kept on purpose",
    );
  }

  if (!eject) {
    report.note("tier unknown: no --eject-json, so no eject suggestions and no tier check");
    return;
  }
  // Without a tier, leed site eject --json fails closed and omits gated templates, so a missing entry
  // says nothing about the plan.
  if (!eject.tier) {
    report.note("tier unknown in eject listing: tier-override check skipped");
    return;
  }
  const allowed = new Set(eject.templates.map((t) => t.name));
  for (const { name, destination } of EJECT_TEMPLATES) {
    if (allowed.has(name) || !fs.existsSync(path.join(root, destination))) continue;
    report.add(
      13,
      "tier-override",
      "review",
      destination,
      0,
      `overrides ${name}, which your plan does not render, so the override has no effect`,
      "keep it for a later plan change, or remove it with the site owner's agreement; it is not unused",
    );
  }
}
