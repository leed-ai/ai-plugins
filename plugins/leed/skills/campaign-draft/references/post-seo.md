# Pillar posts: the SEO brief, the body and the metadata

A pillar post is written to rank for its plan block's primary keyword and to answer its brief questions for its persona at its journey stage. This file has what campaign-draft writes for each pillar, and what `check post` holds it to before and after the write.

## The SEO brief

Written into the pillar's `detail`, below the plan block, in the form `references/detail-format.md` gives.

- **Search results:** what ranks for the primary keyword today, from the brief's `serp` findings, each citing its finding. Without `serp` research on the brief, say so; never describe search results from memory.
- **Gaps:** what those results miss that this post can give the persona, each citing the findings it rests on.
- **Angle:** how the post fills the gaps, in one line.
- **Outline:** the post's `##` sections in order, each with the brief questions it answers. Every question in the deliverable's `questionIds` is answered by at least one section.

## The body

Leed Markdown, as `../site-builder/references/leed-markdown-format.md` sets out, on the shape of the posts skeleton `../site-builder/references/skeletons/posts-page.md`.

- **No `#` heading.** The title is the page's H1, and the site template renders it. The body opens with the subhead, a sentence or two that frames the post, and its sections are `##`.
- **The primary keyword** appears in the first 100 words, as written, and reads naturally there. Use it in a `##` heading where it fits, and the secondary keyword somewhere in the body.
- **Internal links:** at least two, as `[label](pageid:<pageId>)`, never a raw URL, and every target the plan block names among them. The label says what the reader gets.
- **Images** carry alt text that says what the image shows. No image is uploaded here.
- **Formatting:** only what the posts type's `editorFormattingOptions` allows (`list_page_types`). A posts type enables only code blocks by default, so a table becomes a list, and an alert, a diagram, math, a tab group, a collapsible block, an iframe or an icon is left out unless the type turns it on. A fenced block is a code block whatever its language, except one whose info string is `mermaid` alone, which is a diagram; math is the inline form, ``` ``math E = mc^2`` ```. Syntax quoted inside a code span is code, not the feature, so a post can show a tag the type disables by writing it between backticks; an iframe is the tag alone on its line, never straight after a paragraph's line.
- **Claims:** every claim traces to a source on the brief or a page it may cite, and a figure appears only when a cited quote or finding gives it. The claims list goes in `detail`, never in the body.
- **Voice:** the campaign's voice notes and the company's rules first, then the author's own style within them.

## The metadata

| Field | Rule | Where it is set |
|---|---|---|
| `title` | At most 60 characters, holding the primary keyword | `create_page_from_markdown`; for an adopted draft, `update_page_metadata` |
| `slug` | The plan block's `Slug`, exactly | `create_page_from_markdown`, never `update_page_metadata` |
| `labels` | Label ids from `list_labels`; never a new label. An adopted draft keeps the labels it holds | `create_page_from_markdown`; for an adopted draft, `update_page_metadata` |
| `plannedDate` | The deliverable's `scheduledDate` as a local date in the campaign's timezone, `YYYY-MM-DD` | `create_page_from_markdown`; for an adopted draft, `update_page_metadata` |
| `summary` | 140 to 160 characters, the meta description, holding the primary keyword where it reads naturally | `update_page_metadata` |
| `keywords` | The primary and secondary keywords first, then any others the post targets | `update_page_metadata` |
| `authors` | The pillar's `assigneeId` | `update_page_metadata` |
| `journeyId` | The deliverable's | `update_page_metadata` |
| `extraFrontmatter.canonicalUrl` | Only when the plan's canonical URL is not the page's own, and then exactly the plan's, keeping the other keys; removed from an adopted draft that holds one when the plan's is the page's own | `update_page_metadata` |
| `featureImage`, `ogCard` | Left unset | — |

An adopted draft has no create, so every field the table sets, its `title`, `labels` and `plannedDate` included, goes in `update_page_metadata`, except its slug, which is already the plan's and is never sent. It ends with the same metadata as a new post. `labels`, `keywords`, `authors` and `extraFrontmatter` each replace the page's whole value when sent.

`check post` counts lengths in UTF-16 code units, so an emoji counts 2.

## What `check post` checks

`check post` runs over the pillar and its social set, pending or written. Its input is `{ campaign, audience, brief, deliverables, page, pageMeta, pageTypes, labels, users, company }`: `page` is `get_page_body`'s result, `pageMeta` is `get_page`'s, whose `page` holds the metadata, and the lists are `list_page_types`, `list_labels` and `list_users`. A pending post has no `pageId` yet, so the checks on its cuts' page are skipped. Each finding is `{ section, id, message }`, where `id` is the pillar's ref or the cut's.

| Section | A finding when |
|---|---|
| `target` | the deliverable is not an active `new-page`, or its `detail` does not open with a complete plan block; the check stops there |
| `keyword` | the primary keyword is missing from the title, or from the body's first 100 words |
| `body` | the body has a `#` heading |
| `slug` | the slug is not the plan block's |
| `links` | the body links fewer than two other pages, or not a target the plan block names |
| `images` | a body image has no alt text, or the image brief no `Alt text` |
| `blocks` | the body uses a feature the posts type disables |
| `lengths` | the title is over 60 characters, the summary is under 140 or over 160, or there are no keywords |
| `metadata` | the page type, a label, an author, the journey stage or the planned date does not match, or a written post is not the page the deliverable links |
| `canonical` | with `company`, the plan's canonical URL is not on the company's domain, or `canonicalUrl` is set although the plan's canonical URL is the page's own, or is not the plan's although it differs |
| `detail` | the pillar lacks one of its three campaign-draft blocks, a cut with copy lacks its hook variants or its claims list, or the pillar's `detail` runs over 10,000 characters |
| `claims` | a claims entry is malformed, or its source does not resolve |
| `social` | a cut with copy is on another page, holds no link or two, or holds another URL |

A cut's write waits on the findings whose `id` is its ref, on a `target` finding, which stops the check before it reads the cuts, and on a check that checked nothing: a finding whose `id` is null, which refuses the input, or a usage error, which exits 2 with no findings. Any other finding on the pillar's ref, once the pillar has had its review or when the run never writes it, needs a human and never holds the cuts back. A pillar the run skips, such as one whose page is `PUBLISHED` or `SCHEDULED`, is checked as `get_page` and `get_page_body` return it, and its cuts wait for no review of it.

It warns, without failing, when the primary keyword is missing from the slug, the summary or every `##` heading, when the secondary keyword is missing from the body, when a cut has no copy yet, when a cut's short link is read without `company`, and when a claim cites a stale finding. It exits 0 with no findings, 1 with findings or input it cannot read, and 2 on a usage error. Input it cannot read is one finding whose `id` is null, on the part it lacks.
