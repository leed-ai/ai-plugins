# Claims: every claim traces to a source

A claim is anything a reader could check: a fact, a number, a comparison, a quote, a customer, a capability. Every claim in a message, a draft or social copy traces to a `SourceRef`, one of four kinds:

| Kind | Shape | What it is |
|---|---|---|
| `page` | `{ kind: "page", pageId }` | A CMS page, published or internal |
| `research` | `{ kind: "research", sourceId }` | A source in the brief's research (`S-nn`), with its URL, retrieval date and quote |
| `finding` | `{ kind: "finding", findingId }` | A finding in the brief's research (`F-nn`), which cites its own sources |
| `user` | `{ kind: "user", note }` | Something the user stated, in their words, at most 280 characters |

- **A brief message carries its sources** in `sources`, and needs at least one. `check brief` (`scripts/campaign.mjs`) flags a message with none, and a `research` or `finding` source that is not on the brief.
- **A claim nothing supports is cut**, or rewritten so it claims only what its source says. Never stretch a source to say more than it does.
- **A finding goes stale** when every source it cites was retrieved more than 90 days ago (`stale` on the brief). Refresh its sources, or leave the claim out, before building on it.
- **A `user` note records what the user said**, not what you inferred from it.
- **A draft keeps its claims list** in its deliverable's `detail`, each claim with the source it traces to, so reviewers can check it.
