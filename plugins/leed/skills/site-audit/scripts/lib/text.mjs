import fs from "node:fs";
import path from "node:path";
import { CHECK_IDS, RULES } from "./constants.mjs";
import { frontmatterValue } from "./frontmatter.mjs";

export { frontmatter, UNKNOWN } from "./frontmatter.mjs";

/** Shared helpers: line numbers, comment masking, file discovery, frontmatter and the report. */

const SKIP_DIRS = new Set(["node_modules", "_site", "dist", ".git", ".cache"]);

export class UsageError extends Error {}

export function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
  return starts;
}

export function lineOf(starts, index) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** Replace a span with spaces, keeping newlines so line numbers stay right. */
export function blank(text) {
  return text.replace(/[^\n]/g, " ");
}

/** Handlebars comments, with whitespace control on either side: `{{~!-- x --~}}` ends at its own `--~}}`. */
export const HBS_COMMENT = /\{\{~?!--[\s\S]*?--~?\}\}|\{\{~?![\s\S]*?\}\}/g;
export const ANY_TEMPLATE_COMMENT = /\{\{~?!--[\s\S]*?--~?\}\}|\{\{~?![\s\S]*?\}\}|<!--[\s\S]*?-->/g;
export const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;

/**
 * Blanks every comment `pattern` matches, returning the masked text and each comment's line range.
 * Matches are taken in order, so a comment inside another is part of the outer one.
 */
export function maskComments(text, pattern, starts) {
  const comments = [];
  const masked = text.replace(pattern, (match, ...rest) => {
    const offset = rest.at(-2);
    comments.push({ start: lineOf(starts, offset), end: lineOf(starts, offset + match.length - 1), text: match });
    return blank(match);
  });
  return { masked, comments };
}

/** The nearest comment that ends on `line` or within `window` lines above it. */
export function commentAbove(comments, line, window) {
  return comments.findLast((c) => c.end <= line && c.end >= line - window);
}

/**
 * Every file below `dir`, in sorted order (node and bun list a directory in different orders). A
 * symlink is followed, as Eleventy's glob follows it. A skipped directory (build output, dependencies)
 * is recorded in `skipped` when given.
 */
export function walk(dir, out = [], skipped = null) {
  let entries;
  try {
    entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    let isDir = entry.isDirectory();
    let isFile = entry.isFile();
    if (entry.isSymbolicLink()) {
      try {
        const target = fs.statSync(full);
        isDir = target.isDirectory();
        isFile = target.isFile();
      } catch {}
    }
    if (isDir) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, out, skipped);
      else if (skipped && entry.name !== "node_modules" && entry.name !== ".git") skipped.push(full);
    } else if (isFile) out.push(full);
  }
  return out;
}

export function toRel(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

/** CommonMark HTML block starts with their end conditions (types 1 to 5); any other tag runs to a blank line. */
const HTML_BLOCK_ENDS = [
  [/^ {0,3}<(?:script|pre|style|textarea)(?:\s|>|$)/i, /<\/(?:script|pre|style|textarea)>/i],
  [/^ {0,3}<!--/, /-->/],
  [/^ {0,3}<\?/, /\?>/],
  [/^ {0,3}<![A-Za-z]/, />/],
];
const HTML_BLOCK_START = /^ {0,3}<\/?[A-Za-z][\w-]*(?:[\s/>]|$)/;

const INLINE_CODE = /(`+)(?!`)(?:(?!\n[ \t]*\n)[\s\S])*?[^`]\1(?!`)/g;

/**
 * Blanks Markdown code: fenced blocks (``` or ~~~) and inline backtick spans. markdown-it escapes code,
 * so an example `{{> name}}` there calls nothing. An HTML block is passed through raw, backticks and
 * fences included, and Leed's `process` shortcode then renders a partial call in it, so HTML blocks are
 * never blanked. An inline span never crosses a blank line, as in CommonMark.
 */
export function blankMarkdownCode(text) {
  const out = [];
  let fence = null;
  let html = null;
  let prose = [];
  const flush = () => {
    if (prose.length > 0) out.push(prose.join("\n").replace(INLINE_CODE, blank));
    prose = [];
  };
  for (const line of text.split("\n")) {
    if (html) {
      out.push(line);
      if (html === "blank" ? !/\S/.test(line) : html.test(line)) html = null;
      continue;
    }
    const open = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (open && open[1][0] === fence[0] && open[1].length >= fence.length && !/\S/.test(line.slice(open[0].length)))
        fence = null;
      prose.push(blank(line));
      continue;
    }
    if (open) {
      fence = open[1];
      prose.push(blank(line));
      continue;
    }
    const raw = HTML_BLOCK_ENDS.find(([start]) => start.test(line));
    if (raw || HTML_BLOCK_START.test(line)) {
      flush();
      out.push(line);
      const end = raw ? raw[1] : "blank";
      // A one-line block (`<!-- x -->`, `<pre>x</pre>`) ends on its own line.
      if (raw && end.test(line.replace(raw[0], ""))) continue;
      html = end;
      continue;
    }
    prose.push(line);
  }
  flush();
  return out.join("\n");
}

