# Handlebars Templating Reference

## Processing Pipeline

Content flows through: **Markdown → HTML → Handlebars**

Handlebars is the template engine for all `.hbs` files (layouts, partials, pages).

## Standard Handlebars Syntax

### Variables
```hbs
{{ title }}                    {{!-- Escaped output --}}
{{{ content }}}                {{!-- Unescaped HTML output (triple-brace) --}}
{{ this.property }}            {{!-- Current context property --}}
{{ ../parentProperty }}        {{!-- Parent context (one level up) --}}
{{ @root/globalData }}         {{!-- Root-level data access --}}
```

### Conditionals
```hbs
{{#if condition}}...{{/if}}
{{#if condition}}...{{else}}...{{/if}}
{{#unless condition}}...{{/unless}}
```

### Loops
```hbs
{{#each items}}
  {{ this }}                   {{!-- Current item --}}
  {{ @index }}                 {{!-- 0-based index --}}
  {{ @key }}                   {{!-- Object key (for object iteration) --}}
  {{ @first }}                 {{!-- Boolean: is first item --}}
  {{ @last }}                  {{!-- Boolean: is last item --}}
{{/each}}
```

### Context Scoping
```hbs
{{#with someObject}}
  {{ property }}               {{!-- Scoped to someObject --}}
{{/with}}
```

### Partials
```hbs
{{> partialName }}                          {{!-- Include partial --}}
{{> partialName param1="value" }}           {{!-- With parameters --}}
{{> (concat "path/" variable) }}            {{!-- Dynamic partial name --}}
{{> @partial-block }}                       {{!-- Yield to block content --}}
```

### Block Partials (Layouts)
```hbs
{{!-- In layout: --}}
<div class="wrapper">
  {{> @partial-block }}
</div>

{{!-- In page: --}}
{{#> layout-name }}
  Content goes here
{{/layout-name}}
```

### Inline Partials
```hbs
{{!-- Define inline partial --}}
{{#*inline "cardItem"}}
  <div class="card">{{ title }}</div>
{{/inline}}

{{!-- Use it --}}
{{> cardItem title="Hello" }}
```

### Comments
```hbs
{{!-- This is a comment (not rendered) --}}
{{! Short comment }}
```

---

## Leed Customer-Facing Helpers

These are registered by the site-management build system and available in all `.hbs` templates.

### Media & Images

| Helper | Type | Usage | Description |
|--------|------|-------|-------------|
| `Image` | Block | `{{#Image url "variant"}}class="..." alt="..."{{/Image}}` | Plain `<img>` from an image URL string: swaps the URL's `original` variant for the named one, adds the block as attributes, always sets `data-responsiver="false"` (no srcset) |
| `FeatureImage` | Block | `{{#FeatureImage}}class="..." alt="..."{{/FeatureImage}}` | Page's feature image |
| `ImageTag` | Block | `{{#ImageTag imageRef}}class="..."{{/ImageTag}}` | Image from ImageReference object |
| `staticImage` | Block | `{{#staticImage url}}class="..." data-responsiver="false"{{/staticImage}}` | Static image (no CDN transform, no srcset) |
| `FeatureVideo` | Block | `{{#FeatureVideo}}class="..."{{/FeatureVideo}}` | Cloudflare video embed |
| `imageUrl` | Inline | `{{ imageUrl url "variant" }}` | Image URL with variant swap |
| `absoluteImageUrl` | Inline | `{{ absoluteImageUrl url "variant" }}` | Absolute image URL |
| `svgDiagram` | Inline | `{{ svgDiagram "svg/charts/adoption" class="..." }}` | Inline a theme-aware SVG diagram from a partial |

#### Inline SVG Diagrams (`svgDiagram`)

Inlines an SVG partial wrapped in a themed `<div class="svg-diagram ...">`, making
hand-built SVG charts/diagrams as easy to drop in as an `<img>` — but theme-aware
(light/dark) and crisp at any size, which an `<img src="*.svg">` cannot be.

```hbs
{{ svgDiagram "svg/charts/adoption" class="max-w-3xl mx-auto mt-12 rounded-xl" }}
```

- SVG files live in `src/_includes/svg/` (organize with subfolders like an images
  directory). The partial name is the path under `_includes/` without the extension.
- The name **must be quoted** — unquoted is treated as a variable lookup.
- `class` is added to the wrapper; the inner `<svg>` is auto-sized to fill it.
- Styling is centralized in `tailwind/site/svg-diagrams.css` with `svgd-`-prefixed,
  theme-aware classes.

