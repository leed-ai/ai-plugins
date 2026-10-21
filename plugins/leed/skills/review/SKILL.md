---
name: review
description: Answers the comments people leave on a page in the Leed editor (`/leed:review`) — reads every open comment thread with `leed page review` or the CMS MCP tool `get_page_review_state`, reads each thread in full, answers each one as a tracked suggestion the person accepts or rejects in the editor, never a direct edit, and reports per thread what was suggested, or why nothing was. Use when someone asks to review, answer or address the comments on a Leed page, or says "review the comments on <page>" after an agent wrote content they then commented on.
---

# Review Skill

You answer the comments a person left on Leed pages. The loop is theirs: an agent writes content into Leed, the person reads and edits it in the Leed editor, which is built for writing, and leaves a comment on anything they want changed. You read every open thread and answer each one with a **tracked suggestion**, which they accept or reject in the editor. Then they can comment again, and you go round again.

You never edit a commented page directly. A suggestion leaves the decision with the person; a direct edit takes it away, and on a block with an open thread it destroys the thread.

## Before starting

1. **Pick the surface: the CLI first.** Use `leed` when `leed --version` works and `leed auth status --json` says the user is signed in. Otherwise use the CMS MCP tools. Always pass `--json` to the CLI and read the envelope: `ok`, then `data`, or `error.code`, `error.message` and `error.hint`. Outside a site checkout nothing is defaulted, so pass `--company <companyId>` (and `-e <env>` when the company is signed in to more than one environment) to every `leed page` and `leed settings` command.
2. **Is the site's documentation released with `/leed:docs-ci`?** Look in the repository you are working in for a `## Documentation updates (Leed)` section in its `CLAUDE.md` or `AGENTS.md`. When it is there, every suggestion carries `sourceId`, the commit that section's stamping rule names (`git rev-parse origin/<stamp branch>`); otherwise pass none.
3. **Read `../site-patterns/SKILL.md`** when a comment asks for a template, menu, link or image change: a request that would break one of its rules is answered "no change, because" with the rule, never carried out.
4. **Read `references/review-state.md`.** It describes every field of the review state and the table that picks an op from a block's flags.
5. **Is the page published?** A `PUBLISHED` page is locked, and refuses every body write, suggestions included, with 409 "Page is locked for publishing". Read its status (`page.status` from `get_page`, or `data.status` from `leed page get <pageId> --json`). When it is `PUBLISHED`, tell the user that answering the comments puts the page into revision, and that it stays live as it is until it is published again, and ask before going on. Once they agree, put it into revision with MCP `update_page_metadata` with `pageId` and `status: "IN_REVISION"`, adding `sourceId` when step 2 found the docs-ci section. The CLI has no command that changes a page's status, so with the CLI alone ask the person to put the page into revision in the editor. Never publish the page yourself.

## 1. Which pages

The user names one page or several, by id, path or title:

- **An id** is used as it is.
- **A path** is resolved with `leed settings path resolve <path> --json` (MCP `resolve_path`), which returns its `pageId`. Both map live URLs only, so a draft's path (the pages a review most often runs on) resolves to nothing: then match the page by its title over MCP, as below, or ask the user for the id, which is the last part of the page's editor address (`<CMS origin>/pages/<pageId>`).
- **A title** is matched over MCP with `list_pages`, which returns each page's title. When two pages match, ask which. The CLI has no command that lists pages by title (`leed page sync-state` rows carry no title), so with the CLI alone ask the user for the page's path or id instead.

**With no page named**, find the pages that have open comments and ask which to review. Start with the pages this session wrote; otherwise ask which page type, and list its pages. For each candidate read the open comment count: over MCP, `openCommentCount` from `get_page`; with the CLI, `data.counts.comments` from `leed page review <pageId> --json`. Show each page above zero, with its title and count, and ask which to review. There is no single call that lists every page with comments, so never claim a page has none without reading its count.

## 2. Read the review state

For each page:

- **CLI:** `leed page review <pageId> --json`. The threads are in `data.blocks`.
- **MCP:** `get_page_review_state` with the `pageId`. The threads are in `blocks`.

Both answer the same document: one entry per block that carries a comment or a pending suggestion, in document order, each with its `dataId`, `markdown`, `text`, `hash`, its flags and its `comments`. The defaults are what a review needs, **open threads and text comments only**: pass `--status all` (MCP `status: "all"`) only when the user asks about resolved threads, and `--include-types text,emoji` (MCP `includeTypes: ["text", "emoji"]`) only when they ask about emoji reactions.

## 3. Read the whole thread

Each comment's `messages` is the thread flattened oldest first: element 0 is the opening comment and the last usually supersedes it. **Read every message before deciding anything.** A reply often narrows, reverses or replaces what the first message asked ("actually, keep the list, just shorten it"), and the answer follows what the thread asks now, which is usually its last message.

A thread is not always a change request. It can be a **question** ("is this still true for the Starter plan?"), a note to a colleague, or a decision already settled in the replies. Answer a question in your report and make no suggestion for it, unless the thread also asks for a change.

`quotedText` is the text the comment covers right now, and `start`/`end` index the block's `text`, **never its `markdown`**. A comment on an image, form, rule or embed covers the whole block, with all three null.

## 4. Plan one answer per thread

Every open thread gets exactly one entry in your plan, in document order: either **a suggestion** or **no change, because …** with the reason. Nothing is skipped silently.

A suggestion is built from the block the thread sits on, exactly:

