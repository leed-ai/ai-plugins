/**
 * Frontmatter and data-file values, read the way Eleventy reads them (gray-matter with js-yaml) as far
 * as a dependency-free reader can. Only top-level scalar values are needed (`layout`, a lookup
 * partial's `header`), so this is not a YAML parser: it reads the forms js-yaml accepts for a
 * top-level scalar and returns `UNKNOWN` for anything it cannot be sure of (an alias, a merge key, a
 * tag, `eleventyComputed`, JavaScript frontmatter). A caller treats `UNKNOWN` as "this file may name
 * anything" and switches the dependent check off with a note, never guessing.
 */

export const UNKNOWN = Symbol("unknown");

/**
 * A template's frontmatter: the raw block, its language (`---json`, `---js`), and its data when the
 * block is JSON. Accepts a leading byte-order mark and CRLF line endings, as gray-matter does; an
 * opening `----` is not a delimiter.
 */
export function frontmatter(text) {
  const match = text.match(/^﻿?---(?!-)([^\r\n]*)\r?\n([\s\S]*?)\r?\n---[ \t]*\r?(?:\n|$)/);
  if (!match) return { raw: "", lang: "", data: null, index: -1 };
  const raw = match[2];
  const index = match[0].indexOf(raw, 3 + match[1].length);
  const lang = match[1].trim().toLowerCase();
  return { raw, lang, data: parseJsonish(raw), index };
}

/** JSON, or JSON with trailing commas (valid YAML flow, so gray-matter reads it); null otherwise. */
function parseJsonish(raw) {
  for (const text of [raw, raw.replace(/,(\s*[}\]])/g, "$1")]) {
    try {
      return JSON.parse(text);
    } catch {}
  }
  return null;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A value from parsed data: `UNKNOWN` when `eleventyComputed` may set the key. */
function objectValue(data, key) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const computed = data.eleventyComputed;
  if (computed !== undefined && (typeof computed !== "object" || computed === null || key in computed)) return UNKNOWN;
  return Object.hasOwn(data, key) ? data[key] : undefined;
}

/**
 * The value of a top-level frontmatter key: a string, another scalar (null, a boolean), `undefined`
 * when the key is absent, or `UNKNOWN` when the block names it in a form this reader cannot resolve.
 */
export function frontmatterValue(fm, key) {
  if (fm.index === -1) return undefined;
  if (fm.data !== null) return objectValue(fm.data, key);
  if (fm.lang && !["yaml", "yml", "json"].includes(fm.lang)) {
    // JavaScript (or another engine's) frontmatter can compute anything.
    return new RegExp(`\\b${escapeRe(key)}\\b`).test(fm.raw) ? UNKNOWN : undefined;
  }
  return yamlValue(fm.raw, key);
}

/** A key's value in a data file: JSON parsed in full; a JavaScript file read only for a literal. */
export function dataFileValue(rel, text, key) {
  if (rel.endsWith(".json")) {
    const data = parseJsonish(text);
    if (data !== null) return objectValue(data, key);
    return new RegExp(`\\b${escapeRe(key)}\\b`).test(text) ? UNKNOWN : undefined;
  }
  const mentions = text.match(new RegExp(`\\b${escapeRe(key)}\\b`, "g")) ?? [];
  if (mentions.length === 0 && !/\beleventyComputed\b/.test(text)) return undefined;
  const literal = [
    ...text.matchAll(new RegExp(`(["']?)${escapeRe(key)}\\1\\s*:\\s*(["'\`])([^"'\`$\\\\\\n]*)\\2\\s*[,}\\n]`, "g")),
  ];
  // One literal and no other mention: anything else (a computed value, eleventyComputed) is unknown.
  if (literal.length === 1 && mentions.length === 1 && !/\beleventyComputed\b/.test(text)) return literal[0][3];
  return UNKNOWN;
}

