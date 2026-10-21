import { createHash } from "node:crypto";
import { colorLiterals, hostedFamilies, scanCss, urlRefs } from "./css.mjs";
import { blank, kindOf, lineOf, lineStarts } from "./files.mjs";

/**
 * What a page (HTML, or a JSX/TSX component) holds, read with a tolerant tag scan rather than a DOM:
 * its title and headings, its top-level landmark blocks, its navigation, forms, styles and the files
 * it references. Anything the scan cannot read is left for the caller to report, never dropped.
 */

const LANDMARK = /<(\/?)(header|nav|main|section|footer|article|aside)\b[^>]*>/gi;
const HTML_COMMENT = /<!--[\s\S]*?-->|\{\/\*[\s\S]*?\*\/\}/g;

function textOf(markup) {
  return markup
    .replace(/<[^>]*>/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** `<link rel>` values that point at another page, and those that load a file the page uses. */
const PAGE_RELS = /\b(?:canonical|alternate|prev|next|home|author|license|me)\b/i;
const FILE_RELS = /\b(?:stylesheet|icon|preload|prefetch|modulepreload|manifest|apple-touch-icon)\b/i;

/**
 * The URLs in a `srcset`, read as the HTML spec does: each URL runs to the next whitespace, so the
 * commas inside a `data:` URI stay part of it, and only a trailing comma ends a candidate early.
 */
export function srcsetUrls(value) {
  const urls = [];
  let i = 0;
  while (i < value.length) {
    while (i < value.length && /[\s,]/.test(value[i])) i++;
    let j = i;
    while (j < value.length && !/\s/.test(value[j])) j++;
    let url = value.slice(i, j);
    const ended = url.endsWith(",");
    url = url.replace(/,+$/, "");
    if (url) urls.push(url);
    i = j;
    if (!ended) {
      while (i < value.length && value[i] !== ",") i++;
    }
  }
  return urls;
}

function attr(tag, name) {
  const m = tag.match(
    new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{["'\`]([^"'\`]*)["'\`]\\}|([^\\s>]+))`, "i"),
  );
  return m ? (m[1] ?? m[2] ?? m[3] ?? m[4]).replace(/&amp;/g, "&") : null;
}

/** Markup with whitespace and per-page state (the current link) removed, so the same header on two pages hashes alike. */
function normalize(markup) {
  return markup
    .replace(/\saria-current\s*=\s*("[^"]*"|'[^']*'|\S+)/gi, "")
    .replace(/\b(?:is-)?(?:active|current)\b/g, "")
    .replace(/\s(?:class|className)\s*=\s*(?:""|'')/g, "")
    .replace(/\s+/g, "");
}

/**
 * Top-level landmark blocks: a `<nav>` inside a `<header>` belongs to the header block. An opener
 * that never closes is skipped and the scan rerun, so its children still count as top-level; the
 * skipped openers are returned for the caller to report.
 */
function landmarks(masked) {
  const skipped = new Set();
  const unclosed = [];
  for (;;) {
    const blocks = [];
    const stack = [];
    for (const m of masked.matchAll(LANDMARK)) {
      const tag = m[2].toLowerCase();
      if (!m[1]) {
        if (!m[0].endsWith("/>") && !skipped.has(m.index)) stack.push({ tag, index: m.index, open: m[0] });
        continue;
      }
      const at = stack.findLastIndex((s) => s.tag === tag);
      if (at === -1) continue;
      const [open] = stack.splice(at);
      if (at === 0) blocks.push({ tag, start: open.index, end: m.index + m[0].length, open: open.open });
    }
    if (stack.length === 0) return { blocks, unclosed };
    for (const open of stack) {
      skipped.add(open.index);
      unclosed.push({ tag: open.tag, index: open.index });
    }
  }
}

/** `import x from "./a.png"`, `import "./a.css"`, `require("./a.png")` and `new URL("./a.png", import.meta.url)`. */
const MODULE_REF =
  /\bimport\s+(?:[\w$*{}\s,]+?\s+from\s+)?["']([^"']+)["']|\brequire\(\s*["']([^"']+)["']\s*\)|\bnew\s+URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url/g;
const JS_COMMENT = /\/\*[\s\S]*?\*\/|^[ \t]*\/\/.*$/gm;

/**
 * The handoff files a JavaScript module or JSX/TSX component imports: a relative or root path to a
 * file of a kind the inventory knows (an image, a stylesheet, another page). Packages (`react`) and
 * extensionless module paths (`./Hero`) are not files the import maps, so they are left out.
 */
export function moduleRefs(text) {
  const masked = text.replace(JS_COMMENT, blank);
  const starts = lineStarts(masked);
  const refs = [];
  for (const m of masked.matchAll(MODULE_REF)) {
    const ref = m[1] ?? m[2] ?? m[3];
    if (/^\.{0,2}\//.test(ref) && kindOf(ref.split(/[?#]/)[0])) {
      refs.push({ ref, line: lineOf(starts, m.index), link: false });
    }
  }
  return refs;
}

const decodeAttr = (value) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");

function links(markup) {
  return [...markup.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)].map(([a]) => ({
    label: textOf(a) || attr(a, "aria-label") || "",
    href: attr(a.slice(0, a.indexOf(">") + 1), "href"),
  }));
}

function blockId(open) {
  const id = attr(open, "id");
  const cls = attr(open, "class") ?? attr(open, "className");
  return id ? `#${id}` : cls ? `.${cls.trim().split(/\s+/)[0]}` : null;
}

/** Reads one page into `inv`, and returns the references it makes for the caller to resolve. */
export function scanPage(file, kind, text, inv) {
  const masked = text.replace(HTML_COMMENT, blank);
  const starts = lineStarts(masked);
  const at = (index) => lineOf(starts, index);
  const page = { file, kind, title: null, headings: [], sections: [], inlineScripts: 0 };
  const title = masked.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (title) page.title = textOf(title[1]);
  for (const m of masked.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    page.headings.push({ level: Number(m[1]), text: textOf(m[2]), line: at(m.index) });
  }

  const { blocks, unclosed } = landmarks(masked);
  for (const open of unclosed) {
    inv.notes.push(
      `${file}: <${open.tag}> at line ${at(open.index)} is never closed; it is not reported as a block, and the blocks inside it are listed as top-level`,
    );
  }
  for (const block of blocks) {
    const markup = masked.slice(block.start, block.end);
    const hash = createHash("sha256").update(normalize(markup)).digest("hex").slice(0, 16);
    page.sections.push({
      tag: block.tag,
      id: blockId(block.open),
      line: at(block.start),
      hash,
      text: textOf(markup).slice(0, 120),
    });
  }

  for (const m of masked.matchAll(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi)) {
    const within = blocks.find((b) => b.start <= m.index && b.end >= m.index + m[0].length && b.tag !== "nav");
    inv.navigation.push({ file, line: at(m.index), where: "nav", within: within?.tag ?? null, items: links(m[0]) });
  }
  for (const block of blocks.filter((b) => b.tag === "header" || b.tag === "footer")) {
    const markup = masked.slice(block.start, block.end);
    const items = links(markup);
    if (!/<nav\b/i.test(markup) && items.length >= 2) {
      inv.navigation.push({ file, line: at(block.start), where: block.tag, within: null, items });
    }
  }

  for (const m of masked.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)) {
    const open = m[0].slice(0, m[0].indexOf(">") + 1);
    const fields = [...m[0].matchAll(/<(input|select|textarea|button)\b[^>]*>/gi)].map(([tag, name]) => ({
      tag: name.toLowerCase(),
      name: attr(tag, "name"),
      type: attr(tag, "type"),
    }));
    inv.forms.push({ file, line: at(m.index), action: attr(open, "action"), method: attr(open, "method"), fields });
  }

  // <style> blocks are read as CSS in place, so their line numbers are the page's.
  let styles = "";
  let last = 0;
  for (const m of masked.matchAll(/(<style\b[^>]*>)([\s\S]*?)<\/style>/gi)) {
    styles += blank(masked.slice(last, m.index + m[1].length)) + m[2];
    last = m.index + m[1].length + m[2].length;
  }
  styles += blank(masked.slice(last));
  const refs = [];
  scanCss(styles, file, inv, refs);

  for (const m of masked.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const style = decodeAttr(m[1] ?? m[2]);
    for (const value of colorLiterals(style)) {
      inv.colorLiterals.push({ value, property: "style", context: "light", file, line: at(m.index) });
    }
    for (const { ref } of urlRefs(style)) refs.push({ ref, line: at(m.index), link: false });
  }
  for (const m of masked.matchAll(/\s(?:fill|stroke|stop-color|color|bgcolor)\s*=\s*["']([^"']*)["']/gi)) {
    for (const value of colorLiterals(m[1])) {
      inv.colorLiterals.push({ value, property: "attribute", context: "light", file, line: at(m.index) });
    }
  }

  for (const m of masked.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!/\ssrc\s*=/i.test(m[0].slice(0, m[0].indexOf(">"))) && m[1].trim()) page.inlineScripts++;
  }
  for (const m of masked.matchAll(/<([a-zA-Z][\w.-]*)\b[^>]*>/g)) {
    const tag = m[0];
    const tagName = m[1].toLowerCase();
    // <base href> sets where other links resolve from; it names no file.
    if (tagName === "base") continue;
    // A <link> to a page (canonical, alternate, prev, next) is a page link, not a file the page loads.
    const link =
      tagName === "a" ||
      (tagName === "link" && PAGE_RELS.test(attr(tag, "rel") ?? "") && !FILE_RELS.test(attr(tag, "rel") ?? ""));
    const meta =
      tagName === "meta" && /^(?:og|twitter):image(?::url)?$/i.test(attr(tag, "property") ?? attr(tag, "name") ?? "");
    if (meta) {
      const ref = attr(tag, "content");
      if (ref) refs.push({ ref, line: at(m.index), link: false });
    }
    for (const name of ["src", "href", "xlink:href", "poster", "data-src"]) {
      const ref = attr(tag, name);
      if (!ref || ref.startsWith("{")) continue;
      refs.push({ ref, line: at(m.index), link });
      if (/^https?:\/\/fonts\./.test(ref)) {
        for (const family of hostedFamilies(ref)) inv.fonts.push({ family, source: "link", file, line: at(m.index) });
      }
    }
    for (const ref of srcsetUrls(attr(tag, "srcset") ?? "")) refs.push({ ref, line: at(m.index), link: false });
  }
  if (kind === "component") refs.push(...moduleRefs(masked));
  inv.pages.push(page);
  return refs;
}