**See `references/svg-diagrams.md` for the full pattern** (file organization,
centralized Tailwind styling, the `svgd-` prefix convention, and worked examples).

**Image variants and sizes:**

Choose the variant that matches the maximum rendered size of the container. If an image can never be wider than 640px, use `medium`. Do not use `original` or `xxl` for thumbnails.

| Variant | Fit | Max Width | Max Height | Use Case |
|---------|-----|-----------|------------|----------|
| `original` | scale down | 5120 | 2880 | Full-resolution download |
| `xxl` | scale down | 2560 | 1440 | Full-width hero on large screens |
| `xl` | scale down | 1920 | 1080 | Full-width hero on standard screens |
| `large` | scale down | 1280 | 720 | Wide content images, banners |
| `medium` | scale down | 640 | 480 | Card images, content images |
| `small` | scale down | 320 | 240 | Thumbnails, small cards |
| `social` | contain | 800 | 418 | Open Graph / social sharing cards |
| `profile` | crop | 400 | 400 | Author/user profile images |
| `profiletiny` | crop | 48 | 48 | Inline avatar icons, bylines |

**Fit options:**
- **scale down** — shrink to fit within dimensions, never enlarge
- **contain** — resize to fill as much as possible while preserving aspect ratio
- **crop** — shrink and crop to exactly fill the dimensions

**Disabling responsive srcset (`data-responsiver="false"`):**

The build system automatically generates responsive `srcset` attributes for images. To disable this for a specific image, add `data-responsiver="false"` to the `<img>` tag:

```hbs
{{!-- In Handlebars block helpers, pass it as an attribute --}}
{{#Image url "medium"}}class="w-10 h-10 rounded-full" data-responsiver="false"{{/Image}}

{{!-- In raw HTML --}}
<img src="/static/images/icon.svg" data-responsiver="false" alt="Icon" width="24" height="24">

{{!-- In markdown, use inline attributes --}}
![Logo =200x60](/static/images/logo.svg){data-responsiver="false"}
```

**SVG images MUST always have `data-responsiver="false"`** — srcset does not work with SVGs. The `Image` helper always sets it; `FeatureImage` and `ImageTag` set it automatically when the image has `svg: true` in its ImageReference. For raw `<img>` tags referencing SVGs, you must set it manually.

Use `data-responsiver="false"` for:
- SVG images (required)
- External images not served through Cloudflare image delivery
- Small fixed-size images (icons, avatars) that should not be responsive
- Images in email templates or other non-web contexts

### Dates

| Helper | Type | Usage | Description |
|--------|------|-------|-------------|
| `date` | Block | `{{#date "MMMM D, YYYY" this}}{{ publishedAt }}{{/date}}` | Format dates |
| `latestDate` | Inline | `{{ latestDate "publishedAt" "collectionId" }}` | Most recent date in collection |