const indentOf = (line) => line.match(/^[ \t]*/)[0].length;
const isBlank = (line) => /^[ \t]*(?:#.*)?$/.test(line);

/** Folds the lines of a multi-line flow scalar: a line break is a space, an empty line a newline. */
function foldLines(lines) {
  let out = "";
  let pendingBreaks = 0;
  lines.forEach((line, i) => {
    const text = i === 0 ? line.replace(/[ \t]+$/, "") : line.trim();
    if (i > 0 && text === "" && i < lines.length - 1) {
      pendingBreaks++;
      return;
    }
    if (i > 0) out += pendingBreaks > 0 ? "\n".repeat(pendingBreaks) : " ";
    pendingBreaks = 0;
    out += text;
  });
  return out;
}

/** js-yaml's double-quoted escapes, besides `\xXX`, `\uXXXX` and `\UXXXXXXXX`. */
const DOUBLE_ESCAPES = { 0: "\0", a: "\x07", b: "\b", t: "\t", "\t": "\t", n: "\n", v: "\v", f: "\f", r: "\r" };
Object.assign(DOUBLE_ESCAPES, { e: "\x1b", " ": " ", '"': '"', "/": "/", "\\": "\\", N: "\x85", _: "\xa0" });
Object.assign(DOUBLE_ESCAPES, { L: "\u2028", P: "\u2029" });

/** A quoted scalar starting at `text[0]`: its value and what follows the closing quote, or null. */
function quoted(text) {
  const q = text[0];
  let i = 1;
  let body = "";
  for (; i < text.length; i++) {
    const c = text[i];
    if (q === '"' && c === "\\") {
      body += c + (text[i + 1] ?? "");
      i++;
    } else if (c === q) {
      if (q === "'" && text[i + 1] === "'") {
        body += "''";
        i++;
      } else break;
    } else body += c;
  }
  if (i >= text.length) return null;
  let value = foldLines(body.split("\n"));
  if (q === "'") value = value.replace(/''/g, "'");
  else {
    let bad = false;
    value = value.replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|[\s\S])/g, (_, e) => {
      if (/^[xuU]/.test(e) && e.length > 1) return String.fromCodePoint(Number.parseInt(e.slice(1), 16));
      if (e in DOUBLE_ESCAPES) return DOUBLE_ESCAPES[e];
      bad = true;
      return "";
    });
    if (bad) return null;
  }
  return { value, rest: text.slice(i + 1) };
}

