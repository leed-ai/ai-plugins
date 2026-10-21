# The stamping rule

The release job schedules a docs page only when the page is stamped with a commit the release brings in, so whoever edits the docs, usually the customer's own agent, has to stamp with the right commit. This section goes into the repository's agent instructions: its `CLAUDE.md`, or `AGENTS.md` when that is the file the repository uses. Append it at the end of whichever exists; when neither does, create `CLAUDE.md` only after the user agrees. When the heading `## Documentation updates (Leed)` is already in the file, change nothing.

Copy the block below exactly, with `<stamp branch>` replaced by the stamp branch from `plan` (`develop`, `staging` or `main`) everywhere it appears, `<minimum status>` by the trust's minimum status (`approved`, `in_revision` or `draft`), and `<page types>` by the trust's page types, each with the reason the user chose it (for example "Documentation, the product docs; Blog, the release announcement"). The review loop's placeholders (`<CMS origin>`, `<pageId>`, `<page>`, `<dataId>`) stay as they are: the agent fills them in on each edit.

```markdown
## Documentation updates (Leed)

Our product docs live in Leed and publish with the release that ships the code they describe. A CI job schedules every docs page stamped with one of the release's commits, so the stamp decides when a page goes live.

- **Update docs after the change merges to `<stamp branch>`, and stamp with that branch's commit** (`git rev-parse origin/<stamp branch>` after the merge), never a feature-branch commit or a pre-squash SHA. A squash or rebase rewrites feature-branch commits, so a page stamped with one never matches a release.
- **The edit route:** put a published page into revision first (`update_page_metadata` with `status: "IN_REVISION"`), then edit it with `update_page_body` and `sourceId` set to the commit. A page that needs no edit but is current is stamped with `leed page stamp <pageId> --source-id <commit>`; from the CLI, once the page is in revision, `leed page update <pageId> --block <dataId> --source-id <commit>` edits a block and stamps in one step. Never publish from the agent: the release job schedules the page when the release ships. The page must reach the release job's editorial floor first (`<minimum status>`); when that is `approved`, a person approves it in Leed.
- **Only these page types publish with a release:** <page types>. A page of any other type stamped with a release commit is left where it is and does not publish with that release; the job still passes. Adding a type takes a new Leed trust and a CI change, so ask before relying on one.
- **Drift:** a page whose `sourceId` is behind `<stamp branch>`, in an area later commits touched, needs review. `git log <sourceId>..<stamp branch> -- <paths the page describes>` lists the commits it has not caught up with.
- **Once a page has comments, write only suggestions.** Before writing to a page that already exists, read its open comment count: over MCP, `openCommentCount` from `get_page`; with the CLI, `data.counts.comments` from `leed page review <pageId> --include-types text,emoji --json`. Above zero, the person has read the draft and is reviewing it, so write only tracked suggestions, with `update_page_body` and `mode: "suggest"` or with `leed page update <pageId> --block <dataId> --suggest`, or stop and offer `/leed:review`. Never write in `direct` mode, never call `set_page_body` with `overwrite`, and never replace the whole body with `leed page update` without `--block`. A suggestion carries `sourceId` too, stamped by the same rule.

**When the pages are written, hand them over for review.** This applies to pages written to the CMS; a sandbox has no editor. Tell the user:

1. Which pages were written, each with its editor link, `<CMS origin>/pages/<pageId>`, built from the page ids the writes returned. The CMS origin is the environment the site is on: `https://app.leed.ai` for production and `https://staging.app.leed.ai` for staging, read from `environment` in the CLI's results; over MCP alone, it is the origin of the CMS MCP server's URL.
2. That they can read and edit each page there, in the editor built for writing, and leave a comment on anything they want changed.
3. That they then say "review the comments on <page>", or run `/leed:review <page>`, and each comment is answered as a tracked suggestion they accept or reject in the editor.
4. For a user in more than one company: the link opens in the company that is active in their browser, so they switch to this site's company first.
```

The rules, and why each is there:

1. **Stamp after the merge, with the stamp branch's commit.** The stamp branch is the one feature work merges into, and its commits survive into the release. A feature-branch commit or a pre-squash SHA does not, and an edit stamped before the merge has no commit of the stamp branch to name.
2. **Revision, then the body, with `sourceId`; never publish.** A published page is locked against body edits until it is put into revision. Publishing from the agent would put the docs live before the code they describe ships; leaving it in revision lets the release job schedule it.
3. **Only the trust's page types.** The trust lists the page types a release may schedule, and nothing else is scheduled: a blog post or changelog entry stamped with a release commit stays unpublished, and the job does not fail. Recording the types tells the agent which pages ride with a release and which it has to publish another way.
4. **Drift.** A page's `sourceId` records the commit it was written against, so the commits since then in the paths it describes are exactly what it may have missed.
5. **Suggestions once a page has comments.** A comment means a person is reviewing the page in the Leed editor; a direct edit or a whole-body overwrite would destroy their threads. Suggestions leave the change for them to accept, and the `sourceId` still records the commit it was written against.
6. **The review handoff.** The person edits and comments in the Leed editor, which is built for it, and the agent answers the comments as suggestions (the shared text, word for word, is in `../site-patterns/references/review-handoff.md`).
