import fs from "node:fs";
import path from "node:path";
import { LEED_LAYOUTS } from "./constants.mjs";
import { dataFileValue, frontmatter, frontmatterValue, UNKNOWN } from "./frontmatter.mjs";
import { lineOf, lineStarts, toRel, walk } from "./text.mjs";

/** Where layouts are named (rule 8), and the data files Eleventy merges into a template's data. */

export function layoutFile(name) {
  const base = String(name).replace(/^\.?\/?(?:_layouts\/)?/, "");
  return base.includes(".") ? base : `${base}.hbs`;
}

const DATA_EXT = /\.(?:json|[cm]?js)$/;
/** Every template format Eleventy builds by default, plus Handlebars. */
export const TEMPLATE_EXT = /\.(?:hbs|md|html?|njk|liquid|11ty\.[cm]?js)$/;

/**
 * Data files Eleventy merges into the data of templates below them, so a `layout` (or a lookup
 * partial's `header`) in one applies to those templates: `x.11tydata.json|js`, a directory data file
 * (`dir/dir.json`, `src/src.json`), or a template data file beside its template (`about.json` for
 * `about.hbs`). Global data (`src/_data/`) is handled by key, not here.
 */
export function templateDataFiles(root) {
  const all = walk(path.join(root, "src"))
    .map((f) => toRel(root, f))
    .filter((rel) => !rel.startsWith("src/_data/") && !rel.startsWith("src/static/"));
  const templateStems = new Set(
    all.filter((rel) => TEMPLATE_EXT.test(rel)).map((rel) => rel.replace(TEMPLATE_EXT, "")),
  );
  return all.filter((rel) => {
    if (!DATA_EXT.test(rel) || /\.11ty\.[cm]?js$/.test(rel)) return false;
    if (/\.11tydata\.(?:json|[cm]?js)$/.test(rel)) return true;
    if (!rel.endsWith(".json")) return false;
    const parts = rel.split("/");
    const stem = rel.slice(0, -".json".length);
    return parts.at(-1) === `${parts.at(-2)}.json` || templateStems.has(stem);
  });
}

/** The global data files that set `key` itself: `src/_data/<key>.json|js`. */
export function globalDataFiles(root, key) {
  return ["json", "js", "cjs", "mjs"]
    .map((ext) => `src/_data/${key}.${ext}`)
    .filter((rel) => fs.existsSync(path.join(root, rel)));
}

/** The line of the first `key` mention in a file, for a finding's location. */
function keyLine(text, key) {
  const index = text.search(new RegExp(`["']?\\b${key}\\b["']?\\s*:`));
  return index === -1 ? 1 : lineOf(lineStarts(text), index);
}

/**
 * Every layout the site names: in pageTypeList.json, in a template's frontmatter, or in a data file.
 * An entry with `unknown: true` names a layout this script cannot read (a block scalar it cannot
 * resolve, an alias, `eleventyComputed`, a computed value in a JavaScript data file).
 */
export function namedLayouts(root, templates, read) {
  const named = [];
  const pageTypes = read("src/_data/pageTypeList.json");
  if (pageTypes) {
    const starts = lineStarts(pageTypes);
    for (const match of pageTypes.matchAll(/"layout"\s*:\s*"([^"]*)"/g)) {
      if (match[1])
        named.push({ layout: match[1], file: "src/_data/pageTypeList.json", line: lineOf(starts, match.index) });
    }
  }
  const add = (layout, file, text) => {
    if (layout === UNKNOWN) named.push({ layout: null, unknown: true, file, line: keyLine(text, "layout") });
    else if (typeof layout === "string" && layout.trim() && !layout.includes("###"))
      named.push({ layout: layout.trim(), file, line: keyLine(text, "layout") });
  };
  for (const rel of templates) {
    const text = read(rel) ?? "";
    add(frontmatterValue(frontmatter(text), "layout"), rel, text);
  }
  for (const rel of [...templateDataFiles(root), ...globalDataFiles(root, "layout")]) {
    const text = read(rel) ?? "";
    const value = rel.startsWith("src/_data/") ? globalValue(rel, text) : dataFileValue(rel, text, "layout");
    add(value, rel, text);
  }
  return named;
}

/** A global data file's whole value: a JSON string, or `UNKNOWN` for anything JavaScript computes. */
export function globalValue(rel, text) {
  if (!rel.endsWith(".json")) return UNKNOWN;
  try {
    return JSON.parse(text);
  } catch {
    return UNKNOWN;
  }
}

function leedLayouts(appRoot) {
  if (!appRoot) return LEED_LAYOUTS;
  try {
    return fs.readdirSync(path.join(appRoot, "static", "site", "_layouts"));
  } catch {
    return LEED_LAYOUTS;
  }
}

export function checkMissingLayouts(root, named, appRoot, report) {
  const provided = new Set(leedLayouts(appRoot));
  for (const { layout, unknown, file, line } of named) {
    // A value the script cannot read is never reported missing: it may name a layout that exists.
    if (unknown) continue;
    const name = layoutFile(layout);
    if (provided.has(name) || fs.existsSync(path.join(root, "src", "_layouts", name))) continue;
    report.add(
      8,
      "missing-layout",
      "error",
      file,
      line,
      `names the layout ${layout}, which is not in src/_layouts/`,
      "create the layout (start from empty.hbs) or point the page type at one that exists; leed site validate fails until then",
    );
  }
}
