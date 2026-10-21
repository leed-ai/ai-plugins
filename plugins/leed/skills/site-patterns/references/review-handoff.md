# The review loop: the handoff, and suggest mode once a page has comments

After an agent writes content into Leed, the person reads and edits it in the Leed editor, which is built for writing, and leaves a comment on anything they want changed. The agent then reads the comment threads and answers each one as a tracked suggestion the person accepts or rejects in the editor (`/leed:review`, `../review/SKILL.md`). Two pieces of text teach that loop, and every skill that writes page content carries both, word for word: `site-onboarding`, `site-migrate`, `site-design-import`, `site-sandbox-move`, `create`, and the agent instructions `/leed:docs-ci` writes into a customer's repository. Skills have no include mechanism, so each copy is the text below, and a copy that drifts from it is a bug.

Copy each block exactly, from its bold lead to the end of its last line. Neither names a path relative to a skill, so the same text reads correctly inside a customer repository's `CLAUDE.md`.

## The review handoff

**When the pages are written, hand them over for review.** This applies to pages written to the CMS; a sandbox has no editor. Tell the user:

1. Which pages were written, each with its editor link, `<CMS origin>/pages/<pageId>`, built from the page ids the writes returned. The CMS origin is the environment the site is on: `https://app.leed.ai` for production and `https://staging.app.leed.ai` for staging, read from `environment` in the CLI's results; over MCP alone, it is the origin of the CMS MCP server's URL.
2. That they can read and edit each page there, in the editor built for writing, and leave a comment on anything they want changed.
3. That they then say "review the comments on <page>", or run `/leed:review <page>`, and each comment is answered as a tracked suggestion they accept or reject in the editor.
4. For a user in more than one company: the link opens in the company that is active in their browser, so they switch to this site's company first.

## Suggest mode once a page has comments

**Once a page has comments, write only suggestions.** Before writing to a page that already exists, read its open comment count: over MCP, `openCommentCount` from `get_page`; with the CLI, `data.counts.comments` from `leed page review <pageId> --include-types text,emoji --json`. Above zero, the person has read the draft and is reviewing it, so write only tracked suggestions, with `update_page_body` and `mode: "suggest"` or with `leed page update <pageId> --block <dataId> --suggest`, or stop and offer `/leed:review`. Never write in `direct` mode, never call `set_page_body` with `overwrite`, and never replace the whole body with `leed page update` without `--block`.

## Why each part is there

- **The editor link.** The route is `/pages/<pageId>` on the CMS origin, and it carries no company: the browser's active company decides which company's page opens, which is why the multi-company note is there.
- **The hand-off in the person's words.** "Review the comments on <page>" is enough to start `/leed:review`; naming the command as well lets a person who prefers it type it.
- **The count before the write.** A comment is attached to the text it covers. A whole-body overwrite or a `direct` replace would destroy the threads on the blocks it replaces, and the person's review with them; the CMS already refuses a whole-body overwrite while threads are open, and this rule keeps the agent from trying. `get_page`'s `openCommentCount` counts emoji reactions too, so the CLI count includes them as well.
