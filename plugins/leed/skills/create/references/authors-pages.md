# Author and topic pages

How the blog recipe's two features work, and how to add them to a page type yourself. The rules behind them are site-patterns rule 7 and `../site-patterns/references/authors-and-label-pages.md`; this page shows the recipe's working examples.

## The examples

| Feature | Recipe file | Written to | Collection |
|---|---|---|---|
| `authors` | `../../recipes/blog/files/features/authors/blog-authors.hbs` | `src/blog-authors.hbs` | `collections.pageTypeId-<id>:authors` |
| `labels` | `../../recipes/blog/files/features/labels/blog-topic-index.hbs` | `src/blog-topic-index.hbs` | `collections.pageTypeId-<id>:labels` |
| The main list | `../../recipes/blog/files/src/blog-index.hbs` | `src/blog-index.hbs` | `collections.pageTypeId-<id>:paged` |

All three render through the recipe's `content-list.hbs` layout, which adds the cards (`contentCards.hbs`) and Leed's pager under the page's own heading.

## Creating an Authors page

An Authors page is one generated page per author of the page type, each listing everything that author wrote. You write one template; Leed's `:authors` collection makes a page for every author who has a published item, and none for anyone else.

1. The page type must exist, because the template names its id. Read it with `leed settings pagetype list --slug <slug> --json`.
2. Copy `blog-authors.hbs` to `src/<slug>-authors.hbs`. Replace `###PAGE_TYPE_ID###` with the page type's id (twice: `pageTypeId` and the collection name) and `###NEW_SHORT_ID###` with a fresh 8-character hex id no other page uses.
3. Keep the frontmatter's shape: `pagination.data` is the `:authors` collection, `alias` is `list`, `size` is `1`, and `publishedAt` and `modifiedAt` are `"list"`. `list.name` is the author's user id, so the author's own fields come from `{{#with (user list.name)}}`.
4. Change the markup below the frontmatter as you like. The author's photo is `{{#Image image "profile"}}`, never `original` (rule 6).
5. Validate, build, commit and push with the `site-publish` skill.

The permalink puts each author at `/<slug>/author/<author slug>/`.

## Creating a topic (label) page

The same, with the `:labels` collection: one page per label used in the page type, paged when it has more items than a page holds. Copy `blog-topic-index.hbs` to `src/<slug>-topic-index.hbs` and also replace `###SEPARATOR###` with the path segment to put before each label (`topic` gives `/<slug>/topic/<label slug>/`). The label's own fields come from the `label` helper: `{{ label list.name 'name' }}` (rule 11: never a bare `{{ label }}`).

## Linking to them

Link to an author or topic page by `pageid:`, never by assembling a path (rule 5). Each generated page's id is `list-<pageId>-<author or label id>`, where `<pageId>` is the `pageId` in the template's frontmatter:

```hbs
{{#Authors this true}}
<a href="pageid:list-<authors pageId>-{{ this.id }}">{{ fullName }}</a>
{{/Authors}}

{{#Labels this true}}
<a href="pageid:list-<topic pageId>-{{ this.id }}">{{ this.name }}</a>
{{/Labels}}
```

The recipe's `blog.hbs` is written before the page type exists, so it cannot know those ids and shows the author byline without a link. Once the recipe has run, read the `pageId` from `src/blog-authors.hbs` and wrap the byline in the link above if you want one.
