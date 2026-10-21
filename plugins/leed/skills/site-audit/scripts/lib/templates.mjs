import { BARE_HELPERS, NON_PAGE_PREFIXES, WORKER_ROUTES } from "./constants.mjs";
import { checkSiteWideHead } from "./head.mjs";
import { checkTemplateColors, checkTemplateHeaderHeight } from "./templateStyling.mjs";
import {
  ANY_TEMPLATE_COMMENT,
  commentAbove,
  frontmatter,
  HBS_COMMENT,
  lineOf,
  lineStarts,
  maskComments,
} from "./text.mjs";

/** Per-file checks on a Handlebars template: rules 1, 5, 6, 7, 9, 11, 12 and 14. */

const JUSTIFY_WINDOW = 5;

export function isInternalPath(value) {
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (NON_PAGE_PREFIXES.some((prefix) => value.startsWith(prefix))) return false;
  if (WORKER_ROUTES.some((route) => isUnderRoute(value, route))) return false;
  // A file such as /feed.xml or /favicon.ico is not a page.
  const last = value.split(/[?#]/)[0].split("/").pop() ?? "";
  return !(/\.[a-z0-9]{2,12}$/i.test(last) && !/\.html?$/i.test(last));
}

/** True when `value` is `route` itself or below it, on a segment boundary: /mcp and /mcp/x, never /mcp-server/. */
function isUnderRoute(value, route) {
  const base = route.replace(/\/$/, "");
  if (!value.startsWith(base)) return false;
  const rest = value.slice(base.length);
  return rest === "" || /^[/?#]/.test(rest);
}

function pathLinkFix(value) {
  return value.includes("{{")
    ? "link with pageid:list-<id>[-<labelId|userId>] for an index page, or the target's {{ this.url }}, instead of building a path"
    : "use pageid:<uuid> for the target page";
}

/** Every `href=` / `action=` attribute value, quoted or JSON-escaped (`href=\"/x\"` in a frontmatter string). */
function* attributeValues(text) {
  // Not preceded by a word character or hyphen, so `data-href=` is not a link.
  for (const match of text.matchAll(/(?<![\w-])(?:href|action)\s*=\s*(\\?)(["'])/g)) {
    const start = match.index + match[0].length;
    const close = text.indexOf(`${match[1]}${match[2]}`, start);
    if (close !== -1) yield { index: match.index, value: text.slice(start, close).trim() };
  }
}

function checkPathLinks({ text, rel, starts, report, where }) {
  for (const { index, value } of attributeValues(text)) {
    if (!isInternalPath(value)) continue;
    const line = lineOf(starts, index);
    report.add(5, "path-link", "error", rel, line, `links to the path ${value}`, pathLinkFix(value), where);
  }
  // Frontmatter values a layout turns into links: href, url, link, docs, *Href, *Url.
  const fm = frontmatter(text);
  if (fm.index === -1) return;
  const key = /(["']?)([A-Za-z]*(?:[hH]ref|[uU]rl|[lL]ink)|docs)\1\s*:\s*["']?(\/[^"'\n,}]*)/g;
  for (const match of fm.raw.matchAll(key)) {
    const value = match[3].trim();
    if (/permalink/i.test(match[2]) || !isInternalPath(value)) continue;
    const line = lineOf(starts, fm.index + match.index);
    report.add(
      5,
      "path-link",
      "error",
      rel,
      line,
      `frontmatter "${match[2]}" holds the path ${value}`,
      pathLinkFix(value),
      where,
    );
  }
}

function countLiteralLinks(block) {
  let count = 0;
  for (const match of block.matchAll(/<a\b([^>]*)>/g)) {
    const href = match[1].match(/\bhref\s*=\s*["']([^"']*)["']/);
    if (href && !href[1].trim().startsWith("{{") && !href[1].trim().startsWith("#")) count++;
  }
  return count;
}

function checkHandWrittenNav({ text, rel, starts, report }) {
  if (/leed\/menu\/builder/.test(text)) return;
  const reported = new Set();
  const flag = (index, what) => {
    const line = lineOf(starts, index);
    if (reported.has(line)) return;
    reported.add(line);
    report.add(
      1,
      "hand-written-nav",
      "error",
      rel,
      line,
      `${what} lists links by hand`,
      'render the menu with {{> leed/menu/builder menuName="..." }} and manage its items in the CMS',
    );
  };
  for (const match of text.matchAll(/<nav\b[^>]*>([\s\S]*?)<\/nav>/g)) {
    if (countLiteralLinks(match[1]) >= 2) flag(match.index, "a <nav>");
  }
  for (const region of text.matchAll(/<(header|footer)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const offset = region.index + region[0].indexOf(region[2]);
    for (const list of region[2].matchAll(/<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
      if (countLiteralLinks(list[2]) >= 2) flag(offset + list.index, `a <${list[1]}> in the <${region[1]}>`);
    }
  }
}

/** `{{#each ...}}` blocks with their argument, start index and body, matched with a stack so nesting is right. */
function eachBlocks(text) {
  const blocks = [];
  const stack = [];
  for (const match of text.matchAll(/\{\{~?\s*(#each\b([^}]*)|\/each)\s*~?\}\}/g)) {
    if (match[1].startsWith("#")) {
      stack.push({ arg: match[2].trim(), index: match.index, bodyStart: match.index + match[0].length });
    } else {
      const open = stack.pop();
      if (open) blocks.push({ ...open, body: text.slice(open.bodyStart, match.index) });
    }
  }
  return blocks;
}

const TEST_TAG = /\{\{~?\s*#(?:if|unless|eq|neq|unlessEq|ifEq|ifIn|contains|includes)\b([^}]*)\}\}/g;
/** The field compared with a value: `pageTypeId "x"`, `labels ../id`, or a value first: `"x" pageTypeId`. */
const FIELD_WITH_VALUE =
  /(?:^|[\s(])(?:[\w@]+\.|\.\.\/)*(?:pageTypeId|labels)\s+[^\s)~]|["'\d][^\s)]*\s+(?:[\w@]+\.|\.\.\/)*(?:pageTypeId|labels)\b(?!\.)/;

/**
 * A test that filters by page type or label: the field compared with a value. A bare truthiness test
 * (`{{#if labels}}` around label chips) is presentation, not filtering.
 */
function filtersByField(body) {
  for (const tag of body.matchAll(TEST_TAG)) if (FIELD_WITH_VALUE.test(tag[1])) return true;
  return false;
}
const RECORD_LISTS = /\b(?:labelList|userList|pageTypeList)\b/;

function handFilters(text) {
  const hits = [...text.matchAll(/\bcollections\.all\b/g)].map((m) => ({
    index: m.index,
    why: "loops over collections.all",
  }));
  for (const block of eachBlocks(text)) {
    if (/\bcollections?\b|\bpageData\b/.test(block.arg) && filtersByField(block.body)) {
      hits.push({ index: block.index, why: "filters a collection by page type or label inside the loop" });
    } else if (RECORD_LISTS.test(block.arg)) {
      hits.push({ index: block.index, why: `loops over ${block.arg.match(RECORD_LISTS)[0]}` });
    } else if (/\blookup\s+(?:\.\.\/|@root\.?)+(?:labelList|userList|pageTypeList)\b/.test(block.body)) {
      hits.push({ index: block.index, why: "looks records up by id inside the loop" });
    }
  }
  return hits;
}

function checkHandFilteredCollections({ text, rel, starts, report, hbsComments }) {
  const seen = new Set();
  for (const hit of handFilters(text)) {
    const line = lineOf(starts, hit.index);
    if (seen.has(line)) continue;
    seen.add(line);
    const comment = commentAbove(hbsComments, line, JUSTIFY_WINDOW);
    if (comment) {
      report.justify(7, "hand-filtered-collection", rel, line, comment.text);
      continue;
    }
    report.add(
      7,
      "hand-filtered-collection",
      "error",
      rel,
      line,
      `${hit.why} with no comment saying why`,
      'use collections.pageTypeId-X:paged|unpaged|labels|authors or (collection "pageTypeId-X:labelId-Y"); if no built-in can express the selection, add a {{!-- --}} comment above the loop saying why',
    );
  }
}

function checkBareHelpers({ text, rel, starts, report }) {
  const pattern = new RegExp(`\\{\\{\\{?~?\\s*(${BARE_HELPERS.join("|")})\\s*~?\\}?\\}\\}`, "g");
  for (const match of text.matchAll(pattern)) {
    const name = match[1];
    report.add(
      11,
      "bare-helper",
      "error",
      rel,
      lineOf(starts, match.index),
      `{{ ${name} }} calls the global ${name} helper with no arguments, so it renders empty`,
      `read the field as this.${name}`,
    );
  }
  for (const match of text.matchAll(/^[ \t]+\{\{~?#?>\s*code-block\b/gm)) {
    report.add(
      11,
      "code-block-column",
      "error",
      rel,
      lineOf(starts, match.index),
      "{{> code-block}} is indented, and the indent ends up inside the rendered code",
      "start the {{> code-block}} line at column 0",
    );
  }
}

function checkImageVariants({ text, rel, starts, report }) {
  const patterns = [
    // Block (`{{#ImageTag …}}`) and inline (`{{{ ImageTag item.image "xxl" }}}`) forms.
    /\{\{\{?~?\s*#?(?:Image|ImageTag|FeatureImage)\b[^}]*["'](original|xxl)["']/g,
    /\bdata-leed-variant\s*=\s*["'](original|xxl)["']/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      report.add(
        6,
        "image-variant",
        "review",
        rel,
        lineOf(starts, match.index),
        `uses the "${match[1]}" image variant`,
        "pick the smallest variant at least as wide as the container can ever be; original and xxl suit full-bleed images only",
      );
    }
  }
}

/** A page file (outside `_includes` and `_layouts`, with a pageId) may have a CMS-managed body. */
function templateWhere(rel, text) {
  if (rel.startsWith("src/_includes/") || rel.startsWith("src/_layouts/")) return "template";
  return /"pageId"\s*:|^pageId:/m.test(frontmatter(text).raw) ? "page" : "template";
}

export function auditTemplate(rel, raw, report) {
  if (rel.endsWith(".md")) return;
  const starts = lineStarts(raw);
  const { comments: hbsComments } = maskComments(raw, HBS_COMMENT, starts);
  const { masked, comments } = maskComments(raw, ANY_TEMPLATE_COMMENT, starts);
  report.readAllowMarkers(rel, comments);
  const ctx = { text: masked, rel, starts, report, hbsComments, where: templateWhere(rel, raw) };
  checkPathLinks(ctx);
  checkHandWrittenNav(ctx);
  checkHandFilteredCollections(ctx);
  checkBareHelpers(ctx);
  checkImageVariants(ctx);
  checkTemplateColors(ctx);
  checkTemplateHeaderHeight(ctx);
  checkSiteWideHead(ctx);
}
