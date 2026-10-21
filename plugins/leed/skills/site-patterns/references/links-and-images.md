# Links and images

Details rules 5 and 6 in this skill's `SKILL.md`.

## Links

### The rule

Every internal link is `pageid:<uuid>`. The build resolves it against the pages it actually rendered and writes the real URL, so a link survives a renamed slug, a moved page or a changed page-type path.

```hbs
<a href="pageid:6934df26-d0b1-4cc2-b91a-d094e6f6d581">Home</a>
<a href="pageid:6934df26-d0b1-4cc2-b91a-d094e6f6d581?ref=hero#pricing">Pricing</a>   {{!-- query and hash survive --}}
```

A link whose target did not render is not left pointing at a 404: the build replaces the anchor with `<span class="page-removed">` holding the same text. That is the safety a path cannot give — a wrong path ships, a wrong `pageid:` degrades visibly.

### Links to a heading

Every heading on every page gets an `id` when the site builds, generated from the heading's text (levels 1 to 5; a `######` heading gets none and cannot be a target). It is not stored with the content, so **never create one**: a `{#custom-id}` or `{id="…"}` is read and dropped, an `<a id>` or `<a name>` placeholder is never needed, and a hand-made id on a heading cannot survive an edit to its text.

To link to a heading, slugify its text and add it as the fragment:

```markdown
See [Payment, tax and renewal](#payment-tax-and-renewal) below.
See [the terms](pageid:39e9c3c7-4741-432b-a49e-e59314f6d05d#payment-tax-and-renewal).
```

The slug is `@sindresorhus/slugify`'s, which does more than lower-case and hyphenate: `&` becomes `and`, camelCase is split, accents are transliterated, and a repeated heading gets `-1`, `-2`. The full table is in `../site-builder/references/leed-markdown-format.md` → Heading anchors. When the heading is not plain Latin words, render the page and read its `id` rather than guessing. A fragment that matches no heading still links, to the top of the page, so check it.

### Paginated indexes: `pageid:list-<id>`

A list page (a blog index, a topic archive) is generated from one template with one `pageId`, so each generated page gets a computed `uniquePageId` (see `uniquePageId` in `{appRoot}/static/site/_data/eleventyComputed.js`):

| Page | Link with |
|---|---|
| The index itself — the unsuffixed, newest page of a `:paged` list | `pageid:list-<pageId>` |
| A later page of it | `pageid:list-<pageId>-<n>` |
| One label's or author's page from a `:labels` or `:authors` list | `pageid:list-<pageId>-<labelId or userId>` |

`<pageId>` is the list template's own frontmatter `pageId` (an 8-character id). A blog post layout links back to its index with `href="pageid:list-<pageId>"`, using the blog list template's `pageId`.

A layout that loops over a page's labels can build that link from the label's id — inside `{{#Labels this true}}` the label's id is `this.id`:

```hbs
{{#Labels this true}}
<a href="pageid:list-890d4cc3-{{ this.id }}">{{ this.name }}</a>
{{/Labels}}
```

After the first build, check the output: an unresolved `pageid:` shows up as `page-removed`, never as a broken link.

### Tracking goes in `data-reason`, never the URL

```hbs
<a href="pageid:<uuid>" data-reason="utm_campaign=leed&utm_source=internal&utm_medium=hero&utm_term=get-started">Get started</a>
```

No `?utm_…` on an internal link. Leed's tracker reads `data-reason` on the click.

### Not internal

External sites, `#anchor` links on the same page, `mailto:`, and static files under `/static/` keep their real URLs.

### Anti-examples

- `href="/blog/"`, `href="/docs/getting-started/"` — paths break when a slug or a docs menu changes.
- `href="/{{ pageType pageTypeId 'slug' }}/topic/{{ this.slug }}/"` — a path assembled from slugs is still a path; use `pageid:list-<id>-<labelId>`.
- A `docs` frontmatter field holding `/docs/modules/auth/` — store `pageid:<uuid>` in frontmatter too.

