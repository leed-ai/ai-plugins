# The detail blocks campaign-draft writes

A deliverable's `detail` is free text, at most 10,000 characters, and `update_campaign_deliverable` replaces it whole. Campaign-draft keeps what campaign-plan wrote at the top unchanged and writes its own blocks below it, each after one blank line, each opening with its title line. `check post` reads the blocks by those titles, and campaign-schedule reads the image brief, so write the titles and labels exactly as they are here. Never put a post's text or a cut's copy in `detail`.

## A pillar

The plan block stays first and unchanged, as campaign-plan wrote it. Below it come three blocks, in this order:

```text
SEO brief (campaign-draft)
Search results: <what appears for the primary keyword> (F-12)
Gaps: <what those results miss> (F-12, F-14)
Angle: <how this post fills them>
Outline: <## section> (Q-03); <## section> (Q-07); <## section> (Q-07, Q-09)

Feature image (campaign-draft)
Shows: <what the image shows>
Alt text: <alt text>

Claims (campaign-draft)
- <the claim, as the post states it> | finding F-07
- <claim> | page <pageId>
- <claim> | user CM-02
```

- **Search results and Gaps** each cite the `serp` findings they rest on. With no `serp` research on the brief, each says so: `Search results: the brief has no serp research`.
- **Outline** lists the post's `##` sections in order, each with the brief questions it answers.
- **Alt text** is never empty: campaign-schedule sets the feature image with it.
- **Claims** lists every claim the post makes, one per line, as `- <claim> | <kind> <id>`: the source after the last ` | ` is `page <pageId>`, `research S-nn`, `finding F-nn` or `user CM-nn`.

A whole pillar `detail`, as `check post` passes it:

```text
Plan (campaign-plan)
Primary keyword: documentation drift (F-03)
Secondary keyword: docs out of date (F-04)
Intent: informational
Slug: why-docs-drift
Canonical URL: https://example.com/blog/why-docs-drift/
Internal links: page-stale-docs-cost, page-release-docs
Messages: CM-01, CM-04

SEO brief (campaign-draft)
Search results: survey reports and opinion posts on documentation drift (F-07)
Gaps: none of them shows a working setup (F-07)
Angle: show that the drift starts on release day, and what readers notice first
Outline: ## Where the drift starts (Q-01); ## What a wrong page costs (Q-02); ## Ship the docs with the release (Q-01, Q-02)

Feature image (campaign-draft)
Shows: a release calendar with the code shipping on Tuesday and the docs on Friday
Alt text: A release calendar with the code shipping on Tuesday and the docs three days later

Claims (campaign-draft)
- Most teams update their docs after the release ships. | finding F-01
- We ship on Tuesday and fix the docs by Friday. | research S-03
- Readers notice the stale pages before the team does. | finding F-02
- Acme Docs publishes each docs change with the release that ships the code it describes. | page page-release-docs
```

## A social cut

Campaign-plan's angle and hook direction stay first and unchanged. Below them come two blocks:

```text
Hook variants (campaign-draft)
1. <hook> (used)
2. <hook>
3. <hook>

Claims (campaign-draft)
- <claim> | finding F-07
```

- **Hook variants** lists the two or three hooks written for the cut, numbered, with `(used)` after the one in `copy`.
- **Claims** lists every claim the copy makes, in the pillar's form. A `page` claim resolves against the pillar's post, so a page the post links may be cited. Copy that makes no claim still gets the block, its title line alone.

## Writing it

- Send `detail` whole, every time: the plan block or the angle first, then campaign-draft's blocks. Sending only the new blocks would erase what campaign-plan wrote.
- A redrafted asset replaces its own campaign-draft blocks and keeps everything above them.
- A `brief` run replaces only the SEO brief, and keeps an image brief and claims list already below it.
- An edit that adds, drops or changes a claim, a `##` section or the hook in use rewrites the blocks it touches, and sends `detail` whole as above.
- `check post` fails a pillar `detail` that does not open with the plan block, lacks one of its three blocks, has an image brief with no alt text, has a claim whose source does not resolve, or runs over 10,000 characters. It fails a cut with copy whose `detail` lacks its hook variants or its claims list, or has a claim whose source does not resolve.
