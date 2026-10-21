import { blank, lineOf, lineStarts } from "./files.mjs";

/** What a stylesheet (or a page's `<style>` block) says about the design: custom properties, colors, fonts, files. */

export const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g;
export const COLOR_FN = /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(\s*[\d.][^)]*\)|\bcolor\(\s*[a-z][\w-]*\s[^)]*\)/g;
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "emoji",
  "math",
  "fangsong",
  "inherit",
  "initial",
  "unset",
  "revert",
  "-apple-system",
  "blinkmacsystemfont",
]);

const DARK = /prefers-color-scheme\s*:\s*dark|\.dark(?![\w-])|\[data-(?:theme|mode|color-scheme)=["']?dark\b/i;
const NEGATION = /:not\([^)]*\)/gi;

/**
 * A rule's color scheme: dark under a dark media query, the `.dark` class or `[data-theme="dark"]`,
 * light otherwise. A `:not(...)` is removed first, so `:root:not(.dark)` is light, and `.dark-text`
 * is a different class.
 */
export function schemeOf(selectors) {
  return selectors.some((s) => DARK.test(s.replace(NEGATION, ""))) ? "dark" : "light";
}

const URL_REF = /url\(\s*["']?([^"')]+)["']?\s*\)/g;

/** Each `url()` target in a CSS value or stylesheet, with its index. */
export function urlRefs(text) {
  return [...text.matchAll(URL_REF)].map((m) => ({ ref: m[1], index: m.index }));
}

/** Each declaration with its enclosing selectors and at-rules. Not a full parser: enough for nesting and at-rules. */
function declarations(masked) {
  const out = [];
  const stack = [];
  let start = 0;
  const emit = (end) => {
    const raw = masked.slice(start, end);
    const body = raw.trim();
    if (stack.length === 0 || !body) return;
    const colon = body.indexOf(":");
    if (colon === -1) return;
    const at = start + raw.length - raw.trimStart().length;
    out.push({
      index: at,
      prop: body.slice(0, colon).trim(),
      value: body.slice(colon + 1).trim(),
      selectors: [...stack],
    });
  };
  for (let i = 0; i < masked.length; i++) {
    const c = masked[i];
    if (c === "{") {
      stack.push(masked.slice(start, i).trim());
      start = i + 1;
    } else if (c === ";" || c === "}") {
      emit(i);
      if (c === "}") stack.pop();
      start = i + 1;
    }
  }
  return out;
}

export function colorLiterals(value) {
  const masked = value.replace(/url\([^)]*\)/g, blank);
  return [...masked.matchAll(HEX), ...masked.matchAll(COLOR_FN)].map((m) => m[0].replace(/\s+/g, " "));
}

export function fontFamilies(value) {
  return value
    .split(",")
    .map((part) => part.trim().replace(/^["']|["']$/g, ""))
    .filter((name) => name && !/^var\(/.test(name) && !GENERIC_FAMILIES.has(name.toLowerCase()));
}

/** Font families a stylesheet or page link loads from a font host, e.g. `family=Inter:wght@400;700&family=Lora`. */
export function hostedFamilies(url) {
  return [...url.matchAll(/[?&]family=([^&:]+)/g)].map(([, name]) => decodeURIComponent(name.replace(/\+/g, " ")));
}

/**
 * Adds what `text` (CSS, or a page with everything but its `<style>` blocks blanked) holds to `inv`.
 * `refs` collects every `url()` and `@import` target, for the caller to resolve.
 */
export function scanCss(text, file, inv, refs) {
  const masked = text.replace(CSS_COMMENT, blank);
  const starts = lineStarts(masked);
  const imports = [];
  for (const m of masked.matchAll(/@import\s+(?:url\(\s*["']?([^"')\s]+)["']?\s*\)|["']([^"']+)["'])/g)) {
    const ref = m[1] ?? m[2];
    const line = lineOf(starts, m.index);
    imports.push([m.index, m.index + m[0].length]);
    refs.push({ ref, line });
    for (const family of hostedFamilies(ref)) inv.fonts.push({ family, source: "@import", file, line });
  }
  for (const { ref, index } of urlRefs(masked)) {
    if (!imports.some(([from, to]) => index >= from && index < to)) refs.push({ ref, line: lineOf(starts, index) });
  }
  for (const decl of declarations(masked)) {
    const line = lineOf(starts, decl.index);
    const context = schemeOf(decl.selectors);
    const selector = decl.selectors.filter((s) => !s.startsWith("@")).at(-1) ?? decl.selectors.at(-1);
    if (decl.prop.startsWith("--")) {
      inv.customProperties.push({ name: decl.prop, value: decl.value, selector, context, file, line });
    }
    for (const value of colorLiterals(decl.value)) {
      inv.colorLiterals.push({ value, property: decl.prop, context, file, line });
    }
    if (decl.prop.toLowerCase() === "font-family") {
      const source = decl.selectors.some((s) => /^@font-face/i.test(s)) ? "@font-face" : "font-family";
      for (const family of fontFamilies(decl.value)) inv.fonts.push({ family, source, file, line });
    }
  }
}