## Images

### The rule

Asset-manager images are rendered with Leed's helpers, never with a hand-built URL:

| Helper | Use for | Size control |
|---|---|---|
| `{{#ImageTag imageRef}}…{{/ImageTag}}` | An image reference object (a frontmatter field, a menu item's image) | `sizes` — see below |
| `{{#FeatureImage}}…{{/FeatureImage}}` | The page's (or the loop item's) feature image | `sizes` |
| `{{#Image url "variant"}}…{{/Image}}` | A plain URL string, e.g. an author's `image` | The variant name |

Always size to **the widest the container can ever be**, not the widest the screen can be. A card in a three-column grid inside a `max-w-6xl` column can never be wider than about 384px, so shipping a 2560px image to it is pure waste on every page view — the cheapest performance win on most sites.

### The variants

| Variant | Max width × height |
|---|---|
| `small` | 320 × 240 |
| `medium` | 640 × 480 |
| `large` | 1280 × 720 |
| `xl` | 1920 × 1080 |
| `xxl` | 2560 × 1440 |
| `original` | 5120 × 2880 |
| `profile` | 400 × 400, cropped |
| `profiletiny` | 48 × 48, cropped |
| `social` | 800 × 418 |

Pick the smallest variant at least as wide as the container's maximum, allowing for high-density screens on large, prominent images: a card or thumbnail is `small` or `medium`, a content-column image `large`, a full-bleed hero `xl`. `xxl` is only for a genuinely full-width image on very large screens; `original` is for downloads, never for display. The full table, with fit modes, is in `../site-builder/references/handlebars-reference.md`.

### `ImageTag` and `FeatureImage`: cap with `sizes`

These two write the asset's own `width` and `height`, and the build then adds a `srcset` of every variant up to that width, with `sizes="100vw"` unless the template gave one. `100vw` tells the browser the image is as wide as the screen, so on a wide screen it downloads a huge variant for a small card. Tell it the truth with `sizes`, and cap the container in CSS so it holds:

```hbs
{{!-- A card in a 1/2/3-column grid inside max-w-6xl (72rem) --}}
<div class="max-w-6xl mx-auto grid gap-6 md:grid-cols-2 lg:grid-cols-3">
  {{#each list.pageData}}
  <a href="{{ this.url }}" class="card">
    {{#FeatureImage}}class="aspect-video w-full object-cover" sizes="(min-width: 1024px) 384px, (min-width: 768px) 50vw, 100vw" loading="lazy"{{/FeatureImage}}
  </a>
  {{/each}}
</div>
```

Do not try to cap with a `width="…"` in the block: the helper already wrote the asset's `width` first, and a duplicate attribute is ignored.

### `Image`: name the variant

`Image` emits a single `src` with no `srcset`, so the variant is the size:

```hbs
{{#Image image "profiletiny"}}class="h-8 w-8 rounded-full" alt="{{ fullName }}"{{/Image}}
```

### Recommendation cards

Cards cloned from `stub-template.hbs` take their size from `data-leed-variant` on the `featureImage` slot (`medium` when omitted). See `references/buttons-and-ctas.md`.

### SVGs

An SVG has no variants. `Image` always sets `data-responsiver="false"`; `ImageTag` and `FeatureImage` set it when the asset is an SVG. A raw `<img>` of a template-only SVG under `/static/` needs it written by hand.

### Anti-examples

- `{{#Image author.image "original"}}` for a 48px byline avatar.
- `{{#FeatureImage}}class="h-48 object-cover"{{/FeatureImage}}` in a card grid with no `sizes` — every card downloads a screen-wide image.
- `<img src="https://<your-site>/cdn-cgi/imagedelivery/<account-hash>/<image-id>/xxl">` written by hand, without `data-assetid`, so the CMS cannot track the asset.
