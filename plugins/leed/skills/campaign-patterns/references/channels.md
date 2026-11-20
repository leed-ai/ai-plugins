# The social channels: norms and limits

A campaign's `channels` holds its social channels, each with the account that posts and who posts it. The four channels are `x`, `linkedin`, `bluesky` and `discord`. Each piece of social copy is a `social` deliverable for one channel and account, at most 3,000 characters in `copy` with its tracked link, and a person posts it by hand on its date.

Write for the network's limit, counted the way the network counts, and keep the link inside it. `chars <channel>` in `scripts/campaign.mjs` counts a post each network's way and holds it to the limit below. Copy holds the placeholder `{{link}}` where its tracked link goes: X counts it as any link, and the other networks as the short link that replaces it, `https://<public.domain>/s/` and 8 characters.

| Channel | Limit | Norms |
|---|---|---|
| `x` | 280 weighted characters for a standard account. The text is NFC-normalized, and a link counts as 23, however long it is, as `{{link}}` does. An emoji counts 2, and so does each CJK character and most others outside Latin and the common punctuation. | One idea per post, the point first. A thread only when the idea has steps, each post able to stand alone. One hashtag at most, or none. |
| `linkedin` | 3,000 characters, counted as UTF-16 code units, so an emoji counts 2. Only the first two or three lines show before **…see more**. | The hook in the first line. Short paragraphs with a blank line between them. First person for a person's account, the company's voice for a company page. Up to three hashtags at the end, or none. |
| `bluesky` | 300 graphemes, the characters a reader sees, so an emoji counts 1, and at most 3,000 UTF-8 bytes. A link counts as written. | Conversational and plain. A link renders as a card when it is attached. Hashtags rarely. |
| `discord` | 2,000 characters per message, counted as UTF-16 code units. | A member talking to members in the community's channel, not an advertisement. Markdown formatting works. Never `@everyone` or `@here`: the server's own rules decide where announcements go. |

- **One account, one voice.** A company account speaks for the company; a person's account is that person, in their style (`references/voice.md`).
- **Different words per channel.** Copy for the same page is written for each channel, never pasted from one to another.
- **No invented handles.** Mention an account only as `references/guardrails.md` allows.
