import { lineOf } from "./text.mjs";

/**
 * Rule 14: site-wide `<head>` content belongs in `header-includes.hbs`, which `leed/head` renders on every page.
 * In `site-template.hbs` it misses every documentation and API page, whose Leed layout that template does not wrap,
 * so it is an error there. In a layout it reaches one page type only, which is right for a tag only that type needs,
 * so it is for review. A web font from a font host is reported wherever it is, header-includes.hbs included:
 * font hosts log every visitor, so the fix is a font Leed installs or a self-hosted `.woff2`, never a move.
 */

const SITE_TEMPLATE = "src/_includes/site-template.hbs";
const HEADER_INCLUDES = "src/_includes/header-includes.hbs";

/** Hosts that serve web fonts: a stylesheet from one is a site-wide font. */
const FONT_HOSTS = [
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "fonts.bunny.net",
  "use.typekit.net",
  "fast.fonts.net",
];

/** What `classify` calls any link to a font host: a stylesheet, a preconnect or a dns-prefetch. */
const FONT_HOST = "a link to a web font host";

/** The fix for a font host, wherever it is linked. */
const SELF_HOST =
  "use a font Leed installs (font-inter, font-noto-sans and the rest), or self-host the family: its .woff2 files in src/static/webfonts/ with an @font-face rule. Never link a font host, which logs every visitor";

/** Hosts that serve analytics and tag-manager scripts. */
const ANALYTICS_HOSTS = [
  "googletagmanager.com",
  "google-analytics.com",
  "plausible.io",
  "usefathom.com",
  "hotjar.com",
  "clarity.ms",
  "segment.com",
  "posthog.com",
  "cloudflareinsights.com",
  "hs-scripts.com",
  "amplitude.com",
  "mxpnl.com",
  "snap.licdn.com",
  "connect.facebook.net",
];

/** Verification metas: Google, Bing, Facebook, Yandex, Pinterest and the `*-site-verification` family. */
const VERIFICATION =
  /^(?:[\w-]+-site-verification|[\w-]+-domain-verification|msvalidate\.01|yandex-verification|p:domain_verify)$/i;

/** An inline script that boots analytics: Google's gtag or dataLayer, Matomo's _paq. */
const INLINE_ANALYTICS = /\bgtag\s*\(|\bdataLayer\b|\b_paq\b/;

function attr(tag, name) {
  const match = tag.match(new RegExp(`(?<![\\w-])${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? (match[1] ?? match[2] ?? match[3]).trim() : null;
}

const fromHost = (url, hosts) => {
  const host = /^(?:https?:)?\/\/([^/?#:]+)/i.exec(url ?? "")?.[1]?.toLowerCase();
  return Boolean(host) && hosts.some((name) => host === name || host.endsWith(`.${name}`));
};

/** What a `<link>`, `<meta>` or `<script>` tag is, when it is site-wide head content; null otherwise. */
function classify(name, tag, body) {
  if (name === "link") {
    const rel = (attr(tag, "rel") ?? "").toLowerCase().split(/\s+/);
    const href = attr(tag, "href");
    if (fromHost(href, FONT_HOSTS)) return FONT_HOST;
    if (rel.includes("preconnect")) return "a preconnect hint";
    if (rel.includes("dns-prefetch")) return "a dns-prefetch hint";
    if (rel.includes("manifest")) return "the web manifest";
    if (rel.some((r) => r === "icon" || r === "apple-touch-icon" || r === "mask-icon")) return "an icon link";
    return null;
  }
  if (name === "meta") {
    const metaName = attr(tag, "name") ?? attr(tag, "property") ?? "";
    if (metaName.toLowerCase() === "theme-color") return "a theme-color meta";
    if (VERIFICATION.test(metaName)) return `a site verification meta (${metaName})`;
    return null;
  }
  if (fromHost(attr(tag, "src"), ANALYTICS_HOSTS)) return "an analytics script";
  if (INLINE_ANALYTICS.test(body)) return "an inline analytics script";
  return null;
}

export function checkSiteWideHead({ text, rel, starts, report }) {
  const isLayout = rel.startsWith("src/_layouts/");
  const isHeaderIncludes = rel === HEADER_INCLUDES;
  if (rel !== SITE_TEMPLATE && !isLayout && !isHeaderIncludes) return;
  for (const match of text.matchAll(/<(link|meta|script)\b[^>]*>/gi)) {
    const name = match[1].toLowerCase();
    let body = "";
    if (name === "script") {
      const close = text.indexOf("</script", match.index + match[0].length);
      body = close === -1 ? "" : text.slice(match.index + match[0].length, close);
    }
    const what = classify(name, match[0], body);
    if (!what) continue;
    const line = lineOf(starts, match.index);
    if (what === FONT_HOST) {
      report.add(14, "site-wide-head", isHeaderIncludes ? "review" : "error", rel, line, `writes ${what}`, SELF_HOST);
      continue;
    }
    if (isHeaderIncludes) continue;
    report.add(
      14,
      "site-wide-head",
      isLayout ? "review" : "error",
      rel,
      line,
      isLayout
        ? `writes ${what} in a layout, so it reaches only this page type`
        : `writes ${what} in site-template.hbs, which documentation and API pages do not use`,
      isLayout
        ? `if every page needs it, move it to ${HEADER_INCLUDES}; if only this page type does, keep it and add a "site-audit: allow site-wide-head" comment saying why`
        : `move it to ${HEADER_INCLUDES}, which leed/head renders first in <head> on every page, documentation pages included`,
    );
  }
}
