# Collections and loops

Details rules 7 and 11 in this skill's `SKILL.md`: lists of pages always come from a Leed collection, never from filtering by hand or in JavaScript; and the Handlebars names that bite inside loops.

## The collections

The build makes these for every page type. Name the page type by **id**, never by slug: an id never changes, a slug can be renamed in the CMS.

| Collection | What it holds | Use |
|---|---|---|
| `collections.pageTypeId-X:paged` | The type's pages, chunked into pages of the CMS paging size | The main index (`pagination.data`) |
| `collections.pageTypeId-X:unpaged` | The type's pages, one flat list, generated list pages excluded | A "show all" page, a grid of every item |
| `collections.pageTypeId-X:labels` | One paged group per label used by the type | Label (topic) archive pages |
| `collections.pageTypeId-X:authors` | One group per author, all on one page | Author pages |
| `(collection "pageTypeId-X:labelId-Y")` | The type's pages that carry label `Y` | A section listing one topic |
| `(collection "pageTypeId-X")` | Every page of the type, generated list pages included | Rarely — prefer `:unpaged` |

Sort with `sorted`, never by hand: `{{#each (sorted (collection "pageTypeId-X") "data.title")}}`, with `reverse=true` for descending. The build's own order is published date, then URL.

The full list, the `PageData` shape and the pagination frontmatter are in `../site-builder/references/collections-and-lists.md`. Working examples ship with the CLI and the plugin: `{appRoot}/static/templates/pages/PAGE_TYPE_INDEX.hbs` (`:paged`), the blog recipe's `../../recipes/blog/files/features/labels/blog-topic-index.hbs` (`:labels`) and `../../recipes/blog/files/features/authors/blog-authors.hbs` (`:authors`), and `{appRoot}/static/templates/pages/PAGINATED_PAGE_TYPE_LIST.hbs` (`:unpaged`, one page per item).

## Never filter by hand

```hbs
{{!-- WRONG: every page on the site, filtered in the template --}}
{{#each collections.all}}
  {{#eq this.data.pageTypeId "hpimcj"}} … {{/eq}}
{{/each}}

{{!-- RIGHT: the collection is already that selection --}}
{{#each collections.[pageTypeId-hpimcj:unpaged]}} … {{/each}}
{{#each (collection "pageTypeId-hpimcj:labelId-hyi187")}} … {{/each}}   {{!-- and with one label --}}
```

Hand filtering is slow on a large site, misses the build's own rules (generated list pages excluded, invisible labels skipped, the deterministic order), and silently returns less when a field name changes. Filtering in JavaScript is worse: the page ships every item and search engines see the unfiltered list.

Presentation in JavaScript is fine. A filter bar that hides cards the reader did not ask for — with every card rendered and visible when JavaScript is off — selects nothing; the collection did the selecting.

## When a custom loop is justified

A custom loop is allowed only when the selection depends on something the built-in collections cannot express. Then the template **must carry a comment saying why**, so the next person does not "fix" it back into a collection that cannot do the job.

The canonical case is a module grid whose filter chips are a chosen, ordered subset of labels, named by id in the current page's own frontmatter. No collection selects labels by ids taken from the page it is rendered in, and `labelList.json` also holds asset labels and the CMS's locked labels, so looping over every label would be wrong. The cards still come from a collection.

```hbs
{{!--
  The chips come from `filterLabels` in this page's frontmatter: label ids, in display order.
  A custom loop, because no built-in collection selects labels by ids listed on the current
  page, and labelList also holds asset and locked labels that do not describe a module.
--}}
{{#each filterLabels}}
{{#with (lookup ../labelList this)}}
<button type="button" class="filter-chip" data-filter="{{ ../this }}">{{ this.name }}</button>
{{/with}}
{{/each}}

{{!-- The cards are a collection, named by page-type id. --}}
{{#each (sorted (collection "pageTypeId-hpimcj:unpaged") "data.title")}}
<a href="{{ this.url }}" class="card" data-labels="{{#each this.data.labels}}{{ this }} {{/each}}">{{ this.data.title }}</a>
{{/each}}
```

Other legitimate cases have the same shape — the selection is data on the current page, such as an ordered list of label ids an editor curates in frontmatter. A series is not one of them: it has its own helpers (`Series`, `MultipartSeries`, `AnnouncementSeries`). If the selection can be said as "pages of type X" or "pages of type X with label Y", it is a collection and a custom loop is not justified.

## Handlebars names that collide with helpers

`label`, `user` and `pageType` are global helpers (lookups into `labelList`, `userList` and `pageTypeList`). Inside a loop or a `with` block, a bare name resolves to the helper before the field, so the field renders empty or wrong:

```hbs
{{#each items}}
  {{ label }}         {{!-- WRONG: calls the label helper with no arguments, renders empty --}}
  {{ this.label }}    {{!-- RIGHT --}}
{{/each}}
```

Write `this.<field>` for any field whose name might be a helper. The helpers themselves are called with arguments: `{{ label list.name 'name' }}` in the blog recipe's `../../recipes/blog/files/features/labels/blog-topic-index.hbs` is the `label` helper looking up a label by id.

Watch `../` too: `{{#each}}` and `{{#with}}` each push a context, so a parent field needs one `../` per level, and `@root` reaches the page itself (`@root/list.pageData`).

## Whitespace-sensitive partials at column 0

A partial that renders a `<pre>` (a site's own `code-block`, an ASCII diagram) emits its body verbatim. Handlebars indents a partial's output by the indentation of the call, so an indented call shifts every line of the code:

```hbs
<div class="example">
{{> code-block language="bash" code=installCommand }}
</div>
```

Keep the `{{> code-block}}` call — and any partial whose output is preformatted — at column 0, even inside indented markup.
