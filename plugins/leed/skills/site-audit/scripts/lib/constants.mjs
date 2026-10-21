/**
 * What the audit knows about Leed. Each list is kept equal to its source by a drift test in
 * the plugin package, so a Leed release that changes one fails a test rather than the audit.
 */

/** Rule numbers and their bold titles in site-patterns SKILL.md. */
export const RULES = {
  1: "Menus: always `leed/menu/builder`, one builder for desktop and mobile.",
  2: "Forms: always `leed/form`.",
  3: "Recommendations and CTAs: always `data-leed-recommendations` and `data-leed-cta`.",
  4: "Pagination, reading progress and docs search: use Leed's components.",
  5: "Links: internal links use `pageid:<uuid>`, or `pageid:list-<id>` for a paginated index. Never a path.",
  6: "Images: asset-manager images use `ImageTag`, `FeatureImage` or `Image`, sized to the widest the container can ever be.",
  7: "Lists of pages: always a Leed collection. Never filter by hand or in JavaScript.",
  8: "Layouts: one layout per page type, driven by frontmatter, with a header comment listing the fields it expects.",
  9: "Color: brand tokens are defined once on `:root` in `tailwind/site/theme.css`, and dark mode redefines the same names.",
  10: "CSS layers: site styles go in `layer(base)` or `layer(components)`.",
  11: "Handlebars: never use a bare name that collides with a global helper.",
  12: "Header height: `--height-header` is measured at runtime and is what layouts read; `--site-header-height` is the fallback the author sets.",
  13: "What can be customized depends on the plan tier: read it from `leed site eject --json`, never hard-code it.",
  14: "Site-wide `<head>` content goes in `src/_includes/header-includes.hbs`, never in `site-template.hbs` or a layout.",
};

/** Partials the Leed build finds by name, so nothing in the site has to reference them (rule 13). */
export const BUILD_USED_INCLUDES = [
  "src/_includes/site-template.hbs",
  "src/_includes/stub-template.hbs",
  "src/_includes/header-includes.hbs",
  "src/_includes/docs-header.hbs",
  "src/_includes/docs-footer.hbs",
  "src/_includes/docs-page-cta.hbs",
  "src/_includes/api-page-cta.hbs",
  "src/_includes/unsubscribe.hbs",
  "src/_includes/unsubscribed.hbs",
];

/**
 * Shortcodes that render a site partial named by their first argument, as `{{> <name> }}`:
 * `{{ svgDiagram "svg/chart-1" }}` uses `src/_includes/svg/chart-1.hbs` (rule 13).
 */
export const PARTIAL_SHORTCODES = ["svgDiagram"];

/**
 * Leed partials that render a partial named by one of their hash values, `{{> (lookup . "<key>") }}`:
 * `{{#> leed/docs/shell header="my-header" }}` uses `src/_includes/my-header.hbs` (rule 13).
 * Used when no --app-root is given; with one, the list is read from Leed's own partials.
 */
export const LOOKUP_PARTIALS = [{ partial: "leed/docs/shell", key: "header" }];

/** Rule 8: new page types start on this layout, so it is kept even while no page type names it. */
export const STARTER_LAYOUT = "src/_layouts/empty.hbs";

/** The Tailwind entry the build compiles. Everything it imports is used too. */
export const TAILWIND_ENTRY = "tailwind/site.config.css";

/** Where brand tokens and every `--site-*` value are defined (rule 9). */
export const THEME_FILE = "tailwind/site/theme.css";

/**
 * Fallback snapshot of the ejectable templates. Used only to recognize an override as a
 * build-used file. It never drives an eject suggestion: those come from the site's own
 * `leed site eject --json` listing, which follows its plan.
 */
export const EJECT_TEMPLATES = [
  { name: "stub-template", destination: "src/_includes/stub-template.hbs" },
  { name: "unsubscribe", destination: "src/_includes/unsubscribe.hbs" },
  { name: "unsubscribed", destination: "src/_includes/unsubscribed.hbs" },
  { name: "docs-header", destination: "src/_includes/docs-header.hbs" },
  { name: "docs-footer", destination: "src/_includes/docs-footer.hbs" },
];

/** Layouts Leed provides, which a page type may name without the site holding the file. */
export const LEED_LAYOUTS = ["leed-documentation.hbs"];

/** Path prefixes the site's worker answers, which are not page links. */
export const WORKER_ROUTES = ["/api/", "/f/", "/s/", "/e/", "/mcp", "/.well-known/"];

/** Path prefixes that are never pages: Leed's static files and Cloudflare's image and edge routes. */
export const NON_PAGE_PREFIXES = ["/static/", "/cdn-cgi/"];

/** Every check id a finding carries, which is also what a `site-audit: allow <check>` marker may name. */
export const CHECK_IDS = [
  "bare-helper",
  "code-block-column",
  "hand-filtered-collection",
  "hand-written-nav",
  "header-height",
  "image-variant",
  "important",
  "literal-color",
  "missing-layout",
  "path-link",
  "site-token",
  "site-wide-head",
  "tier-override",
  "unlayered-import",
  "unreferenced",
];

/** Global helpers that need arguments, so a bare `{{ name }}` renders empty instead of reading a field. */
export const BARE_HELPERS = ["label", "user", "pageType", "collection", "sorted", "Labels", "Authors"];

export function constants() {
  return {
    RULES,
    BUILD_USED_INCLUDES,
    PARTIAL_SHORTCODES,
    LOOKUP_PARTIALS,
    STARTER_LAYOUT,
    TAILWIND_ENTRY,
    THEME_FILE,
    EJECT_TEMPLATES,
    LEED_LAYOUTS,
    WORKER_ROUTES,
    NON_PAGE_PREFIXES,
    CHECK_IDS,
    BARE_HELPERS,
  };
}
