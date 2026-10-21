import path from "node:path";
import { TAILWIND_ENTRY, THEME_FILE } from "./constants.mjs";
import { blank, CSS_COMMENT, commentAbove, lineOf, lineStarts, maskComments } from "./text.mjs";

/** Per-file checks on a stylesheet: rules 9, 10 and 12. */

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g;
const COLOR_FN = /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(\s*[\d.][^)]*\)/g;
const IMPORTANT_WINDOW = 12;

/** Blanks quoted strings and `url(...)`, so a hex inside `[fill="#fff"]` or `url(#id)` is not a color. */
function blankStrings(text) {
  return text.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, blank).replace(/url\([^)]*\)/g, blank);
}

/**
 * Every declaration in a comment- and string-masked stylesheet, with its chain of enclosing
 * selectors and at-rules. Not a full CSS parser: enough for nested rules, at-rules and `@apply`.
 */
export function cssDeclarations(masked) {
  const declarations = [];
  const stack = [];
  let start = 0;
  const emit = (end) => {
    const raw = masked.slice(start, end);
    const at = start + raw.length - raw.trimStart().length;
    const body = raw.trim();
    if (stack.length === 0 || !body) return;
    const apply = body.startsWith("@apply");
    const colon = apply ? 6 : body.indexOf(":");
    if (colon === -1) return;
    const valueOffset = apply ? colon : colon + 1;
    declarations.push({
      index: at,
      prop: body.slice(0, colon).trim(),
      value: body.slice(valueOffset),
      valueIndex: at + valueOffset,
      selectors: stack.map((s) => s.selector),
      ruleIndex: stack.at(-1).index,
    });
  };
  for (let i = 0; i < masked.length; i++) {
    const c = masked[i];
    if (c === "{") {
      const raw = masked.slice(start, i);
      stack.push({ selector: raw.trim(), index: start + raw.length - raw.trimStart().length });
      start = i + 1;
    } else if (c === ";" || c === "}") {
      emit(i);
      if (c === "}") stack.pop();
      start = i + 1;
    }
  }
  return declarations;
}

const inPrint = (decl) => decl.selectors.some((s) => /^@media\s+print\b/.test(s));

function checkColors({ rel, starts, report }, decls) {
  if (rel === THEME_FILE) return;
  const mermaidFile = /mermaid/i.test(path.basename(rel));
  for (const decl of decls) {
    const prop = decl.prop.toLowerCase();
    // Masks are luminance, not color; a printed page is black on white whatever the brand.
    if (/^(?:-webkit-)?mask/.test(prop) || inPrint(decl)) continue;
    for (const hit of [...decl.value.matchAll(HEX), ...decl.value.matchAll(COLOR_FN)]) {
      const literal = hit[0].replace(/\s+/g, " ");
      const line = lineOf(starts, decl.valueIndex + hit.index);
      if (mermaidFile && prop.startsWith("--")) {
        report.add(
          9,
          "literal-color",
          "review",
          rel,
          line,
          "defines a Mermaid diagram color as a literal",
          "keep a literal only where Mermaid cannot take var(), and keep it in sync with the brand tokens",
        );
      } else if (/shadow$|^filter$/.test(prop)) {
        report.add(
          9,
          "literal-color",
          "review",
          rel,
          line,
          `uses a literal color in ${prop}`,
          "if it is a brand color, point it at a token; a neutral shadow may stay",
        );
      } else {
        report.add(
          9,
          "literal-color",
          "error",
          rel,
          line,
          `sets ${prop} to the literal color ${literal}`,
          "point it at a brand token defined in tailwind/site/theme.css",
        );
      }
    }
  }
}

/**
 * An `!important` is explained when the nearest comment before it names `!important` (or Tailwind's
 * `!`) and ends inside the rule or within a few lines above it. One comment heading a run of rules
 * that answer the same Leed `!important` covers the run.
 */
function explained(comments, ruleLine, declLine) {
  const nearest = comments.filter((c) => c.end <= declLine).at(-1);
  return Boolean(nearest && nearest.end >= ruleLine - IMPORTANT_WINDOW && /important|`!`/i.test(nearest.text));
}

