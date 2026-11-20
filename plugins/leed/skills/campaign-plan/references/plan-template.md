# The plan: pillars, the plan block, refs, slots and the calendar

The plan is the campaign's deliverables: each pillar post and its social cuts, on the Plan calendar. This file lays out a pillar, the plan block at the top of its `detail`, the refs, the slots and the calendar table shown before the write.

## Pillars

A pillar is one post, aimed at one persona at one journey stage:

- **A primary and a secondary keyword,** two different terms, each the term of a finding from a `keywords` run, whose claim reads `Keyword "<term>": <intent> intent; <evidence>`. A keyword is the primary of at most one pillar, so two posts never compete for one search.
- **The intent** its primary keyword's finding states: `informational` suits awareness, `commercial` consideration and `transactional` decision.
- **The questions it answers:** the brief's questions for its persona at its stage. Its cuts list a subset of them.
- **The messages it carries,** by their `CM-` ids.
- **A working title and a slug.** The slug is lowercase words joined by hyphens, and neither another pillar nor any page of the posts type has it yet: check every row `list_pages` returns for the posts type, drafts included.
- **At least two internal links,** by `pageId`, to two different pages other than the pillar's own, each a published page: `hasBeenPublished: true` in `list_pages`, or a `search_posts` or `search_documentation` hit.
- **A social cut for every `(channel, account)` entry** in the campaign's `channels`. With `channels: []`, the campaign is posts only and pillars have no cuts.

A pillar states no search volume its finding does not quote. Most keyword findings say "volume qualitative", and so does the plan.

## The plan block

The plan block is the first lines of a pillar's `detail`, exactly these lines in this order:

```text
Plan (campaign-plan)
Primary keyword: <term> (F-07)
Secondary keyword: <term> (F-09)
Intent: <intent>
Slug: <slug>
Canonical URL: https://<public.domain>/<posts type slug>/<slug>/
Internal links: <pageId>, <pageId>
Messages: CM-01, CM-03
```

- Each keyword line gives the term as its finding's claim names it, then the finding's id in parentheses. When research was skipped and the brief holds no `keywords` run, the line gives the term, then `(no research)`.
- Lists are joined with ", ".
- Campaign-draft keeps the block and writes its own blocks below it, after a blank line. `check plan` reads only the block at the top, so those blocks never change its verdict.
- When a deliverable's `detail` changes, replace only its first block (the lines up to the first blank line) and send everything below it unchanged. `update_campaign_deliverable` replaces the whole `detail`, so a re-run that sent the plan block alone would erase campaign-draft's SEO brief, image brief and claims list.

A pillar for the post "Why documentation drift starts on release day" opens its `detail` with:

```text
Plan (campaign-plan)
Primary keyword: documentation drift (F-03)
Secondary keyword: docs out of date (F-04)
Intent: informational
Slug: why-docs-drift
Canonical URL: https://example.com/blog/why-docs-drift/
Internal links: page-stale-docs-cost, page-release-docs
Messages: CM-01, CM-04
```

## The canonical URL

The canonical URL is `https://`, the company's `public.domain` from `get_company_overview`, then the page's public path as the CMS composes it: the posts type's `slug` from `list_page_types`, then each segment of the page's folder `path` from `list_pages`, then the post's slug, each followed by `/`. A root posts type, whose slug is `""`, adds no segment.

- A new post sits in no folder, so its path is `/<posts type slug>/<slug>/`. With the domain `example.com`, the posts type `blog` and the slug `why-docs-drift`, it is `https://example.com/blog/why-docs-drift/`.
- An adopted draft keeps its folder. In the folder `guides/2026`, the same post is `https://example.com/blog/guides/2026/why-docs-drift/`.
- An unmanaged pillar's URL comes from its file instead: `sitePath` `src/compare/leed-vs-acme.hbs` builds `/compare/leed-vs-acme/`, and `src/compare/index.hbs` builds `/compare/`. Its slug is the file's name, so with the domain `example.com` its canonical URL is `https://example.com/compare/leed-vs-acme/`. `check plan` fails a file named other than the slug, or a canonical URL that does not end in the path the file builds.

## Refs

| Ref | Deliverable | Type | Channel |
|---|---|---|---|
| `P<n>` | A pillar | `new-page` | |
| `P<n>-li-<k>` | A LinkedIn cut of pillar `P<n>` | `social` | `linkedin` |
| `P<n>-x-<k>` | An X cut | `social` | `x` |
| `P<n>-bs-<k>` | A Bluesky cut | `social` | `bluesky` |
| `P<n>-dc-<k>` | A Discord cut | `social` | `discord` |