**Built-in date formats:** `iso`, `rfc3339`, `rfc822`, `default`, or any [day.js format string](https://day.js.org/docs/en/display/format).

**Common pattern:**
```hbs
<time datetime="{{#date 'iso'}}{{ publishedAt }}{{/date}}">
  {{#date "MMMM D, YYYY" this}}{{ publishedAt }}{{/date}}
</time>
```

### Collections & Data

| Helper | Type | Usage | Description |
|--------|------|-------|-------------|
| `Authors` | Block | `{{#Authors this true}}...{{/Authors}}` | Iterate page authors |
| `Labels` | Block | `{{#Labels this true}}...{{/Labels}}` | Iterate page labels |
| `Series` | Block | `{{#Series labelObj}}...{{/Series}}` | Iterate series items |
| `MultipartSeries` | Block | `{{#MultipartSeries labelObj}}...{{/MultipartSeries}}` | Multipart series items |
| `AnnouncementSeries` | Block | `{{#AnnouncementSeries this}}...{{/AnnouncementSeries}}` | Announcement series |
| `IfMultipartSeries` | Block | `{{#IfMultipartSeries labelObj}}...{{/IfMultipartSeries}}` | Conditional: is multipart? |
| `IfAnnouncementSeries` | Block | `{{#IfAnnouncementSeries labelObj}}...{{/IfAnnouncementSeries}}` | Conditional: is announcement? |
| `pageType` | Inline/Block | `{{ pageType uuid "slug" }}` | Look up pageType field |
| `user` | Inline/Block | `{{ user uuid "firstName" }}` | Look up user field |
| `label` | Inline/Block | `{{#with (label uuid)}}...{{/with}}` | Look up label object |
| `collection` | Inline | `{{ collection "name" }}` | Get named collection |
| `sorted` | Inline | `{{ sorted list "data.title" }}` | Sorted copy of an array |
| `filterObject` | Inline | `{{ filterObject map "field" "value" }}` | Filter objects |

**Block helper context variables (Authors, Labels, Series):**
- `this` — Current item
- `@index` — 0-based position
- `@total` — Total count
- `@first` / `@last` — Boolean flags

**Collection iteration pattern:**
```hbs
{{#Labels this true}}
  {{!-- this.id is the label's id; 890d4cc3 is the label index page's pageId --}}
  <a href="pageid:list-890d4cc3-{{ this.id }}">
    {{ this.name }}
  </a>
{{/Labels}}
```

**`sorted` usage:** collections arrive in the build's own order — published date,
then url. `sorted` returns a **copy** in a different one, so the collection stays
untouched for every other template that reads it. Prefer it over
handlebars-helpers' `sort`/`sortBy`, which sort in place and compare raw
codepoints (so a lowercase title like `i18n` lands after `Zebra`).

```hbs
{{!-- By a dot path, ascending --}}
{{#each (sorted collections.[pageTypeId-ptblog] "data.title")}}
  <h3>{{ this.data.title }}</h3>
{{/each}}

{{!-- Descending, and composed with the collection helper --}}
{{#each (sorted (collection "pageTypeId-ptblog:labelId-news") "data.publishedAt" reverse=true)}}
  <h3>{{ this.data.title }}</h3>
{{/each}}

{{!-- No field: sorts the values themselves --}}
{{#each (sorted someStrings)}}{{ this }}{{/each}}
```

Comparison is locale-aware, case-insensitive and numeric — `i18n` sorts among
the letters and `Chapter 10` follows `Chapter 9`. Entries missing the field sort
to the end in both directions.

### Content & Text

| Helper | Type | Usage | Description |
|--------|------|-------|-------------|
| `process` | Block | `{{{ process content }}}` | Process markdown content |
| `readingTime` | Inline | `{{ readingTime }}` | Reading time from wordCount |
| `fullName` | Inline | `{{ fullName }}` | firstName + lastName |
| `concat` | Inline | `{{ concat "a" "b" "c" }}` | Concatenate strings |
| `wrapSubstring` | Inline | `{{ wrapSubstring field "text" "class" }}` | Wrap text in span |
| `stripTags` | Inline | `{{ stripTags html }}` | Remove HTML tags |
| `firstTruthy` | Block | `{{#firstTruthy a b c}}...{{/firstTruthy}}` | First truthy value becomes block context |

**`firstTruthy` usage:** Tests arguments in order; the first truthy value becomes `this` inside the block. Use this instead of `(or ...)` when you need the actual value, not a boolean:

```hbs
{{!-- Use the custom title if set, otherwise fall back to the page title --}}
{{#firstTruthy customTitle title }}
  <h1>{{ this }}</h1>
{{/firstTruthy}}

{{!-- Resolve a data object with fallback --}}
{{#firstTruthy data @root/list }}
  {{!-- this = the first truthy object --}}
  <p>{{ this.name }}</p>
{{/firstTruthy}}
```

### URLs

| Helper | Type | Usage | Description |
|--------|------|-------|-------------|
| `url` | Inline | `{{ url }}` or `{{ url "relative" }}` | Current page URL |
| `siteUrl` | Inline | `{{ siteUrl }}` | Site domain URL |
| `buildUrl` | Inline | `{{ buildUrl url "key=value" }}` | Append query params |

### Pagination

| Helper | Type | Usage | Description |
|--------|------|-------|-------------|
| `PaginationLinks` | Block | `{{#PaginationLinks true}}...{{/PaginationLinks}}` | Iterate page links |
| `SmartPaginationLinks` | Inline | `{{{ SmartPaginationLinks true }}}` | Smart pagination HTML |
| `PaginationRange` | Block | `{{#PaginationRange true}}...{{/PaginationRange}}` | Show range info |

**PaginationRange context:** `@rangeStart`, `@rangeEnd`, `@total`

**Pagination data context:**
- `list.pageCount` — Total pages
- `list.page.next` / `list.page.previous` — Boolean
- `pagination.href.next` / `pagination.href.previous` — URLs

### Forms & Interactive

| Helper | Type | Usage | Description |
|--------|------|-------|-------------|
| `CTA` | Inline | `{{{ CTA "targetElementId" }}}` | **Deprecated** — use `data-leed-cta` on the element |
| `Recommendations` | Inline | `{{{ Recommendations "targetElementId" }}}` | **Deprecated** — use `data-leed-recommendations` on the element |
| `turnstileKey` | Inline | `{{ turnstileKey }}` | Cloudflare Turnstile key |

**Note:** the `CTA` and `Recommendations` helpers are deprecated in favor of the `data-leed-cta` and `data-leed-recommendations` attributes below. Neither emits a `<script>` tag any more, so a site can ship a strict Content-Security-Policy with no `unsafe-inline`. If you still call them, use triple-braces `{{{ }}}` — they output an HTML marker element.

#### CTA (Call-to-Action) System

CTAs are dynamic content blocks managed in the CMS. They can be scoped to specific page types and labels. CTAs are served live, so editing one in the CMS changes what a published site shows without a republish. Dynamic CTAs are a Growth feature: add the slot with `/leed:create cta`, which checks the plan first, and write none below Growth.

**Setup pattern:** put `data-leed-cta` on the element that should receive the CTA. Style it however you like — the CTA content is appended into it as HTML.

```hbs
<section data-leed-cta class="font-semibold dark:font-bold"></section>
```

**How it works at runtime:**
- On DOM ready the client finds every `[data-leed-cta]` element and waits for the page session to initialize
- Fetches `{ ctaId, content }` as JSON from `/api/sway/v2/{pageId}`, matched on the current page ID, page type, and labels
- Wraps the content in a `<div name="cta" data-id="cta-{ctaId}">` and appends it to the element
- Every link inside the CTA gets a `data-reason` UTM string applied client-side, including a `utm_content` taken from the link text
- Nothing is rendered when the site's plan does not include dynamic CTAs, or when no CTA matches. Unlike recommendations, the element is left alone rather than hidden

**Deprecated:** `{{{ CTA "targetId" }}}` still works and still respects the page's `disableCta` frontmatter field (when `true` it emits nothing). It renders into `<section id="targetId">` exactly as before, and no longer emits any `<script>`. Prefer the attribute in new templates.

```hbs
{{!-- Deprecated form --}}
<section id="article-cta" class="font-semibold dark:font-bold"></section>
{{{ CTA "article-cta" }}}
```

#### Recommendations Widget

Recommendations show related content based on the current page. The CMS configures which page types allow recommendations via `allowRecommendations` in `pageTypeList.json`. Recommendations are a Growth feature: `/leed:create recommendations` checks the plan, turns `allowRecommendations` on, adds the slot and the card, and writes an offline preview for `leed site build --serve`; write none below Growth.

**Setup pattern:** put `data-leed-recommendations` on the element that should receive the cards. That is the whole API — no helper call, no id to keep in sync, no inline script (so a strict Content-Security-Policy needs no `unsafe-inline`). Put as many on a page as you like; each one fills independently.

```hbs
<section data-leed-recommendations class="max-w-6xl container mx-auto">
  <div class="mb-16 text-center">
    <h2 class="text-3xl mt-0 mb-4">Recommended</h2>
    <p class="text-lg font-medium text-fg-muted">
      Take a look at these other articles...
    </p>
  </div>
</section>
```

Put the attribute on the **wrapper**, heading and all. Cards are appended after whatever the element already contains, so your heading stays above them — and when there are no recommendations the whole section is hidden, heading included. That is what replaces the old two-element `id` + `id-container` convention: one element, one attribute, no ids to keep in sync.

**How it works at runtime:**
- On DOM ready the client finds every `[data-leed-recommendations]` element and waits for the page session
- Fetches an array of recommendation objects as JSON from `/api/abby/v2/{pageId}`
- Clones the `<template id="leed-stub-template">` — injected into the page automatically, and only into pages that host a widget — once per recommendation, and fills its slots (see **Stub template** below)
- Every link in a stub gets a `data-reason` UTM string applied client-side, including a `utm_content` taken from the link text
- If no recommendations are found the widget is hidden via `display: none !important`, so a heading never sits over an empty box. The `!important` ensures the hide wins even when the element carries an `!important` display utility such as `block!`
- Wrap the widget in an element with `id="{targetId}-container"` and that wrapper is hidden instead — useful when the heading lives outside the element receiving the cards

**Deprecated:** `{{{ Recommendations "targetId" }}}` still works. It renders into `<section id="targetId">` exactly as before, and no longer emits any `<script>`. Prefer the attribute in new templates.

```hbs
{{!-- Deprecated form: wrapper with -container suffix, target inside, helper anywhere on the page --}}
<div id="recommendations-container" class="block!">
  <h2>Recommended</h2>
  <section id="recommendations"></section>
</div>
{{{ Recommendations "recommendations" }}}
```

##### Stub template

Each recommendation card is rendered from a template. Leed ships a default that renders with no action from you, so nothing needs migrating to keep working. To customize it, run `leed site eject stub-template` — that writes the current Leed default to `_includes/stub-template.hbs`, where you own it. Recommendations are Growth+, so `stub-template` is too: below Growth the endpoint returns nothing and the template renders no cards, however it is authored. It is rendered ONCE at build time into a `<template>` element and cloned per recommendation in the browser, so it holds slot attributes rather than Handlebars expressions.

**Know what it costs.** The compiled `<template>` is inlined into every page that displays recommendations, not served as a separate cached file — that is deliberate, since a shared file would cost a network round trip on every such page. It does mean the per-page weight is whatever you author, on every page with the widget. The shipped default is under a kilobyte raw and around 300 bytes gzipped (less again after minification); keep yours in the same range. It is a card skeleton whose slots get filled client-side, not a place for large static markup.

| Attribute | Meaning |
|-----------|---------|
| `data-leed-slot="field"` | Fill this element from `field`. `<a>` → `href`, `<img>` → `src` (and `alt` from the title), `<time>` given a timestamp → `datetime` + the date rendered in your site's configured `dateFormat` and `timezone` (the same string `{{#date "default"}}` produces elsewhere), anything else → text content. A falsy value removes the element. |
| `data-leed-each="field"` | On a nested `<template>`: repeat its content once per element of the `field` array, filling each copy's slots from that element. An empty array removes the host. |

Available fields: `pageId`, `url`, `title`, `summary`, `featureImage`, `publishedAt`, `wordCount`, `readingTime`, `authors` (each `{ id, fullName }`), `labels` (each `{ id, name, slug }`). Authors and labels are filtered to the visible ones, matching the built site. `readingTime` is the whole number of minutes the `readingTime` shortcode would produce for that `wordCount` at your site's `readingWpm` — a bare number, with no "min" suffix, so append your own unit text.

```hbs
<a class="page-stub" data-leed-slot="url">
    <div class="image"><img data-leed-slot="featureImage"></div>
    <ul class="labels">
        <template data-leed-each="labels"><li data-leed-slot="name"></li></template>
    </ul>
    <div class="title" data-leed-slot="title"></div>
    <time data-leed-slot="publishedAt"></time>
    <time class="reading-time" data-leed-slot="readingTime"></time>
    <div class="summary" data-leed-slot="summary"></div>
</a>
```

---

## External Handlebars-Helpers Library

19 categories from [handlebars-helpers](https://github.com/helpers/handlebars-helpers) are available. The **String** category is excluded (namespace conflict).

### Most Useful for Customers

**Comparison (boolean logic — these return true/false, NOT the actual values):**

All comparison helpers support `{{else}}` blocks:

```hbs
{{#eq a b}}equal{{else}}not equal{{/eq}}
{{#gt a b}}...{{/gt}}          {{!-- Greater than --}}
{{#lt a b}}...{{/lt}}          {{!-- Less than --}}
{{#gte a b}}...{{/gte}}        {{!-- Greater than or equal --}}
{{#lte a b}}...{{/lte}}        {{!-- Less than or equal --}}
{{#is a b}}...{{/is}}          {{!-- Strict equal --}}
{{#isnt a b}}...{{/isnt}}      {{!-- Not equal --}}
{{#unlessEq a b}}...{{/unlessEq}}
{{#and a b}}true{{else}}false{{/and}}   {{!-- Boolean AND --}}
{{#or a b}}true{{else}}false{{/or}}     {{!-- Boolean OR (returns true/false, NOT the value) --}}
{{#not a}}...{{/not}}
{{#contains collection value}}found{{else}}not found{{/contains}}
{{#isFalsey value}}...{{/isFalsey}}    {{!-- Block if falsy (false, null, undefined, 0, "") --}}
{{#isTruthy value}}...{{/isTruthy}}    {{!-- Block if truthy --}}
{{#ifEven value}}...{{/ifEven}}
{{#ifOdd value}}...{{/ifOdd}}
```

**IMPORTANT:** `or` and `and` return **booleans**, not values. Do NOT use `(or a b)` to get the first truthy value — use the Leed `firstTruthy` helper instead (see below).

**Math:**
```hbs
{{ add a b }}
{{ subtract a b }}
{{ multiply a b }}
{{ divide a b }}
{{ ceil value }}
{{ floor value }}
{{ round value }}
{{ abs value }}
```

**Array:**
```hbs
{{ first array }}              {{!-- First element --}}
{{ last array }}               {{!-- Last element --}}
{{ length array }}             {{!-- Array length --}}
{{ reverse array }}            {{!-- Reversed copy --}}
{{ sort array }}               {{!-- Sorted copy --}}
{{ join array ", " }}          {{!-- Join with separator --}}
{{#each (slice array 0 3)}}   {{!-- Subset --}}
{{#contains array value}}     {{!-- Check membership --}}
```

**Object:**
```hbs
{{ keys object }}              {{!-- Object keys array --}}
{{ values object }}            {{!-- Object values array --}}
{{#each (pick object "a" "b")}} {{!-- Subset of keys --}}
```

**Number:**
```hbs
{{ toFixed value 2 }}          {{!-- Decimal places --}}
{{ addCommas value }}          {{!-- Number formatting --}}
```

**URL:**
```hbs
{{ encodeURI value }}
{{ decodeURI value }}
```

---

## Leed System Partials

### Partials You Can Use in Templates

These are available for direct use in your `.hbs` files:

| Partial | Usage | Description |
|---------|-------|-------------|
| `leed/head` | `{{> leed/head }}` | Full `<head>` content (CSS, JS, meta, Leed's own tracking), opening with the site's `header-includes.hbs` when it exists |
| `leed/menu/builder` | `{{> leed/menu/builder menuName="Header Menu" }}` | Render a navigation menu. `menuName` is the menu's name as keyed in `menu.json` |
| `leed/form` | `{{> leed/form formId="abc123" }}` | Render a CMS-defined form |
| `leed/components/pagination` | `{{> leed/components/pagination }}` | Pagination controls for list pages |
| `leed/popup-video` | `{{> leed/popup-video buttonLabel="Watch" videoSrc="..." }}` | Modal video player |
| `leed/components/scroll-status-indicator-horizontal` | `{{> leed/components/scroll-status-indicator-horizontal scrollBarId="x" }}` | Scroll progress bar |
| `leed/docs/social-icons` | `{{> leed/docs/social-icons }}` | Social media icon links |
| `leed/docs/document-search` | `{{> leed/docs/document-search [compact=true] }}` | Docs search button — for use inside a custom `docs-header.hbs`. `compact=true` renders an icon-only button that does not fill its row |
| `leed/unsubscribe-form` | `{{> leed/unsubscribe-form }}` | Email unsubscribe form (can be styled via CSS) |

### Customer-Overridable Templates

These system pages check for customer-provided overrides. Which of them a site may customize depends on its plan tier and features, so read the list from `leed site eject --json` (each row gives `name`, `description`, `destination` and `customized`) rather than from this table. Customize a replaceable template only by ejecting it: `leed site eject <name>` writes the current Leed default into your repo, where it becomes a committed, editable override, and it refuses to overwrite an existing file unless you pass `--force`. Never hand-write a replacement from memory. Templates your plan does not include are not listed, since an override the renderer ignores is worse than no override at all — see **Customizing a Leed Template** in `references/cli-commands.md` and site-patterns rule 13. The purely additive files below (`header-includes.hbs` and the two CTA files) have no default to eject, so those you write by hand (a new site already has a `header-includes.hbs` holding only a comment, to add to):

| Override File | What It Replaces | Notes |
|--------------|-----------------|-------|
| `_includes/unsubscribe.hbs` | Unsubscribe page | `leed site eject unsubscribe`. Full page replacement — build your own unsubscribe experience |
| `_includes/unsubscribed.hbs` | Post-unsubscribe confirmation page | `leed site eject unsubscribed`. Full page replacement |
| `_includes/stub-template.hbs` | Recommendation card template | Tier gated (check `leed site eject --json`). `leed site eject stub-template`. Rendered once at build time into a `<template>` and cloned per recommendation in the browser. Uses `data-leed-slot` / `data-leed-each` attributes, not Handlebars expressions — see **Stub template** above |
| `_includes/header-includes.hbs` | Additional `<head>` content | Any plan. Rendered by `leed/head` first in `<head>`, before Leed's own head content, on every page: those `site-template.hbs` wraps and the documentation and API pages, which it does not. The place for every site-wide head tag: a preload for a self-hosted font (never a font host), verification metas, analytics and other site-wide scripts (deferred), `theme-color`, the web manifest and icon fallbacks (site-patterns rule 14). Every new site starts with a comment-only copy |
| `_includes/docs-page-cta.hbs` | Additional content above the Previous/Next links on documentation pages | Any plan. Purely additive, so there is no default to eject — see the contract below |
| `_includes/api-page-cta.hbs` | Additional content above the Previous/Next links on API reference pages | Any plan. The API-page counterpart of `docs-page-cta.hbs`, checked separately |
| `_includes/docs-header.hbs` | Documentation header | Tier gated (check `leed site eject --json`). `leed site eject docs-header` gives a working starting example rather than a copy of what renders, because `chrome.hbs` fills its wrapper with your theme's own header variant. Replaces the header inside Leed's positioned wrapper — see the contract below |
| `_includes/docs-footer.hbs` | Documentation footer | Tier gated (check `leed site eject --json`). `leed site eject docs-footer` gives a byte-identical copy of the footer your site renders. Below its tier the default footer, with its licensing badge, stays |

`header-includes.hbs`, `docs-page-cta.hbs`, `api-page-cta.hbs` and `stub-template.hbs` are resolved by a direct file-existence check — create the file and it is picked up automatically. The rest use the `useCustomTemplate` check (configured in the CMS). The three CTA and head files are additions rather than replacements of Leed markup, so there is no default to eject; the other five are listed by `leed site eject`.

#### Custom documentation header

`docs-header.hbs` replaces everything **inside** `#docs-header-wrapper` for all three
documentation layouts, on Starter and above. On the free tier the file is ignored and
Leed's own header renders. Leed keeps the wrapper because the layout depends on it: each
theme positions it (`fixed`, `top-0`, its own z-index and backdrop) and the docs
JavaScript measures it to publish `--height-header`, which is the top margin of the
page body. Your markup goes inside; the position of the bar itself is not yours to set.

What Leed still provides, whatever your header renders:

- the left sidebar toggle and the mobile "Jump to" TOC — both live in the docs mini
  bar below the header, not in the header itself
- `Ctrl+K` to open search — bound on the search modal, not on the search button
- `--height-header` / `--height-toc`, recalculated on resize. `--height-header` is measured, never set by hand; layouts read it as `<div class="grow mt-(--height-header)">` and the anchor offset is `scroll-padding-top: calc(var(--height-header, var(--site-header-height, 0px)) + var(--height-toc, 0px));`, with `--site-header-height` as the author's fallback. Do not size your header from `--height-header` — site-patterns rule 12

What you take over, and should replace if you want it:

- the search button — include `{{> leed/docs/document-search }}` to keep Leed's. It
  fills the row it sits in; pass `compact=true` for an icon-only 40×40 button that
  does not grow, which is usually what a tight custom header wants. Or bind
  `@click="headerSearchShow = true"` on an element of your own to open the modal
  from your own markup
- the horizontal scroll/reading indicator
- the header's own navigation, logo and call-to-action

Two things to watch:

- **Do not `position: fixed` your own header.** The wrapper is already fixed. A fixed
  child is out of the wrapper's flow; Leed falls back to measuring your header's own
  height so the page does not slide underneath, but `position: static` inside the docs
  layout is the predictable choice. Scope it under `#docs-header-wrapper`, which exists
  only in the documentation layout, so the same header keeps its own positioning on your
  marketing pages — e.g. `#docs-header-wrapper .site-header { position: static; }`.
- **The wrapper carries `x-data` state from Alpine.** Alpine attributes in your header
  (`x-show`, `@click`) resolve against the docs header component, so `headerSearchShow`,
  `topMenuOpen` and `isSmallerThanDesktop` are all readable. Non-Alpine headers are
  unaffected — plain markup and your own JavaScript work as-is.

#### Page calls to action

Two optional partials render directly above a documentation page's Previous/Next
links, on every plan. The documentation recipe's `page-cta` feature
(`/leed:create documentation`) writes both:

| File | Renders on |
|------|-----------|
| `_includes/docs-page-cta.hbs` | Documentation pages |
| `_includes/api-page-cta.hbs` | API reference pages |

They are checked independently, so a site can ship one, the other, both with
different pitches, or neither — a reader working through a guide and a reader
reading an endpoint are not in the same place. Both are purely additive: with
neither file the pages render exactly as they do today. There is nothing to eject
and nothing to configure in the CMS. Create the file and it appears; delete it and
it stops.

```hbs
{{!-- src/_includes/docs-page-cta.hbs --}}
<aside class="docs-page-cta">
  <h2>Still stuck on {{ title }}?</h2>
  <a class="docs-button-primary" href="pageid:3f1c9a2e-5b7d-4c8e-9a1f-2d6b8e4c7a10">Talk to an engineer</a>
</aside>
```

Each is rendered with the page's own context, so `title`, `description`,
`pageTypeId`, `documentationConfiguration` and the rest of the page data are
available — enough to vary the pitch by section, or to suppress it on one page:

```hbs
{{#isnt pageTypeId "release-notes" }}
<aside class="docs-page-cta">…</aside>
{{/isnt}}
```

Two things to watch on API reference pages:

- **`api-page-cta.hbs` is rendered twice.** The Previous/Next block itself is
  emitted twice, once for the wide layout that keeps it in the main column and once
  for the narrow layout that puts it under the page, and CSS shows one of the two.
  Your CTA sits above each. It carries no breakpoint class of its own, so unlike the
  links both copies are visible — add `hidden xl:block` / `xl:hidden` inside your
  partial, or style the pair, if you want only one. Either way keep `id` attributes
  out of it, or scope them, and do not attach a script that assumes a single
  instance.
- **On a short endpoint page the wide-layout links are pinned to the bottom** of the
  main column, which stretches to the height of the sticky code-examples panel. The
  CTA is not pinned, so it sits just under the page content and the empty space falls
  between it and the links. If you would rather it hugged the links, position it from
  inside your own partial.

### Off-Limits Partials (Do NOT Reference)

These are internal system partials. Do not reference them in your templates:

- **`leed/api/**`** — API documentation rendering (part of the documentation layout system)
- **`leed/docs/**`** — Documentation layout themes (alpha, bravo, charlie) and their
  components. Two exceptions are meant for your templates: `leed/docs/social-icons`
  and `leed/docs/document-search` (for a custom `docs-header.hbs`).
- **`leed/metadata/**`** — SEO metadata (siteMetadata, ogCard, twitterCard) — auto-included via `leed/head`
- **`leed/menu/item`**, **`leed/menu/link`** — Internal recursive helpers used by `leed/menu/builder`

### Menu Builder Parameters

```hbs
{{> leed/menu/builder
    menuName="Header Menu"      {{!-- Required: the menu's name, exactly as keyed in menu.json --}}
    menuClass="custom-class"    {{!-- Optional: class on <ul> --}}
    submenuClass="sub-class"    {{!-- Optional: class on submenu <ul> --}}
    onClick="handleClick"       {{!-- Optional: click handler --}}
    instance="main"             {{!-- Optional: instance identifier --}}
}}
```

Do not pass `expanded=` here: the builder reads `expanded` from the menu record, so the param is ignored. Open submenus by default with the menu's (or an item's) own flag, `--expanded true` on `leed settings menu set-menu` (whole menu) or `leed settings menu set` (one item).

One builder serves desktop and mobile; style it through `.leed-menu__item--*` and `.leed-submenu--*`. The emitted classes and the one-builder pattern are in `../site-patterns/references/menus.md` (site-patterns rule 1).

### Form Parameters

```hbs
{{> leed/form
    formId="72339fba"           {{!-- Required: form ID from leedForms.json --}}
    heading="Subscribe"         {{!-- Optional: form heading --}}
}}
```

### Popup Video Parameters

```hbs
{{> leed/popup-video
    buttonLabel="Watch Demo"    {{!-- Required: button text --}}
    buttonClass="dark-button"   {{!-- Optional: button CSS classes --}}
    videoAssetId="asset-id"     {{!-- Required: the Leed asset id (assetId), used as data-assetid --}}
    videoSrc="https://..."      {{!-- Required: full Cloudflare Stream player (iframe) URL; autoplay=true is appended --}}
    data-id="video-1"           {{!-- Optional: tracking attribute --}}
}}
```

### Pagination Component

A ready-made pagination partial that renders range info ("Showing 1 to 10 of 42"), numbered page links with ellipsis, and previous/next arrows.

```hbs
{{!-- Default: uses @root/list automatically --}}
{{> leed/components/pagination }}

{{!-- Explicit: pass the list data object directly --}}
{{> leed/components/pagination data=list }}

{{!-- Custom alias: if your pagination uses a different alias name --}}
{{> leed/components/pagination data=myAlias }}
```

The partial automatically:
- Hides when there's only one page (`pageCount <= 1`)
- Shows "Showing X to Y of Z results" range
- Renders smart page links (first/last pages, current ±1, ellipsis for gaps)
- Shows previous/next arrows when applicable

Requires a paginated list page context (see `collections-and-lists.md`).
