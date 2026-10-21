/**
 * Recommendation preview — local development only.
 *
 * Written by /leed:create recommendations. The engine picks its own three and
 * only runs where it has something to return, so there is otherwise no way to
 * see the cards while building them. Loaded by header-includes.hbs, and only
 * when the build is serving — see **Two guards** below.
 *
 * ## Why this answers the request rather than writing the cards
 *
 * The engine asks /api/abby/v2/{pageId} for JSON and builds each card in the
 * browser: clone <template id="leed-stub-template">, fill the [data-leed-slot]
 * elements, format the date from the site's own dateFormat, derive the reading
 * time, stamp the UTM reason, append.
 *
 * So the honest place to stand in is the response, not the DOM. Answering that
 * one request leaves every line of that path — Leed's renderer, the site's
 * stub-template.hbs, the site's CSS — exactly as it runs in production, and the
 * only thing this file invents is which three posts come back. Building the
 * cards here instead would mean reimplementing the slot filling, which is the
 * part most worth seeing work.
 *
 * ## Where the three posts come from
 *
 * The list page the recommendation slot names, parsed. The slot carries
 * `data-preview-recommendations="<list url>"`, e.g. "/blog/", and each row of
 * that built list carries the data-attribute contract:
 *
 *   data-preview-post      the post's URL (the row's href when left empty)
 *   data-preview-title     its title
 *   data-preview-summary   its summary
 *   data-preview-image     its feature image URL, empty when it has none
 *   data-preview-date      its publishedAt, as an ISO 8601 date
 *
 * That is everything a card shows, so the preview is three real posts rather
 * than a fixture that goes stale as posts are added. What the list cannot
 * supply is wordCount, which is the CMS's; the reading times below are
 * stand-ins, chosen to differ so a row of cards shows the meta line at three
 * lengths.
 *
 * ## Two guards, because one of them cannot see far enough
 *
 * The file is its own script so the first guard can be the build's:
 * header-includes.hbs emits the tag only under `leedSiteEnv.env.serverMode`,
 * which is `leed site build --serve` and nothing else. A deployed page never
 * references this file, so the bytes are not in the bundle every reader
 * downloads and there is no shim to reason about in production.
 *
 * The hostname check below stays anyway. A served build is reachable from
 * another machine on the network — `--serve` binds a port, not a loopback
 * promise — and a colleague opening the preview on your laptop's address should
 * see the page, not three posts this file chose. Build time knows which command
 * ran; only run time knows who is looking.
 */
(function previewRecommendations() {
  const host = document.querySelector("[data-preview-recommendations]");
  if (!host) return;

  const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"]);
  if (!LOCAL.has(window.location.hostname)) return;

  const listUrl = host.getAttribute("data-preview-recommendations");
  if (!listUrl) return;

  const CARDS = 3;
  /* Stand-ins for the wordCount the list cannot carry, spread so the three
     cards do not all read the same. */
  const WORDS = [820, 1450, 1120];

  const realFetch = window.fetch.bind(window);

  /** A URL's path with any trailing slash dropped, so /blog/post and /blog/post/ compare equal. */
  function pathOf(url) {
    return new URL(url, window.location.origin).pathname.replace(/\/+$/, "");
  }

  /**
   * The first three posts of the list, as the engine would return them.
   *
   * Fields are the payload's, not the list's: `url`, `title`, `summary`,
   * `featureImage`, `publishedAt` as an epoch number so the <time> slot gets a
   * datetime and the site's date format, and `wordCount`, from which Leed
   * derives readingTime. `pageId` only reaches the UTM term on a link nobody is
   * clicking here, so the slug stands in for it.
   *
   * The post being read is skipped — recommending the page you are on is the
   * one result the engine would never return.
   */
  async function previewItems() {
    const res = await realFetch(listUrl);
    if (!res.ok) throw new Error(`list page ${listUrl} ${res.status}`);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const current = pathOf(window.location.href);

    return [...doc.querySelectorAll("[data-preview-post]")]
      .map((row) => ({ row, url: row.dataset.previewPost || row.getAttribute("href") || "" }))
      .filter(({ url }) => url && pathOf(url) !== current)
      .slice(0, CARDS)
      .map(({ row, url }, i) => {
        const when = Date.parse(row.dataset.previewDate ?? "");
        return {
          pageId: pathOf(url).split("/").pop(),
          url,
          title: row.dataset.previewTitle ?? "",
          summary: row.dataset.previewSummary ?? "",
          featureImage: row.dataset.previewImage ?? "",
          publishedAt: Number.isNaN(when) ? undefined : when,
          wordCount: WORDS[i % WORDS.length],
          authors: [],
          labels: [],
        };
      });
  }

  /*
   * Started now, awaited by the shim. The engine's request happens on
   * DOMContentLoaded behind an awaited session, and this file is deferred, so
   * the shim is always in place before the request is made — but the payload
   * it answers with may still be in flight, and a promise is what lets the
   * shim wait for it without holding up the page.
   *
   * A failure resolves to an empty array rather than rejecting: the engine
   * treats that as "nothing to recommend" and hides the section, which is the
   * same thing this page does with no preview at all. A rejected fetch would
   * instead abandon renderRecommendations mid-flight and leave the empty
   * section standing.
   */
  const items = previewItems().catch((err) => {
    console.warn("(preview) recommendations unavailable:", err.message);
    return [];
  });

  window.fetch = (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.includes("/api/abby/v2/")) return realFetch(input, init);

    return items.then(
      (payload) =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
  };
})();
