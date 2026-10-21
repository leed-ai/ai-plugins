<!--
Posts page skeleton (page type: "posts") — marketing / blog voice. Use this for
landing, feature, and announcement pages, NOT for documentation or API reference
(those are the "documentation" / "api" page types — see documentation-page.md).

How to use:
1. Reserve the page first with reserve_page, passing its `title` — the title IS
   the page's H1, rendered by the site template. Do NOT put an H1 (`#`) in the
   body; start with the subhead/intro and use `##` for the first section.
2. reserve_page returns the pageId (reserve any pages you link to too, so the
   pageid: links below resolve).
3. Fill the body with set_page_body (empty draft) or edit an existing
   draft with update_page_body. Over MCP its ops apply DIRECTLY by
   default; pass `mode: "suggest"` to leave tracked suggestions instead. Ask
   the user which they want before your first edit to a page.
4. Replace every <…> placeholder. Delete sections you do not need.
5. Do NOT add data-id attributes — they are assigned on import.
6. Internal links use pageid: — `[label](pageid:<pageId>)` — never raw URLs.
   Keep formatting within the page type's allowed features.
-->

<One-sentence subhead that frames the value in plain language (the headline is the page title).>

## Why it matters

<Two or three sentences on the problem this solves and who it is for. Lead with
the benefit; keep it concrete.>

## How it works

1. <Step or capability one — what the customer does or gets.>
2. <Step or capability two.>
3. <Step or capability three.>

## Key benefits

- **<Benefit one>** — <short supporting line.>
- **<Benefit two>** — <short supporting line.>
- **<Benefit three>** — <short supporting line.>

## Learn more

- [<Related feature or guide>](pageid:<pageId>)
- [<Documentation page>](pageid:<pageId>#<anchor-slug>)

## Ready to start?

<Closing call to action — one or two sentences pointing the reader to the next step.>
