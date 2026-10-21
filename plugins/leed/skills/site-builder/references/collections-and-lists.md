# Collections & List Pages Reference

List pages are paginated index pages that display collections of content (e.g., blog index, topic archives, author pages). They are central to how the Leed site-management build organizes and displays content.

Any list of pages comes from one of these collections — never from filtering `collections.all` by hand or in JavaScript. When a custom loop is genuinely needed, the rule and its required comment are site-patterns rule 7 (`../site-patterns/references/collections-and-loops.md`).

## Collection Naming Convention

Collections are built automatically from page types. The naming pattern is:

```
collections.pageTypeId-{pageTypeId}:{variant}
```

### Collection Variants

| Variant | Description | Use Case |
|---------|-------------|----------|
| `:paged` | All pages of a type, split into paginated chunks | Main blog index, paginated lists |
| `:unpaged` | All pages of a type, single flat list (no pagination) | Comparison index, "show all" pages |
| `:labels` | Pages grouped by label, each group paginated | Topic/category archive pages |
| `:authors` | Pages grouped by author, all items per author on one page (not paginated) | Author archive pages |

There are also flat collections (no variant suffix):

| Name | Description |
|------|-------------|
| `pageTypeId-{id}` | All pages of a type (flat array, includes generated pages) |
| `pageTypeId-{id}:labelId-{labelId}` | Pages of a type with a specific label |
| `allPages` | Every page with a valid pageId |
| `pageTypeIds` | Array of all page type ID strings |

## List Page Frontmatter

List pages use Eleventy's pagination system to generate pages from collections. The frontmatter structure is critical — every field matters.

### Main Paginated List (e.g., Blog Index)

```yaml
---
{
  "title": "Blog",
  "layout": "content-list.hbs",
  "publishedAt": "list",
  "modifiedAt": "list",
  "pageTypeId": "100111",
  "pagination": {
    "data": "collections.pageTypeId-100111:paged",
    "size": 1,
    "alias": "list",
    "addAllPagesToCollections": true,
    "generatePageOnEmptyData": false,
    "reverse": false
  },
  "pageId": "0597a0af",
  "permalink": "{{ pageType this.pageTypeId 'slug' }}{{#unless list.page.last }}/page/{{ add list.page.number 1 }}{{/unless}}/index.html"
}
---
```

### Label/Topic Archive (e.g., Blog by Topic)

```yaml
---
{
  "title": "Insights, Ideas, and Updates",
  "layout": "content-list.hbs",
  "publishedAt": "list",
  "modifiedAt": "list",
  "pageTypeId": "100111",
  "pagination": {
    "data": "collections.pageTypeId-100111:labels",
    "size": 1,
    "alias": "list",
    "addAllPagesToCollections": true,
    "generatePageOnEmptyData": false,
    "reverse": false
  },
  "pageId": "890d4cc3",
  "permalink": "{{ pageType this.pageTypeId 'slug' }}/topic/{{ label list.name 'slug' }}{{#unless list.page.last}}/page/{{ add list.page.number 1 }}{{/unless}}/index.html"
}
---
```

### Author Archive (e.g., Blog by Author)

```yaml
---
{
  "title": "Articles by",
  "layout": "content-list.hbs",
  "publishedAt": "list",
  "modifiedAt": "list",
  "pageTypeId": "100111",
  "pagination": {
    "data": "collections.pageTypeId-100111:authors",
    "size": 1,
    "alias": "list",
    "addAllPagesToCollections": true,
    "generatePageOnEmptyData": false,
    "reverse": false
  },
  "pageId": "2045fe97",
  "permalink": "{{ pageType this.pageTypeId 'slug' }}/author/{{ user list.name 'slug' }}/index.html"
}
---
```

### Unpaged Collection (e.g., Comparison Index)

