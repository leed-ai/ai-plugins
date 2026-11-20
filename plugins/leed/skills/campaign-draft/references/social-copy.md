# Social copy, channel by channel

Each social cut is one post a person publishes by hand, for one channel and one account. Its text goes in the deliverable's `copy`, and nowhere else. The limits, and how each network counts them, are in `../campaign-patterns/references/channels.md`: run `chars <channel>` on every copy before it is written, and write well inside the limit rather than up to it.

## Every channel

- **Written for its account.** A company account speaks for the company, in the campaign's voice; a person's account is that person, in their own style (`../campaign-patterns/references/voice.md`).
- **Different words per channel.** The cuts of one pillar promote the same post, but never share a sentence: each is written for its network.
- **One idea.** A cut carries one of the pillar's messages, the one its angle names, not a summary of the post.
- **Hooks.** Write two or three hook variants for each cut, each a different way in: a quote from a source, a question the reader is asking, the cost of the problem, a plain statement of the fix. The first line is the hook. Every variant is traced like any claim.
- **The link.** `copy` holds `{{link}}` exactly once, where the tracked link goes, and no other URL. Put a space or a line break before it: X and Bluesky link no URL written straight after a word, and X then counts it in full. `chars` warns when anything else comes straight before it, `(` aside. Never write the post's own URL, a bare domain or another site's address: campaign-schedule replaces the placeholder with the cut's short link.
- **No engagement bait.** Never ask for likes, reposts, follows, tags or one-word comments ("Type YES if…"), and never promise something for engaging. A real question to the reader, one they would want to answer, is fine.
- **No invented handles.** Mention an account only as `../campaign-patterns/references/guardrails.md` allows.
- **Claims.** Every claim in the copy is in the cut's claims list, traced to a source. A figure appears only when a cited quote or finding gives it.

## `x`

- **Structure:** one post, the point first, the hook as its opening clause. No thread: a cut is one post.
- **Hooks:** short and concrete, a number or a quote when a source gives one.
- **The link:** at the end, after a colon or on its own line. X counts any link the same, so the short link costs no more than a long one.
- **Hashtags:** one at most, and only when it is one the audience follows; usually none.

## `linkedin`

- **Structure:** the hook on the first line, then short paragraphs with a blank line between them. Only the first two or three lines show before the fold, so the hook carries the post on its own.
- **Hooks:** a line that names the reader's problem, or what they would be surprised to learn.
- **The link:** in the last paragraph, introduced by what the reader gets there.
- **Hashtags:** up to three, at the end, or none.

## `bluesky`

- **Structure:** one short, conversational post, written as a person talks.
- **Hooks:** plain and direct; no marketing voice.
- **The link:** at the end. Bluesky shows a card for the link when it is attached, so the text need not describe the page.
- **Hashtags:** rarely.

## `discord`

- **Structure:** a member talking to members in the community's channel: what the post answers, and why it is worth reading. Markdown formatting works.
- **Hooks:** the question the community has been asking, in its own words.
- **The link:** on its own line, after the text.
- **Hashtags:** none. Never `@everyone` or `@here`.

## An example

A LinkedIn cut's copy, from the company page:

```text
We ship on Tuesday and fix the docs by Friday.

That line from a release-day thread is where documentation drift starts: the code and its docs ship on different days, and readers notice the stale pages before the team does.

Why it happens, and how to ship the docs with the release: {{link}}
```
