# Leed Markdown Format Reference

Source: `packages/site-management/src/plugins/markdown/`

Leed Markdown is built on markdown-it with typographer enabled, plus ~30 custom plugins.
HTML pass-through is enabled (`html: true`). A CMS page body is stored as a ProseMirror document, so raw HTML written into one is imported as literal text and shows as typed. Two exceptions: an HTML comment `<!-- … -->` is stripped on import, as a Handlebars comment is (see below), and a line holding only `<br>` tags is a paragraph of line breaks. The editor writes a paragraph whose only content is a line break as `<br><!---->`, which stays inline.

---

## Attribute Syntax

All block and inline elements support extended attributes via `{...}` syntax.

**`id` is not supported.** Leed Markdown has never let an author set an element's `id`. A `{#custom-id}` or `{id="custom-id"}`, in any letter case, is read as attribute syntax and then dropped from every element — headings, paragraphs, quotes, lists and task items, alerts, collapsibles, tab groups and tab labels, code fences, code spans, links, images and tables — by the editor on import and by the site builder when it renders, template Markdown included. Validation reports it as dropped content. `data-id` is the system anchor and is kept, and so are classes and other attributes. The ids the renderer makes itself are unaffected: heading slugs, tab and panel ids, and checkbox ids.

### Block-level attributes (on own line or at end of line)

```markdown
# Heading {.my-class #custom-id data-value="test"}
```

```html
<h1 class="my-class" data-value="test" id="heading">Heading</h1>
```

The `#custom-id` is dropped; the heading's `id` is its generated slug.

```markdown
Paragraph text {data-id="p1"}
```

```html
<p data-id="p1">Paragraph text</p>
```

### Inline attributes (immediately after element, no space)

```markdown
[link text](https://example.com){data-id="123" target="_blank"}
```

```html
<a href="https://example.com" data-id="123" target="_blank">link text</a>
```

```markdown
![alt text](image.jpg){data-assetid="aaa123" data-id="zzz"}
```

```html
<img src="image.jpg" alt="alt text" data-assetid="aaa123" data-id="zzz">
```

### What counts as an attribute block

The editor and the site read a `{...}` group with one grammar. It is an attribute block only when every whitespace-separated entry is `.class`, `#id` or `key=value` (an `#id` makes a group attribute syntax, but the id itself is dropped); anything else is the author's text and stays where it was written:

```markdown
Set the {timeout} value      → <p>Set the {timeout} value</p>
Pick {a b}                   → <p>Pick {a b}</p>
Set the value {data-id="p1"} → <p data-id="p1">Set the value</p>
```

- A value is bare (`start=5`), single-quoted (`k='v'`) or double-quoted (`k="v"`). In a double-quoted value, `&quot;`, `&amp;`, `&#123;` and `&#125;` stand for `"`, `&`, `{` and `}`; that is how the editor writes a value holding a quote or a brace. A single-quoted or bare value is taken as written.
- A backslash-escaped brace (`\{`, `\}`) is never an attribute delimiter. The editor writes literal braces that way, so `## T \{x=1\}` is the heading `T {x=1}`.
- A block's group follows whitespace (`Text {attrs}`). A group glued to a link, image or code span (`[a](/b){attrs}`) is that element's.
- A block's group may also stand on the paragraph's last line by itself (`Text` then `{attrs}` on the next line). That line is one group, or two separated by whitespace; a line of groups written side by side (`{.a}{.b}`) is text.
- Two groups separated by whitespace at the end of a paragraph's, heading's, quote's or list item's own line are both read (`Text {.a} {.b}`); a third one before them is text. A task list item's line is read the same way. When two groups set the same attribute there, the editor and the site keep the value of the first group written (`{data-id="a"} {data-id="b"}` gives `a`), and classes add up. In a CMS page body a class on a paragraph, heading or quote is still dropped, and validation reports it wherever it is written.
- A fence's info string and a `:::` or `+++` header take only their last group; a group before it is part of the language or title text (`{data-id="a"} {data-id="b"}` there gives `b`).
- An image takes the group written after it, with or without whitespace or a line ending before it, and any further groups glued to that one (`![a](x.png){data-id="a"}{data-id="b"}`). When they set the same attribute the first group written wins (`a`), and classes add up.
- The editor reads an attribute name in lower case only: `{Src=…}` or `{DATA-ID=…}` is not `src` or `data-id`, it is dropped, and validation reports it. When a name is written in two letter cases, the site keeps the lowercase one too. An `id` is dropped in every letter case.
- An attribute named `on…` (an event handler) is never rendered.
- A group on a line of its own that no list, table or collapsible before it takes as its attribute line (after a heading, a quote and a blank line, or a paragraph and a blank line) is not a paragraph: the editor and the site drop it, and validation reports it.
- Attribute values are HTML-escaped when rendered.