function checkImportant({ rel, starts, report, cssComments }, decls) {
  const alertsFile = /(^|\/)alerts?\.css$/.test(rel);
  for (const decl of decls) {
    const chain = decl.selectors.join(" ");
    const line = lineOf(starts, decl.index);
    const isAlert = alertsFile || /alert/i.test(chain) || decl.prop.startsWith("--alert-");
    if (isAlert && /color-mix\(/i.test(decl.value)) {
      report.add(
        10,
        "important",
        "error",
        rel,
        line,
        "uses color-mix() in an alert style",
        "point the alert at its own token",
      );
    }
    if (!/!\s*important/i.test(decl.value)) continue;
    if (isAlert) {
      report.add(
        10,
        "important",
        "error",
        rel,
        line,
        "uses !important in an alert style",
        "remove it; alert tokens need no extra weight",
      );
      continue;
    }
    // Reduced motion, print and Alpine's x-cloak are the standard places !important belongs.
    if (/prefers-reduced-motion|\[x-cloak\]/.test(chain) || inPrint(decl)) continue;
    if (explained(cssComments, lineOf(starts, decl.ruleIndex), line)) continue;
    const answersLeed = /\.leed-|#leed-|\.docs-|#docs-|\bmermaid\b/i.test(chain) || rel.startsWith("tailwind/docs/");
    report.add(
      10,
      "important",
      answersLeed ? "review" : "error",
      rel,
      line,
      answersLeed
        ? "uses !important against a Leed or Mermaid style with no comment naming the !important it answers"
        : "uses !important with no comment saying why",
      answersLeed
        ? "keep it only where Leed (or an inline style) writes !important, and say so in a comment above the rule"
        : "put the rule in the right layer (or unlayered under .leed-documentation) instead of raising its weight",
    );
  }
}

function checkHeaderHeight({ rel, starts, report }, decls) {
  for (const decl of decls) {
    const prop = decl.prop.toLowerCase();
    const line = lineOf(starts, decl.index);
    if (prop === "--height-header") {
      report.add(
        12,
        "header-height",
        "error",
        rel,
        line,
        "sets --height-header by hand; Leed measures it at runtime",
        "set --site-header-height in tailwind/site/theme.css as the fallback instead",
      );
    } else if (
      /^(?:min-|max-)?height$/.test(prop) &&
      /var\(--height-header\b/.test(decl.value) &&
      /header/i.test(decl.selectors.at(-1))
    ) {
      report.add(
        12,
        "header-height",
        "error",
        rel,
        line,
        "sizes the header from --height-header, which the header itself measures",
        "size the header from its content; layouts read --height-header to offset below it",
      );
    } else if (prop === "scroll-padding-top" && /var\(--height-header\)/.test(decl.value)) {
      report.add(
        12,
        "header-height",
        "error",
        rel,
        line,
        "reads var(--height-header) with no fallback",
        "use calc(var(--height-header, var(--site-header-height, 0px)) + var(--height-toc, 0px))",
      );
    }
  }
}

/** `@import`s in the Tailwind entry that take no layer, are not theme, docs or utility files, and say nothing. */
function checkUnlayeredImports({ rel, masked, starts, report, cssComments, readFile }) {
  if (rel !== TAILWIND_ENTRY) return;
  for (const match of masked.matchAll(/@import\s+(?:url\()?["']([^"']+)["']\)?([^;]*);/g)) {
    const target = match[1];
    if (/layer\(/.test(match[2]) || !target.startsWith(".")) continue;
    if (path.posix.basename(target) === "theme.css" || /(^|\/)docs\//.test(target)) continue;
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(rel), target));
    if (/@utility\s+color-theme-/.test(readFile(resolved) ?? "")) continue;
    const line = lineOf(starts, match.index);
    if (commentAbove(cssComments, line, 1)) continue;
    report.add(
      10,
      "unlayered-import",
      "review",
      rel,
      line,
      `imports ${target} with no layer and no comment saying why`,
      "import it into layer(base) or layer(components), or add a comment saying why it must stay unlayered",
    );
  }
}

/** Audits one stylesheet and returns its declarations, which the site-token check reads. */
export function auditStyle(rel, raw, report, readFile) {
  const starts = lineStarts(raw);
  const { masked, comments: cssComments } = maskComments(raw, CSS_COMMENT, starts);
  report.readAllowMarkers(rel, cssComments);
  const decls = cssDeclarations(blankStrings(masked));
  const ctx = { rel, masked, starts, report, cssComments, readFile };
  checkColors(ctx, decls);
  checkImportant(ctx, decls);
  checkHeaderHeight(ctx, decls);
  checkUnlayeredImports(ctx);
  return { decls, starts };
}