- `n` numbers the pillars from 1, and `k` counts one pillar's cuts on one channel from 1. Neither has a leading zero.
- A ref is unique within the campaign. A rejected deliverable's ref stays taken, so the asset that replaces it takes the next free number.
- A deliverable a person planned by hand in the app has no ref. It is not a plan asset, and the plan leaves it alone, but it still counts toward coverage, spacing and the date rules.
- A finding only a change to a deliverable this skill leaves alone would fix does not block the write: one with no ref, an `approved` one for anything but its `questionIds` and `sequence`, or a dropped draft left for a person to remove. `check plan` names a deliverable with no ref by its id. Show the finding with that deliverable, and list it for `/leed:campaign-schedule`, the Plan calendar or the campaign page. Every other finding is fixed before the write.

## Each cut

- **`title`:** the channel and the pillar's title, as "LinkedIn post: <title>".
- **`detail`:** two lines, its angle and its hook direction, with campaign-draft's notes added below later, after a blank line:

  ```text
  Angle: release-day docs are wrong because they ship days after the code.
  Hook direction: open with the Friday docs fix after a Tuesday release.
  ```

  When a deliverable's `detail` changes, replace only its first block (the lines up to the first blank line) and send everything below it unchanged, so campaign-draft's hook variants and claims list survive a re-run.

- **One distinct angle per cut:** a finding, a quote, a how-to, an objection answered. Two cuts of one pillar on one channel never share an angle.

## Slots

A slot is written `D<+|-><n> HH:MM`: the day, counted from Day 0, the campaign's `launchDate`, with `n` from 0 to 365, then a 24-hour time in the campaign's `timezone`. Every slot is in that one timezone; there is no second one. `calendar materialize` turns the slots into instants.

Start from `../campaign-patterns/references/timing.md` and `../campaign-patterns/references/channels.md`. The company's analytics, the team's experience and the user's word override those defaults.

- **Day −7 to Day −1:** posts on the problem, without the product and with no hard call to action.
- **Day 0:** the launch pillar in the morning (`D+0 09:00`), then each channel's launch cut, staggered through the day. `check plan` fails two launch-day deliverables less than 60 minutes apart.
- **Day +1 to Day +3:** a second angle on each channel, and answers to the questions the launch raised.
- **Day +4 to `endDate`:** the rest of the pillars and their follow-ups, at the cadence in `timing.md`.
- **Pillars** publish Tuesday to Thursday, early in the morning, before any cut that links to them. A cut is never dated before its pillar.
- **LinkedIn:** never two posts from one account on one day.
- **The window:** nothing before `startDate` or after `endDate`, and no draft at or before now.

The input `calendar materialize` takes, and one slot it prints:

```json
{
  "campaign": { "launchDate": "2026-11-17", "timezone": "America/New_York" },
  "slots": [
    { "ref": "P1", "slot": "D+0 09:00" },
    { "ref": "P1-li-1", "slot": "D+0 10:30" }
  ]
}
```

```json
{
  "ref": "P1",
  "slot": "D+0 09:00",
  "date": "2026-11-17",
  "weekday": "Tuesday",
  "local": "2026-11-17 09:00",
  "utcOffset": "-05:00",
  "scheduledDate": 1794924000000,
  "iso": "2026-11-17T14:00:00.000Z"
}
```

Pass `campaign` as `get_campaign` returned it. `--day0 YYYY-MM-DD` and `--tz <IANA>` override its `launchDate` and `timezone`, for a what-if before a launch date moves.

## Adopting an existing draft

A posts page in `list_pages` with `status` `DRAFT` or `IN_REVISION` and `hasBeenPublished: false` can be a pillar instead of a new post:

- the pillar's deliverable sends the page's `pageId`, and its cuts send it too;
- the pillar's title is the page's title, and its `Slug` the page's slug, so its canonical URL is that page's;
- a page that another active deliverable of this campaign links is not adopted again;
- a page that `get_plan_calendar` shows under another campaign's approved deliverable is skipped. Read the calendar from a year before the campaign's `startDate` to a year after its `endDate` (its `launchDate` for either one that is unset), so an approved deliverable whose date has passed while its page is still a draft is seen too.

Adoption writes nothing to the page. Campaign-draft rewrites it for the plan later.

## The calendar table

Before the write, show one row per deliverable, in `sequence` order:

| Date and time | Ref | Type | Channel and account | Persona | Stage | Questions | Page and navigation |
|---|---|---|---|---|---|---|---|
| Tue 2026-11-17 09:00 | P1 | new-page | | Docs lead | Awareness | Q-01, Q-02 | Leed Markdown post |
| Tue 2026-11-17 10:30 | P1-li-1 | social | LinkedIn, Acme Docs company page | Docs lead | Awareness | Q-01, Q-02 | |
| Tue 2026-11-17 11:30 | P1-x-1 | social | X, Acme Docs | Docs lead | Awareness | Q-01 | |
| Thu 2026-11-19 09:00 | P2 | new-page | | Docs lead | Consideration | Q-04 | unmanaged, `src/compare/acme-vs-docsy.hbs`; Header menu ▸ Compare |

The date and time are local, in the campaign's timezone, named once above the table. On a re-run, add a column for what happens to each row: added, changed (with the fields), rejected, or left alone.