```yaml
---
{
  "title": "Compare",
  "layout": null,
  "publishedAt": "list",
  "modifiedAt": "list",
  "pageTypeId": "110011",
  "pagination": {
    "data": "collections.pageTypeId-110011:unpaged",
    "size": 100000,
    "alias": "list",
    "addAllPagesToCollections": true,
    "generatePageOnEmptyData": true,
    "reverse": false
  },
  "pageId": "70b90da2"
}
---
```

## Critical Frontmatter Rules

### `publishedAt` and `modifiedAt` MUST be `"list"`

For list pages, set these to the string `"list"` — NOT a date. This tells the build system (via `eleventyComputed.js`) to derive the date from the most recent item in the collection. The system reads the pagination alias name and uses it to find the latest date in the paginated data.

If you set an actual date, the list page will have a static date that doesn't reflect its content.

### `pageId` MUST be unique — use short IDs for list pages

Every list page needs its own unique `pageId`. For list pages, use a **short 8-character ID** (the first 8 characters of a UUID), not a full UUID. This is the convention for list/index pages. Examples: `"0597a0af"`, `"890d4cc3"`, `"2045fe97"`, `"70b90da2"`.

The build system constructs a `uniquePageId` for each generated page:

| Collection Type | uniquePageId Format |
|----------------|-------------------|
| `:paged` | `list-{pageId}-{pageNumber}` (last page omits number) |
| `:labels` | `list-{pageId}-{labelId}-{pageNumber}` (last page omits number) |
| `:authors` | `list-{pageId}-{userId}` |
| `:unpaged` | `{pageId}` (unchanged) |

Link to a list page with `pageid:` and its `uniquePageId` — `pageid:list-0597a0af` for the blog index above — never with a path. See site-patterns rule 5.

Duplicate `pageId` values across list pages will cause build failures.

### `pagination.alias` MUST be `"list"`

Always use `"list"` as the alias. This is what the build system expects — it's how `eleventyComputed.js` detects double-layer pagination and derives dates, unique IDs, and other computed fields.

### `pagination.size` is 1 for double-layer collections

For `:paged`, `:labels`, and `:authors` collections, set `size: 1`. These collections return pre-paginated `PageData` objects (the paging plugin already chunked the items). Each `PageData` object becomes one generated page. Setting `size: 1` means "one PageData object per generated page."

For `:unpaged`, set `size` to a very large number (e.g., `100000`) since all items are on one page.

### `:authors` is NOT paginated within each author

The `:authors` collection groups pages by author but puts ALL of an author's pages on a single page (no multi-page pagination per author). This means each author gets exactly one generated page containing all their content. The permalink for author pages does not include page numbers.

### `permalink` uses Handlebars helpers

Permalinks are Handlebars templates that generate the URL for each page:

| Helper in Permalink | Purpose |
|-------------------|---------|
| `{{ pageType this.pageTypeId 'slug' }}` | Page type slug (e.g., `blog`) |
| `{{ label list.name 'slug' }}` | Label slug for `:labels` collections |
| `{{ user list.name 'slug' }}` | Author slug for `:authors` collections |
| `{{ add list.page.number 1 }}` | 1-based page number |
| `{{#unless list.page.last}}...{{/unless}}` | Skip page suffix on last page (clean URL) |

## PageData Object Structure

When using `:paged`, `:labels`, or `:authors` collections, each item in the pagination is a `PageData` object:

```typescript
{
  name: string;          // Collection name, or label/author ID
  total: number;         // Total items across all pages
  size: number;          // Items on this specific page
  page: {
    first: boolean;      // Is first page?
    number: number;      // 0-indexed page number
    next: boolean;       // Has next page?
    previous: boolean;   // Has previous page?
    last: boolean;       // Is last page?
    rangeStart: number;  // 1-indexed first item position
    rangeEnd: number;    // 1-indexed last item position
  };
  pagingSize: number;    // Configured items per page
  pageCount: number;     // Total number of pages
  pageData: Item[];      // Array of content items on this page
}
```

### Accessing items in templates

