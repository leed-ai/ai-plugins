import { blank, lineOf } from "./text.mjs";

/** Per-file checks on how a Handlebars template styles itself: literal colors (rule 9) and header height (rule 12). */

/** A hex color, ending where the stylesheet check ends one: `#fade-in` and `#cafe_1` are ids, not colors. */
const HEX = "#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\\w-])";

/**
 * Literal colors in a template, folded into one finding per file: an SVG illustration can hold dozens.
 * `url(...)` is blanked first, as in a stylesheet, so `style="fill: url(#fade)"` names a gradient, not a color.
 */
export function checkTemplateColors({ text: raw, rel, starts, report }) {
  const text = raw.replace(/url\([^)]*\)/g, blank);
  const patterns = [
    new RegExp(
      `\\b(?:fill|stroke|stop-color|flood-color|lighting-color|color|bgcolor)\\s*=\\s*["']\\s*(${HEX}|(?:rgba?|hsla?)\\([^)]*\\))`,
      "g",
    ),
    new RegExp(`\\bstyle\\s*=\\s*["'][^"']*?(${HEX}|(?:rgba?|hsla?)\\(\\s*\\d[^)]*\\))`, "g"),
    new RegExp(`-\\[(${HEX})\\]`, "g"),
  ];
  const hits = new Map();
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const index = match.index + match[0].lastIndexOf(match[1]);
      if (!hits.has(index)) hits.set(index, match[1].replace(/\s+/g, ""));
    }
  }
  if (hits.size === 0) return;
  const ordered = [...hits.entries()].sort((a, b) => a[0] - b[0]);
  const colors = [...new Set(ordered.map(([, color]) => color))];
  const lines = [...new Set(ordered.map(([index]) => lineOf(starts, index)))];
  const shown =
    colors.length > 6 ? `${colors.slice(0, 6).join(", ")} and ${colors.length - 6} more` : colors.join(", ");
  report.add(
    9,
    "literal-color",
    "error",
    rel,
    lines[0],
    `writes ${hits.size === 1 ? "a literal color" : `${hits.size} literal colors`} in a template: ${shown}`,
    "use a brand token (a class such as text-accent, or var(--brand-token)) defined in tailwind/site/theme.css",
  ).lines = lines;
}

export function checkTemplateHeaderHeight({ text, rel, starts, report }) {
  const sizing = /(?:^|\s)(?:[\w-]+:)*(?:h|min-h|max-h)-(?:header\b|\(--height-header\)|\[var\(--height-header\)\])/;
  for (const match of text.matchAll(/<([a-zA-Z][\w-]*)\b[^>]*\bclass\s*=\s*["']([^"']*)["']/g)) {
    const hit = match[2].match(sizing);
    if (!hit) continue;
    // The header is a <header> or an element whose class ends in "header" (site-header); a header-spacer
    // or header-offset reading the height is a layout reading it, which rule 12 allows.
    const isHeader = match[1] === "header" || /(?:^|\s)[\w-]*header(?=\s|$)/.test(match[2].replace(hit[0], " "));
    report.add(
      12,
      "header-height",
      isHeader ? "error" : "review",
      rel,
      lineOf(starts, match.index),
      `${isHeader ? "sizes the header" : "sizes an element"} from --height-header (${hit[0].trim()})${isHeader ? ", which the header itself measures" : ""}`,
      'offset content with <div class="grow mt-(--height-header)">; size the header from its content and set --site-header-height as the fallback',
    );
  }
}