/**
 * Leed's own partials, which the build replaces, and the disabled starter scaffolds in `_includes`, which
 * nothing calls, are not audited. A `-DISABLED.hbs` page outside `_includes` is an ordinary page to
 * Eleventy, which builds it, so it is audited like any other.
 */
export function isLeedOwned(rel) {
  return rel.startsWith("src/_includes/leed/") || /^src\/_includes\/.*-DISABLED\.hbs$/.test(rel);
}

/**
 * The templates (`src/**` .hbs and .md) and stylesheets (`tailwind/**` .css) of a site repo, plus its
 * `.html` pages: Handlebars renders those too, so they count when working out what the build uses.
 * `other` lists templates in a language the script does not read (Nunjucks, Liquid, JavaScript).
 */
export function siteFiles(root) {
  const skippedDirs = [];
  const all = walk(path.join(root, "src"), [], skippedDirs).map((file) => toRel(root, file));
  const source = all.filter((rel) => !rel.startsWith("src/static/"));
  const templates = source.filter((rel) => /\.(hbs|md)$/.test(rel));
  const html = source.filter((rel) => /\.html?$/.test(rel));
  // Eleventy builds a template under src/static/ too (Leed copies the folder itself, so nothing ignores
  // it): such a page is read for what it calls and names, though it gets no per-file checks.
  const staticPages = all.filter((rel) => rel.startsWith("src/static/") && /\.(?:hbs|md|html?)$/.test(rel));
  // Other languages Eleventy builds by default; the script reads none of them.
  const other = source.filter((rel) => /\.(?:njk|liquid|11ty\.[cm]?js)$/.test(rel) && !rel.startsWith("src/_data/"));
  const styles = walk(path.join(root, "tailwind"))
    .map((file) => toRel(root, file))
    .filter((rel) => rel.endsWith(".css") && !/(^|\/)tailwind-[^/]*\.css$/.test(rel));
  // A skipped directory matters only when it holds a template Eleventy would build.
  const skipped = skippedDirs
    .filter((dir) => walk(dir).some((file) => /\.(?:hbs|md|html?|njk|liquid|11ty\.[cm]?js)$/.test(file)))
    .map((dir) => toRel(root, dir));
  return { templates, styles, html, staticPages, other, skipped };
}

export function readText(root, rel) {
  try {
    return fs.readFileSync(path.join(root, rel), "utf-8");
  } catch {
    return null;
  }
}

/** The layout a frontmatter block names: a name, another scalar, undefined, or `UNKNOWN`. */
export function frontmatterLayout(fm) {
  return frontmatterValue(fm, "layout");
}

export class Report {
  constructor() {
    this.findings = [];
    this.justified = [];
    this.notes = [];
    this.allowed = new Map();
  }

  /** `where` is "page" for a page file and "template" otherwise; only path links carry it. */
  add(rule, check, severity, file, line, message, fix, where) {
    const finding = { rule, title: RULES[rule], check, severity, file, line, message, fix };
    if (where) finding.where = where;
    this.findings.push(finding);
    return finding;
  }

  /** A finding justified by a comment. Findings of one check under one comment are one entry. */
  justify(rule, check, file, line, comment) {
    const text = comment.trim().slice(0, 400);
    if (this.justified.some((j) => j.file === file && j.check === check && j.comment === text)) return;
    this.justified.push({ rule, check, file, line, comment: text });
  }

  /**
   * Reads `site-audit: allow <check>[, <check>]` markers from a file's comments. Findings of those
   * checks in that file become justified entries carrying the comment, for the reviewer to confirm.
   */
  readAllowMarkers(file, comments) {
    for (const comment of comments) {
      for (const match of comment.text.matchAll(/site-audit:\s*allow\s+([a-z-]+(?:\s*,\s*[a-z-]+)*)/g)) {
        // The list ends at the first word that is not a check id: `allow literal-color, the logo` allows one check.
        for (const check of match[1].split(/\s*,\s*/)) {
          if (!CHECK_IDS.includes(check)) break;
          this.allowed.set(`${file}\0${check}`, { line: comment.start, text: comment.text });
        }
      }
    }
  }

  note(text) {
    if (!this.notes.includes(text)) this.notes.push(text);
  }

  /**
   * Sorted findings, with repeated review findings folded together: the same check and message in
   * one file becomes one finding listing every line. An error finding is folded only into an identical
   * one on the same line, so each error keeps its own file:line.
   */
  result() {
    const folded = [];
    const byKey = new Map();
    for (const f of this.findings) {
      const allow = this.allowed.get(`${f.file}\0${f.check}`);
      if (allow) {
        this.justify(f.rule, f.check, f.file, allow.line, allow.text);
        continue;
      }
      const line = f.severity === "review" ? "" : f.line;
      const key = `${f.file}\0${line}\0${f.check}\0${f.severity}\0${f.message}`;
      const existing = byKey.get(key);
      if (existing) {
        for (const line of f.lines ?? [f.line]) if (!existing.lines.includes(line)) existing.lines.push(line);
        continue;
      }
      const copy = { ...f, lines: f.lines ?? [f.line] };
      folded.push(copy);
      byKey.set(key, copy);
    }
    folded.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule - b.rule);
    return folded;
  }
}
