# From a gap to a draft

Search & gaps' "What to write next" list ranks what readers and agents asked for and did not get. This is how you turn its items into content, so the list shows each one In progress with the page that answers it. Every step has an MCP tool and a CLI command; use one surface throughout.

## 1. List the items

`get_know_view` with `view: "searchGaps"` and a window (default the last 30 days), or `leed know show searchGaps --json`. The items are in `sections.writeNext.items`, by tab: `open`, `inProgress` and `dismissed`, with their totals in `sections.writeNext.counts`. Each item has:

- `kind`: `unanswered` (a question no page answered), `rising_falling` (a page whose reads moved sharply) or `shipped_unread` (a page a release shipped that nobody read).
- `gapKey`: the normalized question for `unanswered`, else the page id. Pass it verbatim.
- `title`, `score` (readers times one plus accounts), `count`, `draftPageId` (set when in progress), `dismissedReason` (why it was dismissed, on the Dismissed tab when one was given) and `evidence`.

`sections.terms` (site search terms) and `sections.rising` (questions growing fastest) add context. Pick the open items with the highest score, unless the user named one. Show the user the shortlist before drafting more than one.

## 2. Read an item's evidence

`get_gap` with `kind`, `gapKey` and the same `start`, `end` and filters the list used, or `leed know gap show <kind> "<gapKey>" --json`. It returns the item as the list shows it, plus:

- for `unanswered`, `question`: every spelling with its asks by source, the site search terms, what readers reworded it as (with counts), the pages they read after asking, and how many readers, people and accounts asked;
- for `rising_falling` and `shipped_unread`, `page`: the page the item is about, with its numbers in `item.evidence`;
- `draft`: the page already linked, if any;
- `nearestPages`: up to three existing pages the company's own search finds for the question (id, title, path, page type, status).

People and accounts are counted only inside the plan's visible-contact limit, and nobody is named. The window is clamped to the plan's retention. An item the window does not list is a 404 (`not_found` on the CLI): read the list again with the same window.

## 3. Decide what answers it best

- **Revise an existing page** when a nearest page covers the topic but missed the reader's words, or when the item is about a page (`rising_falling`, `shipped_unread`). The rewordings and the pages read after asking show what readers expected to find.
- **Write a new page** when no nearest page covers it, or the question is a task of its own.
- **Dismiss** when it needs no content (already answered, out of scope, noise): `dismiss_gap` with the item's `count` as `questionCount`, or `leed know gap dismiss <kind> "<gapKey>" --count <n>`. Give a reason when dismissing: `reason` (`--reason`), a few words on why it needs no content, such as "covered by <page title>" or "not our product", at most 280 characters. The person reading the Dismissed tab sees it under the item, so it must stand on its own; tell the user too. It returns once its count doubles. `reopen_gap` (`leed know gap reopen`) undoes a dismissal or a link and clears the reason.

Tell the user what you chose for each item and why before writing, unless they asked you to go ahead.

## 4. Find the source id

Is the site's documentation released with `/leed:docs-ci`? Look in the repository you are working in for a `## Documentation updates (Leed)` section in its `CLAUDE.md` or `AGENTS.md`. When it is there, every write carries `sourceId`, the commit that section's stamping rule names, and the docs page publishes with the release that ships that commit. Otherwise pass none.

## 5a. A new page

Write the page in Leed Markdown (`../site-builder/references/leed-markdown-format.md`) in the page type the nearest pages use, or ask which. Answer the question in the reader's own words: put the commonest spelling and the rewordings in the title, the summary and the first paragraph.

- MCP: `create_page_from_markdown` with `title`, `pageTypeId`, `markdown`, `sourceId` when step 4 found one, and `gap: { kind, gapKey }`. The page is created as a draft and linked to the item in one call; the response carries `gap`.
- CLI: `leed page create --page-type-id <id> --file ./page.md --gap "<kind>:<gapKey>" --source-id <sha> --json`. Preview with `--dry-run` first.

If the response carries a `linkError` (CLI: `data.gap.linked` is `false`, with a warning), **the page was created**. Do not create it again: link it with `mark_gap_in_progress` and its `pageId`, or the `leed know gap link` command the warning names. Linking again is safe.

## 5b. A revision of an existing page

1. Read its status and open comments: `get_page` (`page.status`, `openCommentCount`), or `leed page get <pageId> --json`.
2. A `PUBLISHED` page is locked and refuses every body write. Tell the user that revising it puts it into revision while the live version stays as it is, and ask. Once they agree, `update_page_metadata` with `pageId`, `status: "IN_REVISION"` and `sourceId` when step 4 found one. The CLI has no status command, so with the CLI alone ask the person to put the page into revision in the editor.
3. Read the body with `get_page_body`; anchor every op on a `dataId` it returned, and give every `replace` and `delete` its `baseHash`. Never invent an anchor.
4. Write the change as tracked suggestions: `update_page_body` with `mode: "suggest"` passed explicitly (over MCP an absent `mode` means `direct`) and `sourceId`, or `leed page update <pageId> --block <dataId> --suggest --source-id <sha>`. Never `direct`, never `set_page_body`.
5. Link it: `mark_gap_in_progress` with `kind`, `gapKey` and `pageId`, or `leed know gap link <kind> "<gapKey>" --page <pageId>`.

## 6. Check and hand over

Read the list again: the item is in `inProgress` with your page as `draftPageId`. Then hand the pages over for review with their editor links, as the skill's review handoff says. A person accepts or rejects every suggestion and publishes the draft; the item closes on its own once the linked page is published. Docs pages publish with the release that carries their source id.

## Never

- Never publish or schedule a page, and never accept or reject a suggestion.
- Never write a revision in `direct` mode.
- Never create a page again after a `linkError`.
- Never name a person from a gap's evidence; it names nobody, and the counts are all you report.