- **The base** is the block's `markdown`: change what the thread asks and keep everything else byte for byte.
- **`anchorId`** is the block's `dataId`.
- **`baseHash`** is the block's `hash`, **verbatim**. Never construct, trim or reuse a hash from another read.
- **The op type** comes from the block's flags, exactly as `references/review-state.md` tabulates them: `canReplace` true allows a `replace` (or a `delete`, when the thread asks for the block to go). An insert answers only a thread that asks for **new content beside the block**, on a side whose `canInsertBefore` or `canInsertAfter` is true; the insert's `markdown` is the new block alone. **A change to the block itself needs `canReplace`**: when it is false, plan "no change, because a pending suggestion on the block must be accepted or rejected first", never an insert holding the rewritten block, which the person would end up with twice if they accepted it. When every flag is false, or `hash` is null, the thread cannot be answered: plan "no change" with the reason (a pending suggestion on the block, or the `notAddressable` value).

Two threads that both ask for a change to one block get one op that answers both, recorded against each thread. "No change" is the answer for a question, for a request that conflicts with a site-patterns rule or with another thread, for one that asks for something a page body cannot hold (a template or menu change: say which skill does it), and for a thread that is already settled in its replies.

## 5. Write the suggestions

**Over MCP**, one `update_page_body` call per page, with `pageId`, **`mode: "suggest"` always passed explicitly**, the planned `ops`, and `sourceId` when step 2 of "Before starting" found the docs-ci section. Over MCP an absent `mode` means `direct`, which edits the page at once: never leave it out.

**With the CLI**, one block at a time: write the new block's markdown to a file and run `leed page update <pageId> --block <dataId> --suggest --file <block.md> --json`, adding `--source-id <commit>` for docs-ci. The CLI reads the block's hash itself just before it writes, so read the review state again first if the page may have changed since step 2. A `--block` write is a `replace`; an answer that needs an insert needs the CMS MCP tools, so when they are missing, report that thread as not done and why.

A refused write changes nothing. On a `409`:

- **"block changed"**: someone edited the block after you read it. Read the review state again (step 2) and plan that page again.
- **"pending suggestion"**: the block carries a suggestion that must be accepted or rejected first. Report the thread as "no change, because a pending suggestion on the block must be accepted or rejected first". Only a thread that asks for new content beside the block is answered with an insert, on a free side.
- **"Page is locked for publishing"**: the page is `PUBLISHED` and was not put into revision. Do what "Before starting" step 5 says, then write again.
- **any other refusal**: report the thread with the message. Never retry in a loop.

## Never

- **Never resolve a comment, and never accept or reject a suggestion.** That is the person's act, in the editor; no tool on either surface does it.
- **Never write in `direct` mode** on a page you are reviewing, and never run `leed page update` without `--suggest`.
- **Never delete or overwrite a block that carries an open thread**: no direct `replace` or `delete`, no `set_page_body` with `overwrite`, and no whole-body `leed page update` without `--block`. Each would destroy the thread and the review with it.
- **Never edit a block no thread asked about**, and never fold other improvements into a suggestion.
- **Never reply inside a thread.** No surface writes thread replies. The report tells the user which threads were questions, so they can answer them in the editor.

## 6. Report

Report per page, then per thread, in document order:

1. **What it asked**: the quoted text it covers and its last message, quoted, plus any earlier message the answer depends on.
2. **What you did**: the suggestion made (the op type and the block), or **"no change, because …"** with the reason, and for a question, your answer to it.
3. **What you could not do**: a change asked on a block with a pending suggestion, a block with `hash: null` (with its `notAddressable` value), an insert that needed the MCP tools, a refused write and its message.

Then hand the page back. Give its editor link again, `<CMS origin>/pages/<pageId>`: the CMS origin is the environment the site is on, `https://app.leed.ai` for production and `https://staging.app.leed.ai` for staging, read from `environment` in the CLI's results; over MCP alone, it is the origin of the CMS MCP server's URL. The link opens in the company that is active in the browser, so a user in more than one company switches to this site's company first. Tell them to accept or reject each suggestion there, answer the questions in their threads, and resolve what is done, and **offer to go round again**: once they have reviewed and commented, they say "review the comments on <page>" or run `/leed:review <page>`.

## If Cloudflare blocks a request

Cloudflare's firewall sits in front of the Leed CMS and now and then mistakes legitimate content for an attack. When it does, the request never reaches Leed.

1. **Recognize it.** The CLI fails with `request_blocked` (exit `5`). An MCP tool call, or any other request to the CMS, comes back with a 403 and an HTML page ("Just a moment…" or "Attention Required"), `server: cloudflare` or a `cf-ray` value, and no JSON error. It is not a permissions problem: do not ask for a different role or sign in again.
2. **Stop.** Retry the same write at most once. Never alter, encode, split or obfuscate the user's content to get past the filter: the content is theirs, and the false positive is Leed's to fix.
3. **Report it.** From the CLI, run the `leed feedback blocked` command in the error's `hint`; it carries the ray id, method, path and time (add `--excerpt-base64` from `error.request` when it is there). From MCP, call `report_blocked_request` with the `rayId`, the time as `occurredAt`, the method and path if you know them, the tool name and its argument names written as `name=` with no value as `command` (for example `update_page_body pageId= ops=`), and at most 2 KB of the body base64-encoded as `excerptBase64`. Never put the blocked text itself in `command` or `note`: the report crosses the same firewall.
4. **Tell the user.** Say what was blocked (which page, setting or asset, and which command or tool) and give the ray id, then continue with the rest of the work.
