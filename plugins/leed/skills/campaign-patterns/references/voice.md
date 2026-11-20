# Voice: the campaign's, the company's rules and the author's own

Every piece is written in one voice, blended from three sources:

1. **The campaign's `voiceNotes`**, which set the tone for everything in the campaign.
2. **Voice rules in its internal context**: a brand voice, messaging or style page in the internal docs the campaign's `contextSources` names. Search those sets with `search_internal` and their `pageTypeIds`, and read a named page with `get_page_body`.
3. **Each author's own style**, from their published posts. List the campaign's posts with `list_pages` and its `postsPageTypeId`, keep the author's, and read a few with `get_page_body`. Note how long their sentences run, how they open, the words they use and avoid, and how formal they are.

The first two are rules, and they add up: when they conflict, stop and ask (`references/context.md`). An author's style never overrides a rule; it shapes word choice and rhythm within them.

- The authors are the campaign's `authorIds`. Only those people's names go on its content.
- An author with no published posts is written in the campaign's voice alone; say so, and never invent a style for them.
- Two authors in one campaign keep their own voices. Do not average them into one.
