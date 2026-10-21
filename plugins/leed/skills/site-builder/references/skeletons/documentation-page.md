<!--
Documentation page skeleton (page type: "documentation") — clear, instructional voice.

How to use:
1. Reserve the page first with reserve_page, passing its `title` — the title IS
   the page's H1, rendered by the site template. Do NOT put an H1 (`#`) in the
   body; start with the intro paragraph and use `##` for the first section.
2. reserve_page returns the pageId (reserve any pages you link to too, so the
   pageid: links below resolve).
3. Fill the body with set_page_body (empty draft) or edit an existing
   draft with update_page_body. Over MCP its ops apply DIRECTLY by
   default; pass `mode: "suggest"` to leave tracked suggestions instead. Ask
   the user which they want before your first edit to a page.
4. Replace every <…> placeholder. Delete sections you do not need.
5. Do NOT add data-id attributes — they are assigned on import.
6. Internal links use pageid: — `[label](pageid:<pageId>)` — never raw URLs.
   Keep formatting within the page type's allowed features (e.g. code blocks,
   tables, and alerts may be disabled for some page types).
-->

<One or two sentences describing what this page covers and who needs it.>

## Prerequisites

- <What the reader needs to have or know first.>
- <Link to a prerequisite doc if relevant>](pageid:<pageId>)

## Steps

1. <First step. Be specific and actionable.>
2. <Second step.>
3. <Third step.>

```bash
<command or code example, if the page type allows code blocks>
```

:::info
<Optional callout — a tip, note, or warning. Remove if alerts are not allowed
for this page type.>
:::

## Reference

| <Field> | <Description> |
| ------- | ------------- |
| <name>  | <what it does> |

## Related

- [<Related guide>](pageid:<pageId>)
- [<API reference>](pageid:<pageId>#<anchor-slug>)