### Supported attribute shorthand

| Syntax        | Meaning                                  |
| ------------- | ---------------------------------------- |
| `.classname`  | `class="classname"`                      |
| `#id`         | not supported: read, then dropped        |
| `key="value"` | arbitrary attribute (`id` is dropped)    |

Multiple classes: `{.class1 .class2 .class3}`

The renderer accepts classes and `key="value"` attributes on every element, but never an `id`. A **CMS page body** is narrower: it is stored as a ProseMirror document, and an attribute the node schema does not model is discarded on import. On a heading or a paragraph only `data-id` survives — `.classname` does not.
See [Headings](#headings-h1-h5-auto-anchored) for what that means for anchors and in-page links.

---

## Headings (h1-h5 auto-anchored)

```markdown
# Main Heading
## Sub Heading
###### Sixth Level (no anchor)
```

```html
<h1 id="main-heading">Main Heading</h1>
<h2 id="sub-heading">Sub Heading</h2>
<h6>Sixth Level (no anchor)</h6>
```

### Heading anchors

Anchor ids are **generated at site-build time from the heading text**; they are not stored with
the content. `markdown-it-anchor` anchors levels 1–5 only — a `######` heading is given no `id`
and can never be a link target.

The slug is produced by [`@sindresorhus/slugify`](https://github.com/sindresorhus/slugify), which
does more than lower-case-and-hyphenate. Verified against the real pipeline:

| Heading                             | Generated id                  | Rule                                                        |
| ----------------------------------- | ----------------------------- | ----------------------------------------------------------- |
| `## Payment, tax and renewal`       | `payment-tax-and-renewal`     | lower-cased, punctuation dropped, words joined by hyphens    |
| `## Same Heading` (2nd, 3rd)        | `same-heading-1`, `-2`        | a duplicate slug gets a numeric suffix                       |
| `` ## `batch` is the shape ``       | `batch-is-the-shape`          | inline markup contributes its text only                      |
| `## Q&A: what's next?`              | `q-and-a-whats-next`          | `&` becomes `and`; apostrophes vanish rather than hyphenate   |
| `## fooBarBaz and HTTPServer`       | `foo-bar-baz-and-http-server` | camelCase is decamelized, acronym runs included              |
| `## Café Über Naïve — résumé`       | `cafe-ueber-naive-resume`     | transliterated: `é` → `e`, `ü` → `ue`                        |
| `## Ünïcödé Straße`                 | `uenicoede-strasse`           | `ß` → `ss`                                                   |
| `## Email us at support@leed.ai`    | `email-us-at-support-leed-ai` | `@` and `.` become separators                                 |
| `## snake_case_name`                | `snake-case-name`             | underscores become hyphens                                    |
| `## 你好 世界`                       | *(empty string)*              | nothing transliterable ⇒ `id=""`, so the heading is unlinkable |

Do not guess the slug of a heading that is not plain Latin words — decamelization and
transliteration make it non-obvious. Render the page and read the `id`.

A heading's anchor is made from at most its first 500 characters.

### Linking to a heading

Same page — write the fragment on its own, spelled as the generated slug:

```markdown
## Payment, tax and renewal

You are not contracting with us for the purchase — see
[Payment, tax and renewal](#payment-tax-and-renewal) below.
```

Another page — use the `pageid:` scheme and append the fragment:

```markdown
See [Payment](pageid:39e9c3c7-4741-432b-a49e-e59314f6d05d#payment-tax-and-renewal).
```

**A fragment is never validated.** A `#slug` matching no heading still resolves: the reader gets
the right page and lands at the top of it, with nothing logged and nothing to see. Check the
target page's actual headings when you write the link, and again if that page is restructured.

### `{#custom-id}` is not supported

A heading's `id` is always its generated slug. A trailing `{#custom-id}` or `{id="custom-id"}` is dropped everywhere: in markdown rendered straight from a template (`.hbs`) as well as in a CMS page body. In a page body the ProseMirror heading node models `level` and `data-id` and nothing else, so on import the whole trailing `{...}` group is stripped:

| Written into a page body                 | Stored and exported as      | Id on the built site       |
| ---------------------------------------- | --------------------------- | -------------------------- |
| `## Payment, tax and renewal {#payment}`  | `## Payment, tax and renewal` | `payment-tax-and-renewal` |
| `## Head {.cls #hid data-id="h1"}`        | `## Head {data-id="h1"}`      | `head`                    |

`data-id` is the only heading attribute that round-trips. An in-page link written against the
discarded custom id — `[…](#payment)` — is kept verbatim and then points at nothing, which is
why the stripping is worth noticing. `set_page_body` returns a `warning` when the body it
is given carries a trailing `{...}` on a heading or paragraph, or an `id` on any element; the
warning is advisory and the content is still applied.

The same stripping applies to a paragraph — `Paragraph text {.note}` is stored as `Paragraph text`.

Only a **recognized attribute block** is stripped: every whitespace-separated entry in the group
has to be `.class`, `#id` or `key=value`. A trailing brace group that is not attribute syntax is
content and stays in the text, so `## Set the value {timeout}` and `Paragraph ending in {"a": 1}`
keep their braces. They come back from `get_page_body` escaped (`\{timeout\}`), which parses
back to the same text and renders as `{timeout}`.

### Inline marks inside a heading

Inline code is supported inside a heading, at every level from `#` to `######`, and round-trips unchanged:

```markdown
## `batch` is the shape
```

`code` is the only content mark a heading allows. **Bold, italic, highlight, strikethrough, subscript, superscript, keystroke and links are not supported inside a heading** — a heading must keep looking like a heading. That list is exhaustive: those eight are every content mark in the schema other than `code`. The editor still shows those toolbar buttons and still binds their shortcuts (`Mod-b`, `Mod-i`, …) while the cursor is in a heading; they simply do nothing there, because the schema does not allow the mark on a `heading` node.

An unsupported mark is stripped on import and the heading text is kept, so `## **bold** heading` is stored and exported as `## bold heading`. No heading is ever dropped because of a mark it carries.

A link is the one case that loses more than the formatting: only the link text survives and the destination is gone, so `## Heading with [link](https://example.com)` is stored and exported as `## Heading with link`. Put the link in the prose under the heading instead.

An image is not a mark and is not stripped, so it still takes its whole block with it: `## ![alt](photo.png) Title` is stored and exported as nothing at all — heading text included. Images belong on their own line (see Images).

The mark rule does not cover inline nodes. An image is a block node, which is why it destroys the heading; an inline node is valid heading content and survives untouched. Inline math round-trips inside a heading exactly as inline code does:

```markdown
## The formula ``math E = mc^2`` matters
```

---

## Inline Formatting

```markdown
**bold** → <strong>bold</strong>
*italic* → <em>italic</em>
~~strikethrough~~ → <s>strikethrough</s>
==highlighted== → <mark>highlighted</mark>
H~2~O → H<sub>2</sub>O
E=mc^2^ → E=mc<sup>2</sup>
`inline code` → <code>inline code</code>
[[Ctrl]] + [[C]] → <kbd>Ctrl</kbd>+<kbd>C</kbd>
```

Most inline formatting markers (`** * ~~ == [[]]`) require a space (or punctuation/line boundary) on the outer edge to be recognized. For example, `x**bold**y` won't parse — use `x **bold** y`. Superscript (`^`) and subscript (`~`) are the exception: they work without surrounding spaces (e.g., `H~2~O`, `E=mc^2^`).

### Smart Typography (typographer enabled)

```markdown
"Hello" → "Hello" (curly quotes)
'Hello' → 'Hello' (curly single quotes)
-- → – (en-dash)
... → … (ellipsis)
```

---

## Images

### Bare image (standalone — no wrapping `<p>`)

```markdown
![Alt text](https://example.com/image.jpg)
```

```html
<img src="https://example.com/image.jpg" alt="Alt text">
```

An image's alt text is plain text. The editor escapes `[`, `]`, `=`, `*`, `_` and backticks in it, so `![Run \`a\_b\` now](x.png)` has the alt ``Run `a_b` now``. A backslash directly before the closing `](` is literal, so `![C:\dir\](x.png)` has the alt `C:\dir\` and ends there; any other `\]` is an escaped bracket. The editor writes a `(` that follows a bracket in the alt as `\(`.

### Image with size

```markdown
![Alt text =300x200](image.jpg)
![Width only =300x](image.jpg)
![Height only =x200](image.jpg)
```

```html
<img src="image.jpg" alt="Alt text" width="300" height="200">
```

### Image with caption (title triggers `<figure>`)

```markdown
![Alt text](image.jpg "Figure Caption")
```

```html
<figure><img src="image.jpg" alt="Alt text"><figcaption>Figure Caption</figcaption></figure>
```

Captions support inline markdown: `"Caption with **bold** and *italic*"`

### Image with inline attributes

```markdown
![Alt =1000x800](/image.jpg){data-assetid="aaa123" data-id="zzz"}
```

```html
<img src="/image.jpg" alt="Alt" width="1000" height="800" data-assetid="aaa123" data-id="zzz">
```

The group after an image is the image's, written directly after the `)` or after a space, and is read from the source, so encoded and single-quoted values decode.

### Image with caption + inline attributes

```markdown
![Alt =1000x800](/image.jpg "Caption"){data-assetid="aaa123" data-id="zzz"}
```

```html
<figure>
  <img src="/image.jpg" alt="Alt" width="1000" height="800" data-assetid="aaa123" data-id="zzz">
  <figcaption>Caption</figcaption>
</figure>
```

### Link-wrapped image

```markdown
[![Alt](image.jpg){data-id="img-0"}](https://example.com) {data-id="link-1"}
```

```html
<p data-id="link-1">
  <a href="https://example.com">
    <img src="image.jpg" alt="Alt" data-id="img-0">
  </a>
</p>
```

In a CMS page body a link-wrapped image is one image block: the link's destination is stored as the image's `href`, and the editor writes it back as `[![Alt](image.jpg){data-id="img-0"}](https://example.com)`. The image's own group is its anchor; a `data-id` in a group after the link, with a space, is used only when the image has none, and the site then renders it on the `<img>` too, as for any paragraph that holds nothing but one image, captioned or not. With two such groups the first one's `data-id` is used. Groups glued to the link's `)` are the link's. The link's title, a group attached to the link's `)`, and anything but that `data-id` in a group after the link are not kept; validation reports them as dropped. An image inside emphasis or another mark is a plain image block.

### Link and image URLs

A link's `href` and an image's `src` or link may not use a scheme that runs script or embeds a document: `javascript:`, `vbscript:`, `data:` and `file:`, in any letter case, with whitespace, control characters, character references (`&#9;`, `&Tab;`, `&colon;`) or percent-encoded controls hidden in them. An image's `src` may be a `data:image/` PNG, JPEG, GIF or WebP. The editor and the site apply the same check:

- such a link is not a link: its text is kept, on import and on paste, and the editor refuses to create one;
- a `{href=…}` or `{src=…}` group never sets such a URL, on any element;
- a body already stored with one is not rewritten, but the editor renders that link without an `href` and that image without its `src` or link.
- a linked image whose link is such a URL, `[![Alt](image.jpg)](javascript:…)`, is the image alone, with no link, in the editor and on the site; validation reports the dropped link;
- a linked image whose link is such a URL takes the groups written after the link as its own, as an image takes its groups; it keeps what an image keeps, and validation reports the rest;
- an `{% iframe %}` embed's `src` and an `{% audio %}` embed's `path` are held to the link rule: the editor drops an unsafe one on import and paste and renders a stored one without it, and the site renders it as an empty `src`. The iframe dialog refuses one too;
- attribute names are compared in any letter case, so `{HREF=…}` is `{href=…}`.

---

## Code Blocks

```markdown
```python {data-id="code1"}
a = [x for x in range(10)]
```​
```

```html
<pre data-id="code1"><code class="language-python">a = [x for x in range(10)]</code></pre>
```

- `data-id` moves from the fence info line to `<pre>` (not `<code>`)
- Trailing newlines are stripped
- No language: `<pre><code>...</code></pre>`
- The editor writes a fence one backtick longer than the longest backtick run in the code (at least three), and uses `~~~` when the language holds a backtick. Any CommonMark fence reads back.
- The language is the info string with its backslash escapes resolved. The editor escapes `\`, `{`, `}` and `&` in a language, and writes `|` as `&#124;`, so a language such as `{.python}` or one holding a shortcode is kept rather than read as attributes (` ```\{.python\} `). A trailing `{...}` on the info line that is not escaped is the block's attribute group.
- A class in a fence's group (` ```{.python} `, ` ```js {.x} `) renders on the site's `<pre>`, but a CMS page body keeps only a code block's language and `data-id`; validation reports the rest as dropped. An id (` ```js {#x} `) is not supported and is dropped on both sides.
- In a CMS page body a code block cannot sit inside a list item: on import it is lifted out to directly after the outermost list, in order, with nothing lost. Tables are lifted out the same way.

---

## Math

### Block math

```markdown
```math {data-id="equation-1"}
E = mc^2
```​
```

```html
<pre data-id="equation-1"><code class="math">E = mc^2
</code></pre>
```

### Inline math (double backticks)

```markdown
The equation ``math E = mc^2`` is famous.
```

```html
<p>The equation <code class="math">E = mc^2</code> is famous.</p>
```

Only the exact language `math` renders as math (a `mathematica` fence is ordinary code). Math holding a backtick is written with a longer fence (```` ```math a`b``` ````), and a `{...}` at the end of inline math is math, not attributes.

---

## Diagrams (Mermaid)

```markdown
```mermaid {data-id="diagram"}
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[OK]
    B -->|No| D[Not OK]
```​
```

```html
<pre class="mermaid" data-id="diagram">
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[OK]
    B -->|No| D[Not OK]
</pre>
```

Note: mermaid blocks render as `<pre class="mermaid">` (no `<code>` wrapper).

---

## Blockquotes

```markdown
> Quote line 1
>
> Quote line 2
{data-id="bq1"}
```

```html
<blockquote data-id="bq1">
  <p>Quote line 1</p>
  <p>Quote line 2</p>
</blockquote>
```

---

The attribute line goes directly after the quote, with no `>` prefix and no blank line. Only that line is the quote's: a `{...}` in the quote's text is text, and a nested quote's line belongs to the nested quote.

---

## Alert Containers

Types: `note`, `tip`, `info`, `warning`, `danger`

### Basic alert

```markdown
:::note {data-id="alert-1"}
This is a note.
:::
```

```html
<aside class="alert alert-note" data-id="alert-1">
  <div class="heading">
    <i class="fa-icon"></i>
    <span class="description">Note</span>
  </div>
  <div class="content">
    <p>This is a note.</p>
  </div>
</aside>
```

The type is case-insensitive (`:::NOTE` is a note), spaces or a tab may follow the colons (`::: note`), and an attribute group may be glued to the type (`:::note{data-id="a"}`). The closing `:::` is never read inside fenced code. A title is plain text; `\{`, `\}` and `\\` in it stand for `{`, `}` and `\` — the editor escapes a trailing group that would read as attributes. An alert with a title and no body keeps its title.

### Alert with custom title

```markdown
:::tip Custom Heading {data-id="tip-1"}
Tip content here.
:::
```

```html
<aside class="alert alert-tip" data-id="tip-1">
  <div class="heading">
    <i class="fa-icon"></i>
    <span class="description">Custom Heading</span>
  </div>
  <div class="content"><p>Tip content here.</p></div>
</aside>
```

### Nested alerts (extra colons for outer)

```markdown
::::tip {data-id="outer"}
Outer content
:::info
Inner content
:::
::::
```

---

## Collapsible (Details/Summary)

### Closed collapsible

```markdown
+++ Click to expand {data-id="closed-1"}
Hidden content
+++
```

```html
<details data-id="closed-1">
  <summary><span class="details-marker"></span>Click to expand</summary>
  <p>Hidden content</p>
</details>
```

### Open collapsible

```markdown
++> Open by default {data-id="open-1"}
Visible content
++>
```

```html
<details open="" data-id="open-1">
  <summary><span class="details-marker"></span>Open by default</summary>
  <p>Visible content</p>
</details>
```

Nesting: use more `+` characters (`++++`, `+++++`).

- The block must be closed by the same marker; an unclosed `+++ Title` is text. The closer is never read inside fenced code.
- The title and the body may be empty.
- The title is inline Markdown (code spans and emphasis render). A title that starts with a `#` run, a space and text renders as that heading. `\{`, `\}` and `\\` stand for `{`, `}` and `\`.
- `.class` in the header group renders on `<details>`; an id is dropped. A CMS page body keeps only `data-id`.
- An attribute line directly after the closer is the block's, as older page bodies wrote it.

---

## Lists

### Unordered with attributes

```markdown
- First item {data-id="list-1"}
- Second item
```

```html
<ul data-id="list-1">
  <li>First item</li>
  <li>Second item</li>
</ul>
```

### Ordered with start number

The editor writes the start number natively, as the first item's number:

```markdown
- Parent item {data-id="parent"}
  5. Nested item
  6. Another nested
```

```html
<ul data-id="parent">
  <li>Parent item
    <ol start="5">
      <li>Nested item</li>
      <li>Another nested</li>
    </ol>
  </li>
</ul>
```

`{start=5}` and `{start="5"}` on the first item are still read. A native number other than 1 wins over the group. The start is clamped to 0–999999999.

A list's attribute block may sit on any item's line, after whitespace, or on its own line directly after the list (where the editor writes it when no item starts with a paragraph). Only `data-*`, `class` and `start` reach the list element; an id is dropped. Adjacent lists alternate their markers (`-`/`*`, `.`/`)`) so they stay separate.

### Task lists

```markdown
- [ ] Unchecked task
- [x] Completed task
```

The first item decides the list's type. When it is `- [ ]` or `- [x]`, every item is a task, and an item with no box is unchecked; when it is plain, the list is plain and a later `[ ]` is literal text. Task lists nest at any depth, with normal list indentation. An item that opens with a block other than a paragraph is written `- [ ]` with the block indented below it. Only bullet lists are task lists.

```html
<ul class="task-list">
  <li class="task-list-item"><input type="checkbox" id="cbx_0" disabled="true"><label for="cbx_0">Unchecked task</label></li>
  <li class="task-list-item"><input type="checkbox" id="cbx_1" checked="true" disabled="true"><label for="cbx_1">Completed task</label></li>
</ul>
```

---

## Tables

### Basic with alignment

```markdown
| Left | Right | Center |
| :--- | ----: | :----: |
| data |  data |  data  |
{data-id="table1"}
```

```html
<table data-id="table1">
  <thead><tr>
    <th style="text-align:left">Left</th>
    <th style="text-align:right">Right</th>
    <th style="text-align:center">Center</th>
  </tr></thead>
  <tbody><tr>
    <td style="text-align:left">data</td>
    <td style="text-align:right">data</td>
    <td style="text-align:center">data</td>
  </tr></tbody>
</table>
```

The editor writes a table's attribute line after a blank line. A last row holding only an attribute block, as older bodies wrote it, is read as the table's attributes too. Markdown has no header-less table, so one is written under a header row whose cells are all empty, with `data-headerless="true"` in the table's attribute line; that row and the marker are dropped again, and the table renders with no `<thead>`. A header row whose cells are all empty and has no marker is a real header row left blank, and is kept. Every other row is kept, including a body row whose cells are all empty, and a cell holding only `{...}` that is not an attribute block is the cell's text.

### Cell-level attributes (colspan, rowspan, classes)

```markdown
| h1               |   h2 |         h3         |
| :--------------- | ---: | :----------------: |
| c1               |   c2 |     c3 {.red}      |
| c1 {colspan="2"} |   c3 |
| data             | more | last {rowspan="2"} |
| data             | more |                    |
{data-id="table2"}
```

A cell keeps `colspan`, `rowspan` and a class; any other key in its group is dropped and reported. The header row is positional: a position a `colspan` covers holds an empty filler cell, which is dropped. A body row lists only the cells that start in it, each in the next column a `rowspan` from above leaves free, and a cell written where no column is free (such as the empty filler under a rowspan above) is dropped. A span is cut to the most a cell can span, `colspan` 1000 and `rowspan` 65534 (HTML's own limits), to the free columns from where it starts, and to the rows left; a cut span, a span that is not a whole number of at least 1, and a dropped cell with content are reported. Alignment belongs to the column: every cell takes the alignment the separator gives the column it starts in. A group on the line directly under the rows that does not start with `|` (after any indentation and `>`), such as `{.tbl}` or `{class="k"} |`, is the table's attribute line, not a row; the editor writes an empty cell's own group as a row, between pipes, `| {class="k"} |`.

A table is at most four columns wide for each cell it holds, and at most 1000 columns, or as wide as its widest row has cells when that is more: each `colspan` is cut to the room left under that width, on paste and on save, and a cut made on save is reported. A table read from Markdown is as wide as its separator row; one wider than four columns a cell, such as a lone header cell spanning ten columns, is cut on the next save, and a write of it reports the cut. The editor renders a stored span of more than 1000 columns or 65,534 rows at those limits and leaves the stored value as it is.

A body may hold at most 50,000 table cells in all, counting the empty cells markdown-it adds to fill out a short row to its header's width. A write over that is refused with `markdown.too_many_table_cells`, before the rest of the body is read. The message says the body holds more than 50,000 table cells only when it writes that many; when the filled-out rows bring it over, it says so instead. The limit is judged on the whole body: anchored ops are refused with a 400 when the body they produce is over it, though each op's Markdown is under it, and the editor refuses an edit that would bring the body over it. A body already over the limit, which a collaborator's client could store, is still read, edited and saved, as long as an edit adds no cells; its search text falls back to the raw body, and the server logs that once a page.

### Known limits of tables in the editor

- Markdown writes one alignment per column, taken from the topmost cell that starts in it. A paste or a drop gives every cell of the tables it touches its column's alignment, after prosemirror-tables has repaired a short row or an overlapping span, so a conflicting alignment is never stored.
- The table menu's alignment reads only the selected columns where a cell starts; a column a span covers holds no alignment of its own.
- When Merge cells leaves no cell starting in a column, the column's alignment goes with it: no cell is left to hold it, and the separator writes that column unaligned.
- `colwidth` and `background` are no longer set or read from pasted HTML. A stored cell from before #390 that still holds either keeps it until the next save, which drops it without a report: the editor has no channel for that report.
- In the editor a cell's class is rendered as `data-cell-class`, so an author's class cannot restyle the CMS itself; the site renders it as a real `class`.

The site's typographer still swaps glyphs for display, though it never drops a character the author wrote: straight quotes become curly quotes (`“”`, `‘’`), `--` and `---` become `–` and `—`, `(c)`, `(r)` and `(tm)` in either case become `©`, `®` and `™` (so their case is lost), `+-` becomes `±`, and exactly three dots become `…`. `!!!!`, `????`, `,,`, `..` and `....` render as written, as the editor and the CTA settings editor store them, and `?...` renders as `?…`, not `?..`.

---

## Tabs

```markdown
===tabs-container {data-tabs-groupId="languages" data-id="tabs1"}

@tab python {class="lang-tab"}
Python content here

@tab typescript {class="lang-tab"}
TypeScript content here

===
```

```html
<div class="leed-tabs__container" data-tabs-groupId="languages" data-id="tabs1">
  <div class="leed-tabs__wrapper">
    <ul role="tablist" class="leed-tabs">
      <li role="tab" ... class="leed-tabs__item leed-tabs__item--active">
        <span class="lang-tab">python</span>
      </li>
      <li role="tab" ... class="leed-tabs__item">
        <span class="lang-tab">typescript</span>
      </li>
    </ul>
  </div>
  <div class="leed-tabs__panels">
    <div id="panel-0-0" role="tabpanel" ... class="block"><p>Python content here</p></div>
    <div id="panel-0-1" role="tabpanel" ... class="hidden"><p>TypeScript content here</p></div>
  </div>
</div>
```

- Tab titles can have `{title="tooltip text"}` attribute
- A tab label's class is kept in a CMS page body and rendered on the label's `<span>`; `{.a .b}` and `{class="a b"}` both give `class="a b"`
- A tab label is plain text; `\{`, `\}` and `\\` in it stand for `{`, `}` and `\`. A line or paragraph separator (U+2028, U+2029) is part of the label, and the editor writes it back unchanged. A line ending in a label set over the API is written as a space, so the tab is kept
- Only a line `@tab` followed by a label is a marker; any other line starting `@tab` is content of the current tab
- Content before the first `@tab` is kept, before the group
- The closing `===` and the `@tab` markers are never read inside fenced code
- A tab group inside a list item is read at the item's indent
- In a CMS page body a tab cannot hold another tab group: a nested group is lifted out to directly after the outer one
- Tab groups support icon configuration via `env.documentationConfiguration.tabGroups`
- Tabs can contain any content: code blocks, mermaid, math, images, etc.

---

## Embeds (`{% type params %}`)

A parameter value is double-quoted, single-quoted or bare, read with the attribute grammar's quoting rule (a double-quoted value decodes `&quot;`, `&amp;`, `&#123;` and `&#125;`). A key matches whole, so `data-src` is never read as `src`. An unknown embed type is left as literal text.

### YouTube

```markdown
{% youtube videoId="dQw4w9WgXcQ" data-id="vid-1" width="800" height="600" %}
```

```html
<div class="embedded-youtube video-player">
  <iframe data-id="vid-1" width="800" height="600" src="https://www.youtube.com/embed/dQw4w9WgXcQ" allowfullscreen ...></iframe>
</div>
```

`title` names the player; `startTime`, `endTime`, `loop`, `controls`, `muted`, `showInfo`, `rel`, `modestbranding` and `autoplay` become player options on the embed URL, as in the editor's preview.

### Cloudflare Video

```markdown
{% cloudflare videoId="abc123" assetId="xyz" data-id="cf-1" controls="true" thumbnailTimestamp="31.1" %}
```

```html
<div class="embedded-cf-video video-player">
  <iframe data-id="cf-1" data-assetid="xyz" data-cloudflare-video="true" src="https://customer-...cloudflarestream.com/abc123/iframe?..." ...></iframe>
</div>
```

### Audio

```markdown
{% audio path="/audio.mp3" assetId="aaa-111" data-id="aud-1" controls autoplay %}
```

```html
<audio data-id="aud-1" data-assetid="aaa-111" controls autoplay>
  <source src="/audio.mp3" type="audio/mpeg">
  Your browser does not support the audio element.
</audio>
```

### iFrame

The URL is supplied with `src` (the only supported URL parameter — `path` is not supported).
Supported attributes: `src` (required), `title`, `width`, `height`, `sandbox`, `loading`
(`lazy`/`eager`), `allowFullScreen` (`true`/`false`), `referrerPolicy`, and `data-id`.
Iframe attributes are rendered only when present in the markdown — nothing is injected,
so an omitted attribute is simply absent from the output `<iframe>`. `sandbox` values may
contain spaces (e.g. `allow-scripts allow-same-origin`) and `src` case is preserved verbatim.

Minimal:

```markdown
{% iframe src="https://example.com/embed" %}
```

```html
<div class="embedded-iframe">
  <iframe src="https://example.com/embed"></iframe>
</div>
```

Full options:

```markdown
{% iframe src="https://example.com/embed" title="Embedded demo" width="800" height="600" sandbox="allow-scripts allow-same-origin" loading="lazy" allowFullScreen="true" referrerPolicy="no-referrer" data-id="iframe-1" %}
```

```html
<div class="embedded-iframe">
  <iframe data-id="iframe-1" width="800" height="600" src="https://example.com/embed" title="Embedded demo" sandbox="allow-scripts allow-same-origin" loading="lazy" referrerpolicy="no-referrer" allowfullscreen></iframe>
</div>
```

### Form (renders Handlebars partial)

```markdown
{% form formId="contact-form" data-id="form-1" autosave="true" %}
```

```html
{{> leed/form data-id="form-1" formId="contact-form" autosave }}
```

### Icon (block and inline)

```markdown
{% icon fa-brands fa-linux %}
```

```html
<i class="fa-brands fa-linux"></i>
```

An icon after other text on a line, or at the start of a later line of a paragraph, stays inline.

Inline within text:
```markdown
Click {% icon fa fa-home %} to go home.
```

```html
<p>Click <i class="fa fa-home"></i> to go home.</p>
```

---

## Handlebars Comments (stripped before processing)

```markdown
{{!-- Block comment --}}
{{! Single-line comment }}
{{!--
Multi-line
comment
--}}
```

All removed from output. Escaped `\{{!-- ... --}}` is preserved as literal text. A comment inside a code span or fenced code is code and is kept, and a comment never spans a blank line. Importing Markdown into a CMS page body strips comments the same way, so they never reach the stored body.

HTML comments `<!-- … -->` are stripped on import into a CMS page body too, inline or as a block of their own, and inside code they are kept. The published site renders an HTML comment as an invisible comment.

---

## Attribute Placement Summary

| Element        | Attribute syntax              | Attribute lands on                         |
| -------------- | ----------------------------- | ------------------------------------------ |
| Heading        | `# Text {attrs}`              | `<h1 attrs>`                               |
| Paragraph      | `Text {attrs}`                | `<p attrs>`                                |
| Code fence     | `` ```lang {attrs} ``         | `<pre attrs>`                              |
| Link           | `[text](url){attrs}`          | `<a attrs>`                                |
| Image          | `![alt](url){attrs}`          | `<img attrs>`                              |
| List           | `- item {attrs}`              | `<ul attrs>` or `<ol attrs>`               |
| Table          | `{attrs}` (line after table)  | `<table attrs>`                            |
| Table cell     | `content {attrs}`             | `<td attrs>` or `<th attrs>`               |
| Blockquote     | `{attrs}` (line after quote)  | `<blockquote attrs>`                       |
| Alert          | `:::type {attrs}`             | `<aside attrs>`                            |
| Collapsible    | `+++ Title {attrs}`           | `<details attrs>`                          |
| Tabs container | `===tabs-container {attrs}`   | `<div class="leed-tabs__container" attrs>` |
| Tab label      | `@tab name {attrs}`           | `<span attrs>` inside tab `<li>`           |
| Mermaid        | `` ```mermaid {attrs} ``      | `<pre class="mermaid" attrs>`              |

This is where the attribute lands **when the markdown is rendered**, an `id` excepted: no element
ever takes a user-written `id`. It is not what a CMS page body stores: on a heading and a
paragraph only `data-id` survives import, so a `class` written there reaches neither the stored
content nor the built page. See [`{#custom-id}` is not supported](#custom-id-is-not-supported).

---

## `data-id` and AI Authoring

Every top-level block in CMS content carries a `data-id` — a stable identifier the
editor assigns automatically. When **authoring new content**, do **not** invent or
include `data-id` attributes: they are assigned on import, and hand-written ids can
collide. Write clean Leed Markdown and let the system attach the ids.

`data-id`s matter when **editing existing content** through the authoring tools:

- Read a page's current body first; the returned markdown shows each block's
  `data-id` (e.g. `Paragraph text {data-id="p1"}`).
- Reference those ids as anchors when proposing edits (insert before/after, replace,
  or delete a block). Only use ids that appear in the content you just read — never
  guess one. If an anchor id is missing (the page changed since you read it), re-read
  and re-plan.

Internal cross-links use the `pageid:` scheme rather than a URL path: `[label](pageid:<pageId>)`
links to a page, and `[label](pageid:<pageId>#anchor-slug)` links to a heading anchor on
it. Reserve pages first to obtain their `pageId`s, then author bodies that link across
them — links resolve to the correct URL even if a page later moves. The `#anchor-slug` must be
a heading id the build generates on the target page; see
[Heading anchors](#heading-anchors) for how those are produced.