```hbs
{{!-- Iterate items on the current page --}}
{{#each (reverse @root/list.pageData) }}
  <a href="{{ this.url }}">
    <h3>{{ this.data.title }}</h3>
    <p>{{ this.data.summary }}</p>
  </a>
{{/each}}
```

Each item in `pageData` has:
- `this.url` — Page URL
- `this.data.title` — Page title
- `this.data.summary` — Page summary
- `this.data.publishedAt` — Publication date
- `this.data.modifiedAt` — Modified date
- `this.data.featureImage` — Feature image object
- `this.data.labels` — Array of label IDs
- `this.data.authors` — Array of author IDs
- `this.data.wordCount` — Word count
- `this.data.page.url` — Same as `this.url`

### Accessing current grouping (labels/authors)

For `:labels` collections, `list.name` is the label ID:
```hbs
{{#with (label list.name) }}
  <h1>{{ this.name }}</h1>
  <p>{{ this.description }}</p>
{{/with}}
```

For `:authors` collections, `list.name` is the user ID:
```hbs
{{#with (user list.name) }}
  <h1>Articles by {{ fullName }}</h1>
{{/with}}
```

## Pagination Controls

Use the built-in pagination component partial:

```hbs
{{!-- Standard usage (uses "list" alias by default) --}}
{{> leed/components/pagination }}
```

The partial accepts a `data=` parameter, but it only overrides the outer "is there more than one page?" check. The page numbers and range (`PaginationRange`, `SmartPaginationLinks`) read `list` from the page context and the prev/next links read `@root/pagination.href`, so the alias must still be `list`; with any other alias the bar renders without page numbers.

This renders a complete pagination bar with:
- "Showing X to Y of Z results" range
- Smart numbered page links with ellipsis
- Previous/next arrows
- Auto-hides when there's only one page

If you need fully custom pagination, you can use the low-level helpers directly:

```hbs
{{#gt list.pageCount 1}}
  {{#PaginationRange true}}
    Showing {{ @rangeStart }} to {{ @rangeEnd }} of {{ @total }}
  {{/PaginationRange}}

  {{{ SmartPaginationLinks true }}}

  {{#if list.page.next}}
    <a href="{{ pagination.href.next }}">Previous</a>
  {{/if}}
  {{#if list.page.previous}}
    <a href="{{ pagination.href.previous }}">Next</a>
  {{/if}}
{{/gt}}
```

## Paging Configuration

The paging size and minimum items come from the CMS company configuration (`_data/src.11tydata.json`):

```json
{
  "paging": {
    "size": 10,
    "minimumItems": 3
  }
}
```

- `size` — Items per page (default: 10)
- `minimumItems` — If the last page has fewer than this many items, they get merged into the previous page (avoids pages with just 1-2 items)

You do not set these in frontmatter — they come from the CMS configuration.

## Complete List Page Example

Here's a full blog index page with its template content:

```hbs
---
{
  "title": "Blog",
  "layout": "content-list.hbs",
  "publishedAt": "list",
  "modifiedAt": "list",
  "pageTypeId": "100111",
  "pagination": {
    "data": "collections.pageTypeId-100111:paged",
    "size": 1,
    "alias": "list",
    "addAllPagesToCollections": true,
    "generatePageOnEmptyData": false,
    "reverse": false
  },
  "pageId": "0597a0af",
  "permalink": "{{ pageType this.pageTypeId 'slug' }}{{#unless list.page.last }}/page/{{ add list.page.number 1 }}{{/unless}}/index.html"
}
---
<div class="text-center mb-8">
  <h1 class="text-4xl font-bold">{{ title }}</h1>
  <p class="text-lg text-muted-foreground mt-2">Latest articles and updates</p>
</div>
```

The `content-list.hbs` layout wraps this with the site template and adds the `contentCards` and `pagination` partials automatically. It is not part of a new site: `/leed:create blog` writes it, with those partials, from the blog recipe (`../../recipes/blog/files/src/_layouts/content-list.hbs`).
