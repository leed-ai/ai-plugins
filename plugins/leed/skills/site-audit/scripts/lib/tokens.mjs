import fs from "node:fs";
import path from "node:path";
import { THEME_FILE } from "./constants.mjs";
import { lineOf, walk } from "./text.mjs";

/** Rule 9's site-token contract: every `--site-*` color set, each pointing at a brand token. */

const HEADER_HEIGHT = "--site-header-height";

/** The `--site-*` color names Leed's reference lists, and every `--site-*` name Leed's static files mention. */
function referenceTokens(appRoot) {
  let text;
  try {
    text = fs.readFileSync(path.join(appRoot, "static", "tailwind", "site-tokens.reference.css"), "utf-8");
  } catch {
    return null;
  }
  const block = text.match(/\/\*\s*:root\s*\{([\s\S]*?)\}\s*\*\//);
  const required = block ? [...block[1].matchAll(/^\s*(--site-[\w-]+)\s*:/gm)].map((m) => m[1]) : [];
  const known = new Set([...text.matchAll(/--site-[\w-]+/g)].map((m) => m[0]));
  for (const file of walk(path.join(appRoot, "static"))) {
    if (!/\.(css|hbs)$/.test(file)) continue;
    for (const name of fs.readFileSync(file, "utf-8").matchAll(/--site-[\w-]+/g)) known.add(name[0]);
  }
  return { required, known };
}

/**
 * `styleDecls` maps each audited stylesheet to its declarations. In full mode this also reports the
 * reference names nothing sets and names Leed does not read; in changed mode only literal values.
 */
export function checkSiteTokens(appRoot, styleDecls, report, full) {
  const hasTheme = styleDecls.has(THEME_FILE);
  if (!hasTheme) {
    if (full) {
      report.add(
        9,
        "site-token",
        "review",
        THEME_FILE,
        0,
        "the site has no theme.css, so no brand tokens and no --site-* values are defined",
        "define the brand tokens on :root in tailwind/site/theme.css, point every --site-* at them, and import it from site.config.css",
      );
    }
    // Without theme.css, a --site-* literal set elsewhere is still checked below; the unset-token check is not.
  }
  const tokens = appRoot ? referenceTokens(appRoot) : null;
  const setsSiteToken = [...styleDecls.values()].some(({ decls }) => decls.some((d) => d.prop.startsWith("--site-")));
  if (!tokens && (hasTheme || setsSiteToken))
    report.note("site token check limited: no --app-root, so unset and unknown --site-* names were not checked");
  const set = new Set();
  for (const [rel, { decls, starts }] of styleDecls) {
    for (const decl of decls) {
      if (!decl.prop.startsWith("--site-")) continue;
      set.add(decl.prop);
      const line = lineOf(starts, decl.index);
      // A color is any name in the reference block or, as without --app-root, any --site-* but the
      // header height: a name missing from the reference is still a color a site may set.
      const color = tokens?.required.includes(decl.prop) || decl.prop !== HEADER_HEIGHT;
      if (color && !/var\(/.test(decl.value)) {
        report.add(
          9,
          "site-token",
          "error",
          rel,
          line,
          `sets ${decl.prop} to ${decl.value.trim()} instead of a brand token`,
          `point ${decl.prop} at a brand token with var(--...)`,
        );
      }
      if (full && tokens && !tokens.known.has(decl.prop)) {
        report.add(
          9,
          "site-token",
          "review",
          rel,
          line,
          `sets ${decl.prop}, which Leed does not read`,
          "check the name against site-tokens.reference.css: a typo, or a token nothing reads that should be deleted",
        );
      }
    }
  }
  if (!full || !tokens || !hasTheme) return;
  const missing = tokens.required.filter((name) => !set.has(name));
  if (missing.length > 0) {
    report.add(
      9,
      "site-token",
      "error",
      THEME_FILE,
      0,
      `leaves ${missing.length} --site-* token(s) unset: ${missing.join(", ")}`,
      "set each one in theme.css, pointing at a brand token, in both the light and dark blocks where they differ",
    );
  }
}
