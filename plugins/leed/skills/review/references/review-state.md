# Reading the review state, and choosing the op

`leed page review <pageId> --json` and the CMS MCP tool `get_page_review_state` answer the same document. The CLI puts it in `data`, beside `environment`, `companyId`, `status` and `includeTypes`; the MCP tool returns it as is. Read it with this page, then plan with the table below.

## The document

- **`pageId`**: the page read.
- **`counts`**: `blocks`, `comments` (distinct threads returned) and `suggestions` (distinct pending suggestion ids). With the default filter, `comments` is the number of open text threads; with `--include-types text,emoji` it counts the same open threads as `get_page`'s `openCommentCount`.
- **`blocks`**: one entry per top-level block carrying a comment that passes the filter or a pending suggestion, in document order. A block with three comments is one entry with three comments.

Each block:

| Field | What it is | How you use it |
|---|---|---|
| `dataId` | The block's `data-id` | The op's `anchorId`. Null for a block the editor has not stamped yet: it cannot be written |
| `nodeType` | `paragraph`, `heading`, `bullet_list`, `image`, … | Tells you what the markdown is |
| `markdown` | The block as Leed Markdown, op-ready | The base of your suggestion. It leaves out text under a pending deletion |
| `text` | The block's plain text | What every `start`/`end` indexes. It keeps text under a pending deletion |
| `hash` | The block's compare-and-swap token | The op's `baseHash`, verbatim. Null when the block cannot be written at all |
| `notAddressable` | `unanchorable`, `hidden` or `duplicate` | Why `hash` is null; give it in the report |
| `canReplace` | A `replace` or `delete` here would be accepted in `suggest` mode | The flag for answering a review |
| `canReplaceDirect` | The same in `direct` mode | Not yours to use: a review never writes in `direct` mode, and this is false on any block with an open thread |
| `canInsertBefore` | An `insertBefore` here would be accepted | New content beside the block only; never a fallback for a change to the block itself |
| `canInsertAfter` | An `insertAfter` here would be accepted | New content beside the block only; never a fallback for a change to the block itself |
| `comments` | The threads on the block that pass the filter | One plan entry each |
| `suggestions` | Pending suggestions on the block | Why `canReplace` may be false; never accept or reject one |

Each comment: `commentId`, `type` (`text` or `emoji`), `status` (`open` or `resolved`), `quotedText` (the text it covers now, `text.slice(start, end)`, null for a whole-block comment), `start` and `end` (offsets into `text`, never `markdown`), and `messages`, oldest first, each with `userId`, `text`, `type` and, on newer threads, `createdAt`. Element 0 opens the thread; the last usually supersedes it.

One `suggestionId` may appear on two blocks: a pending move is the struck source and the inserted destination under one id. Count distinct ids.

## Choosing the op

Answer every thread in `suggest` mode. The flags are the write's own guards, checked for one op on its own; ops in one call are also checked together, so two that pass alone may still be refused as a pair.

| The thread asks for | `canReplace` | `canInsertBefore` / `canInsertAfter` | The op |
|---|---|---|---|
| A change to the block's text | true | any | `replace`, with the block's `markdown` changed as asked |
| The block to go | true | any | `delete` |
| New content beside the block | any | the side it belongs on is true | `insertBefore` or `insertAfter`, with the new block alone |
| A change to the block's text, or the block to go | false | any | None: "no change, because a pending suggestion on the block must be accepted or rejected first". Never an insert holding the rewritten block: accepted, it would leave the block on the page twice |
| New content beside the block | any | both false | None: "no change, because" with the reason |
| Anything | false | both false | None: "no change, because" with the reason, `notAddressable` when `hash` is null |

Every `replace` and `delete` carries `baseHash`; an insert may carry it too, and should. A `replace` gives its new block a fresh `data-id`, so never reuse the old `dataId` for a second op on that block in the same round: read the review state again first.

## The plan

Before writing, the plan holds one entry per open thread, in document order:

- **A suggestion:** `{ "commentId": "…", "answers": <index of the message it follows>, "action": "suggest", "op": { "type": "replace", "anchorId": "<dataId>", "baseHash": "<hash>", "markdown": "…" } }`
- **No change:** `{ "commentId": "…", "action": "none", "reason": "…" }`

`answers` is usually the last message's index. The ops of a page's suggestion entries are the `ops` of its one `update_page_body` call, with `mode: "suggest"`.

## When a write is refused

| `409` message | Meaning | What to do |
|---|---|---|
| block changed | Someone edited the block after you read it | Read the review state again and plan that page again |
| unreadable baseHash | The token is not one the server can read | Read again and use the fresh `hash` |
| pending suggestion | The block carries a suggestion a person must resolve first | Report it as "no change, because a pending suggestion on the block must be accepted or rejected first"; only a request for new content beside the block is answered with an insert, on a free side |
| Page is locked for publishing | The page is `PUBLISHED` and was not put into revision | With the user's agreement, `update_page_metadata` with `status: "IN_REVISION"` (and `sourceId` for docs-ci), then write again; with the CLI alone, ask the person to put it into revision in the editor |
| pending split/join boundary | A pending split or join sits on that boundary | Insert on the other side, or report it |
| block not addressable, ambiguous anchor, hidden block | The block cannot be written through the API | Report it with the message |

A stale anchor (the `dataId` is gone) rejects the whole op set: read again and plan again. Nothing in a refused call was applied.