/** A block scalar (`|`, `>-`, `|2+`) whose header is `header` and whose content lines follow. */
function blockScalar(header, following, parentIndent) {
  const h = header.match(/^([|>])(?:([1-9])([+-])?|([+-])([1-9])?)?[ \t]*(?:#.*)?$/);
  if (!h) return UNKNOWN;
  const folded = h[1] === ">";
  const chomp = h[3] ?? h[4] ?? "";
  const explicit = h[2] ?? h[5];
  const firstContent = following.find((l) => l.trim() !== "");
  if (firstContent === undefined) return "";
  const indent = explicit ? parentIndent + Number(explicit) : indentOf(firstContent);
  if (indent <= parentIndent) return "";
  const lines = [];
  for (const line of following) {
    if (line.trim() === "") lines.push("");
    else if (indentOf(line) >= indent) lines.push(line.slice(indent));
    else break;
  }
  let body;
  if (!folded) body = lines.join("\n");
  else {
    body = "";
    lines.forEach((line, i) => {
      if (i === 0) {
        body = line;
        return;
      }
      const prev = lines[i - 1];
      const moreIndented = /^[ \t]/.test(line) || /^[ \t]/.test(prev);
      body += prev === "" || line === "" || moreIndented ? "\n" : " ";
      body += line;
    });
  }
  const trimmed = body.replace(/\n+$/, "");
  if (chomp === "-") return trimmed;
  if (chomp === "+") return `${body}\n`;
  return trimmed === "" ? "" : `${trimmed}\n`;
}

/** A plain scalar resolved as js-yaml's core schema does; numbers are kept as their text. */
function plainScalar(text) {
  if (/^(?:~|null|Null|NULL)?$/.test(text)) return null;
  if (/^(?:true|True|TRUE)$/.test(text)) return true;
  if (/^(?:false|False|FALSE)$/.test(text)) return false;
  return text;
}

/** The value of `key` in a block-mapping YAML document (or a flow mapping on its own). */
function yamlValue(raw, key) {
  const lines = raw.split(/\r?\n/);
  const firstLine = lines.find((l) => !isBlank(l));
  if (firstLine === undefined) return undefined;
  if (/^[ \t]*[{[]/.test(firstLine)) return flowValue(raw, key);
  const base = indentOf(firstLine);
  const keyRe = new RegExp(`^(["']?)${escapeRe(key)}\\1[ \\t]*:(?=[ \\t]|$)(.*)$`);
  let found;
  let count = 0;
  let unsure = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isBlank(line) || indentOf(line) !== base) continue;
    const body = line.slice(base);
    const following = [];
    for (let j = i + 1; j < lines.length && (lines[j].trim() === "" || indentOf(lines[j]) > base); j++)
      following.push(lines[j]);
    if (/^<<[ \t]*:/.test(body) || /^\?(?:[ \t]|$)/.test(body)) {
      // A merge key or a complex key may bring in any key.
      unsure = true;
      continue;
    }
    if (/^(["']?)eleventyComputed\1[ \t]*:/.test(body)) {
      if (new RegExp(`\\b${escapeRe(key)}\\b`).test([body, ...following].join("\n"))) return UNKNOWN;
      continue;
    }
    const m = body.match(keyRe);
    if (!m) continue;
    count++;
    found = scalarAfterKey(m[2], following, base);
  }
  // js-yaml rejects a duplicate key, so the build fails; the reader does not pick one.
  if (count > 1) return UNKNOWN;
  if (count === 0) return unsure ? UNKNOWN : undefined;
  return found;
}

/** The value after `key:` on its line, with the more-indented lines that follow it. */
function scalarAfterKey(after, following, base) {
  let v = after.trim();
  let forceString = false;
  // Node properties: an anchor changes nothing; `!!str` keeps a string; any other tag is unknown.
  for (;;) {
    const anchor = v.match(/^&[^\s]+(?:[ \t]+|$)/);
    if (anchor) {
      v = v.slice(anchor[0].length);
      continue;
    }
    const tag = v.match(/^!(\S*)(?:[ \t]+|$)/);
    if (tag) {
      if (tag[1] !== "!str") return UNKNOWN;
      forceString = true;
      v = v.slice(tag[0].length);
      continue;
    }
    break;
  }
  if (v.startsWith("*")) return UNKNOWN;
  if (v.startsWith("|") || v.startsWith(">")) return blockScalar(v, following, base);
  if (v.startsWith('"') || v.startsWith("'")) {
    const q = quoted([v, ...following].join("\n"));
    if (!q) return UNKNOWN;
    const tail = q.rest.split("\n")[0];
    return /^[ \t]*(?:#.*)?$/.test(tail) ? q.value : UNKNOWN;
  }
  if (/^[[{]/.test(v)) return UNKNOWN;
  const content = following.filter((l) => !isBlank(l));
  if (v === "" || v.startsWith("#")) {
    if (content.length === 0) return forceString ? "" : null;
    // A nested mapping or sequence is not a name; a plain scalar on the next lines is.
    if (/^[ \t]*(?:- |-$|[^#]*?:(?:[ \t]|$))/.test(content[0])) return UNKNOWN;
    v = "";
  }
  const commentAt = v.search(/[ \t]#/);
  const firstPart = commentAt === -1 ? v : v.slice(0, commentAt);
  if (commentAt !== -1 && content.length > 0) return UNKNOWN;
  if (/^[@`%]|^[-?:](?:[ \t]|$)|:(?:[ \t]|$)/.test(firstPart.trim())) return UNKNOWN;
  const parts = [firstPart.trim()];
  for (const line of following) {
    if (/^[ \t]*#/.test(line)) break;
    const text = line.trim();
    if (/:(?:[ \t]|$)|[ \t]#/.test(text)) return UNKNOWN;
    parts.push(text);
  }
  while (parts.length > 1 && parts.at(-1) === "") parts.pop();
  const joined = foldLines(parts.filter((p, i) => i > 0 || p !== "")).trim();
  return forceString ? joined : plainScalar(joined);
}

/** A flow mapping that is not JSON (unquoted keys or values): the key's value read leniently. */
function flowValue(raw, key) {
  const re = new RegExp(`(?:^|[{,\\s])(["']?)${escapeRe(key)}\\1\\s*:\\s*`, "g");
  const hits = [...raw.matchAll(re)];
  const mentions = raw.match(new RegExp(`\\b${escapeRe(key)}\\b`, "g")) ?? [];
  if (hits.length === 0) return mentions.length === 0 ? undefined : UNKNOWN;
  if (hits.length > 1 || mentions.length > 1 || /\beleventyComputed\b/.test(raw)) return UNKNOWN;
  const rest = raw.slice(hits[0].index + hits[0][0].length);
  if (rest.startsWith('"') || rest.startsWith("'")) {
    const q = quoted(rest);
    return q && /^\s*[,}]/.test(q.rest) ? q.value : UNKNOWN;
  }
  const plain = rest.match(/^([^,{}[\]\n#]*?)\s*[,}]/);
  return plain ? plainScalar(plain[1].trim()) : UNKNOWN;
}
