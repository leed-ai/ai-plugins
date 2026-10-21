# Author and label pages

Details rule 7 in this skill's `SKILL.md` for the two kinds of list page that group a page type's content: one page per label (a topic archive) and one page per author.

## Start from the shipped examples

The plugin's blog recipe ships both as page templates, and `/leed:create blog` writes them for you. To add them to another page type, copy the one you need into the site, replace the `###…###` placeholders, and change only the markup — keep the frontmatter's shape. The steps are in `../create/references/authors-pages.md`.

| Page | Example | Collection |
|---|---|---|
| Label (topic) archive | `../../recipes/blog/files/features/labels/blog-topic-index.hbs` | `collections.pageTypeId-X:labels` |
| Author page | `../../recipes/blog/files/features/authors/blog-authors.hbs` | `collections.pageTypeId-X:authors` |
| The type's main index | `{appRoot}/static/templates/pages/PAGE_TYPE_INDEX.hbs`, or the blog recipe's `../../recipes/blog/files/src/blog-index.hbs` | `collections.pageTypeId-X:paged` |

All three render through a layout (`content-list.hbs` in the label and author examples) and list the group's items from `list.pageData`.

## What makes them work

```json
{
  "title": "Topic",
  "layout": "content-list.hbs",
  "publishedAt": "list",
  "modifiedAt": "list",
  "pageTypeId": "<page type id>",
  "pagination": {
    "data": "collections.pageTypeId-<page type id>:labels",
    "size": 1,
    "alias": "list",
    "addAllPagesToCollections": true,
    "generatePageOnEmptyData": false,
    "reverse": false
  },
  "pageId": "<8-character id>",
  "permalink": "{{ pageType this.pageTypeId 'slug' }}/topic/{{ label list.name 'slug' }}{{#unless list.page.last}}/page/{{ add list.page.number 1 }}{{/unless}}/index.html"
}
```

- `alias` is always `list`, and `size` is `1`: the collection is already chunked, and each chunk is one generated page.
- `publishedAt` and `modifiedAt` are the string `"list"`, so the page takes its date from its newest item.
- `list.name` is the group's key: the **label id** on a label page, the **user id** on an author page. Read the group's own fields through the helpers — `{{ label list.name 'name' }}`, `{{ label list.name 'description' }}`, `{{#with (user list.name)}}{{ fullName }}{{/with}}`.
- The `pageId` must be unique across the site. Each generated page gets `list-<pageId>-<labelId>` (or `-<userId>`) as its `uniquePageId`, which is what a `pageid:` link to it uses — see `references/links-and-images.md`.
- An author page holds every one of the author's items on one page; it is not paged.

## Linking to them

From an article's label list, link each label to its archive by `pageid:`, not by assembling a slug path:

```hbs
{{#Labels this true}}
<a href="pageid:list-<label index pageId>-{{ this.id }}">{{ this.name }}</a>
{{/Labels}}
```

`{{#Labels this true}}` and `{{#Authors this true}}` iterate the page's own labels and authors, visible ones only, with each record's id in `this.id`. `{appRoot}/static/templates/pages/PAGE_TYPE_INDEX.hbs`, the list page the CMS writes for a page type created without a recipe, prints label and author names without links, because nothing creates author or label pages for that type. When you add those pages, link the names to them by `pageid:`, as the blog recipe's starters do; never by an assembled slug path.

## What not to build

- A topic page that loops over `collections.all` and keeps the items carrying a label — that is `:labels` done by hand.
- One hand-made `.hbs` per label. Labels are CMS records; a new label must get its page without a template change.
- An author list built by hand from `userList.json`. `:authors` already groups the type's pages by author, and only authors who wrote something get a page.

`/leed:create blog` sets up a blog with both pages; see `../create/SKILL.md`.
