---
name: analytics
description: Answers questions about how a Leed site performs from Know analytics (`/leed:analytics`) — docs, pages, people, agents, accounts, releases, campaigns and email — through the CMS MCP tools `get_know_view`, `run_saved_view`, `get_analytics` and `get_gap`, or `leed know`. Also turns Search & gaps "What to write next" items into drafts: reads a gap's evidence, decides between a new page and a revision of an existing one, creates the linked draft or writes tracked suggestions, and leaves publishing to people and the release. Use when someone asks what to write next, whether a release landed, who at an account is reading, what agents ask, or how any page, campaign or email did.
---

# Know Analytics Skill

You answer questions from Know, the CMS's analytics, with the same numbers the Know screens show, and you draft content for the gaps Know finds. Know is read through two surfaces only: the CMS MCP tools and the `leed know` CLI. There are no CSV exports and no webhooks, so never offer either, and never copy rows that name people anywhere else.

## Before starting

1. **Pick the surface.** Over MCP use `get_know_view`, `run_saved_view`, `get_analytics` and the gap tools. Use the CLI when `leed --version` works and `leed auth status --json` says the user is signed in and they want a file or a script; always pass `--json` and read the envelope (`ok`, then `data`, or `error.code`, `error.message`, `error.hint`). Outside a site checkout pass `--company <companyId>` (and `-e <env>` when needed). When neither is connected, run `/leed:setup`.
2. **Find the view.** `references/views.md` maps each question to a view, its sections, its own filters and its parameters. When unsure what a view takes, list them: `get_know_view` with no `view`, or `leed know views --json`. Never pass a filter a view does not declare; both surfaces refuse it and name the view's filters.
3. **Pick the window.** Pass ISO-8601 `start` and `end` (at most 365 days apart). With no window from the user, use the last 30 days ending now, which is the CLI's default and the Know screens'. `get_know_view` has no default: it requires both with a `view`.

## Reading a view

- **The window is echoed.** The response's `start` and `end` are the window actually queried, after the plan's analytics retention clamp. Report those dates, not the ones you asked for, and say when the start was moved. A window entirely older than retention is refused with an upgrade error; say so rather than retrying.
- **The plan limits what you see.** A view the plan does not include answers `gated: true` with its `flag` and `totals`, and `sections: null`. A section gated on its own flag inside an ungated view answers `{ gated: true, flag, total }`. Both are successes: report the totals and the flag that would unlock the rest, and never retry. People and accounts are counted only inside the plan's visible-contact limit, so a list of people shows only the contacts the plan can see; never present it as everyone.
- **Filters.** The shared filters and their defaults are in `references/views.md`. Two notes from the descriptors: `peopleOnlyFilters` (referrer and channel on Overview and Pages) narrow people's figures only, and `unfilteredSections` (Overview's latest release card) ignore Overview's traffic filters. Say so when you apply them.
- **Saved views.** `run_saved_view` with no `id` lists the saved views the caller can see; with `id` it runs one over its own window and filters, and reports any saved filter that no longer applies. The CLI is `leed know run <id|exact name>`. `save_view` saves a view's filters under a name when the user asks for one.
- **One metric.** `get_analytics` returns a single metric over a window (`list_analytics_metrics` lists them). Prefer a Know view when one answers the question, since its numbers match the screen.

## MCP or the CLI

- **MCP** fits a conversation: reading views, following a link from one view to another, and the gap workflow. Operator MCP reads are listed on Know's Data access screen.
- **The CLI** fits a file or a script. `leed know show <view>` takes the shared filters as flags and a view's own filters and parameters as `--filter key=value`. Sections that name people (each view's `personSections`) never go to stdout: pass `--out <file>` and they are written there as JSON with mode `0600`, with `{ written: <rows> }` in their place. Without `--out` the command refuses, and a file inside a git repository that does not ignore it is refused too. Tell the user where the file is and that it holds people's details; do not read it back into the conversation unless they ask. `leed know` reads are not recorded on the Data access screen.

## What to write next

When the user asks what to write next, or to draft for the gaps, follow `references/gap-workflow.md`: list the items with `get_know_view` `view: "searchGaps"`, read one with `get_gap`, decide between a new page and a revision of an existing one, then either `create_page_from_markdown` with `gap`, or put the existing page `IN_REVISION` and write tracked suggestions stamped with `sourceId`, then `mark_gap_in_progress`. The item then shows In progress with its page. You never publish: people accept or reject the suggestions and publish the draft, and docs pages publish with the release that carries their source id.

**When the pages are written, hand them over for review.** This applies to pages written to the CMS; a sandbox has no editor. Tell the user:

1. Which pages were written, each with its editor link, `<CMS origin>/pages/<pageId>`, built from the page ids the writes returned. The CMS origin is the environment the site is on: `https://app.leed.ai` for production and `https://staging.app.leed.ai` for staging, read from `environment` in the CLI's results; over MCP alone, it is the origin of the CMS MCP server's URL.
2. That they can read and edit each page there, in the editor built for writing, and leave a comment on anything they want changed.
3. That they then say "review the comments on <page>", or run `/leed:review <page>`, and each comment is answered as a tracked suggestion they accept or reject in the editor.
4. For a user in more than one company: the link opens in the company that is active in their browser, so they switch to this site's company first.

**Once a page has comments, write only suggestions.** Before writing to a page that already exists, read its open comment count: over MCP, `openCommentCount` from `get_page`; with the CLI, `data.counts.comments` from `leed page review <pageId> --include-types text,emoji --json`. Above zero, the person has read the draft and is reviewing it, so write only tracked suggestions, with `update_page_body` and `mode: "suggest"` or with `leed page update <pageId> --block <dataId> --suggest`, or stop and offer `/leed:review`. Never write in `direct` mode, never call `set_page_body` with `overwrite`, and never replace the whole body with `leed page update` without `--block`.

## Rules

- **Agents are signed in or anonymous, nothing more.** Never show, estimate or invent a breakdown by agent client (Claude Code, Cursor or any other). Know does not record one.
- **Reading depth over bounce.** Engagement is reading depth: the share of a page's estimated reading time readers spent on it (median depth, and "read to end" at 75% or more). Lead with it; mention bounce rate only when asked.
- **No drift status.** Know cannot tell whether a page has drifted from the product. Do not claim a page is out of date from analytics; report what Know shows, such as pages in revision, falling reads or questions no page answers.
- **Only people accept or reject suggestions, and only people publish.** Never call a publish or schedule tool from this skill.
- **Data leaves only through MCP and the CLI.** No CSV, no spreadsheet, no pasting a people section into a document or a message. Aggregates in your answer are fine.
- **Name people only from sections that name them**, and only when the user asked about people. Never infer who someone is from an anonymous read.
