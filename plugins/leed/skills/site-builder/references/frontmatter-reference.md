# Page Frontmatter Reference

## CMS-Managed Pages (Read-Only)

Pages managed by the CMS have their frontmatter set automatically. You cannot modify these files. Their frontmatter looks like:

```json
{
  "pageId": "uuid",
  "pageTypeId": "type-id",
  "title": "Page Title",
  "slug": "url-slug",
  "summary": "Meta description text",
  "keywords": ["keyword1", "keyword2"],
  "authors": ["author-id-1"],
  "labels": ["label-id-1", "label-id-2"],
  "featureImage": {
    "assetId": "asset-id",
    "src": "/cdn-cgi/imagedelivery/hash/image-id/medium",
    "width": 1200,
    "height": 630,
    "alt": "Image description",
    "svg": false
  },
  "featureVideo": {
    "src": "cloudflare-video-id",
    "poster": "/cdn-cgi/imagedelivery/hash/poster-id/medium"
  },
  "publishedAt": "2025-01-15T10:30:00.000Z",
  "modifiedAt": "2025-02-20T14:00:00.000Z",
  "wordCount": 1500,
  "disableCTA": false,
  "disableAutolink": false,
  "previewOnly": false,
  "eleventyExcludeFromCollections": false,
  "aliases": ["/old-url/"],
  "formId": "form-uuid"
}
```

## Custom Pages (Editable — index.hbs, 404.hbs, etc.)

Custom pages you create must include frontmatter for the site to build correctly. Required fields:

### Minimum Required Frontmatter

```yaml
---
{
  "title": "Page Title",
  "pageTypeId": "root",
  "pageId": "unique-uuid-generated-for-this-page",
  "publishedAt": "2025-01-01T00:00:00.000Z"
}
---
```

### CRITICAL: Unique Page IDs

**Every page in the build MUST have a globally unique `pageId`.** Duplicate page IDs will cause the build to fail.

- Generate a new UUID v4 for every custom page you create
- Never reuse a pageId from another page
- Never use placeholder values like `"unique-uuid"` — always generate a real UUID

**Paginated pages get special constructed IDs (handled automatically by the build system):**

| Pagination Type | uniquePageId Format | Example |
|----------------|-------------------|---------|
| Single-layer (`:paged`) | `list-{pageId}-{pageNumber}` | `list-abc123-1`, `list-abc123-2`, `list-abc123` (last) |
| Double-layer (`:labels`, `:authors`) | `list-{pageId}-{layerName}-{pageNumber}` | `list-abc123-tutorials-1` |
| Non-paginated | `{pageId}` (unchanged) | `abc123` |

The build system computes `uniquePageId` automatically via `eleventyComputed.js` — you only need to provide a unique `pageId` in frontmatter. The system handles the rest for paginated collections.

**Root page type resolution:** If you use `"pageTypeId": "root"`, the build system maps this to the actual root page type entry in `pageTypeList.json` (the one with an empty slug `""` or legacy slug `"root"`).

### Full Custom Page Frontmatter

```yaml
---
{
  "title": "My Custom Page",
  "pageTypeId": "root",
  "pageId": "4fc0ce4c-36ab-44f3-80e3-7ce6a4e27d24",
  "publishedAt": "2025-01-01T00:00:00.000Z",
  "modifiedAt": "2025-06-15T12:00:00.000Z",
  "authors": ["author-id"],
  "keywords": ["seo", "keywords"],
  "summary": "Description for search engines and social cards",
  "featureImage": {
    "src": "/cdn-cgi/imagedelivery/hash/image-id/medium",
    "width": 1200,
    "height": 630,
    "alt": "Description"
  },
  "customField1": "any value",
  "customField2": ["array", "values"],
  "customData": {
    "nested": "objects work too"
  }
}
---
```

### Custom Frontmatter Fields

You can add any custom fields to frontmatter for use in your Handlebars templates. Common patterns:

```yaml
---
{
  "title": "Solutions Page",
  "pageTypeId": "root",
  "pageId": "uuid-here",
  "publishedAt": "2025-01-01T00:00:00.000Z",
  "heading": "Build Better Websites",
  "subtitle": "With the power of Leed CMS",
  "competitor": "WordPress",
  "heroButtonText": "Get Started",
  "comparison": {
    "matrix": {
      "Content Management": [
        { "name": "Visual Editor", "us": true, "them": "partial" },
        { "name": "Version Control", "us": true, "them": false }
      ]
    }
  },
  "testimonials": ["company-a", "company-b"],
  "items": [
    {
      "title": "Feature One",
      "description": "Description here",
      "icon": "fa-regular fa-star",
      "link": "/features/one/"
    }
  ]
}
---
```

Access custom fields in templates:
```hbs
<h1>{{ heading }}</h1>
<p>{{ subtitle }}</p>

{{#each items}}
  <div>
    <i class="{{ this.icon }}"></i>
    <h3>{{ this.title }}</h3>
    <p>{{ this.description }}</p>
  </div>
{{/each}}
```

## Global Data Available in Templates

These come from `_data/` (read-only) and are accessible via `@root`:

| Data | Access | Content |
|------|--------|---------|
| Site title | `{{ siteTitle }}` | Site name from identity |
| Site description | `{{ siteDescription }}` | Site description for SEO/footer |
| Site locale | `{{ siteLocale }}` | Locale code (e.g., `en-us`) |
| Date format | `{{ dateFormat }}` | Default date format string |
| Timezone | `{{ timezone }}` | IANA timezone (e.g., `America/New_York`) |
| Reading WPM | `{{ readingWpm }}` | Words per minute for reading time |
| Favicon | `{{ favicon }}` | Auto-included in `<head>` by `leed/head` — no need to reference directly. CMS-managed, max 100 KB |
| Logo | `{{ logo }}` | Admin/CMS use only — not recommended for templates (see note below). CMS-managed, max 100 KB |
| Page types | `{{ pageType uuid "field" }}` | Page type configurations |
| Users | `{{ user uuid "field" }}` | Author profiles |
| Labels | `{{ label uuid "field" }}` or `{{#with (label uuid)}}` | Content labels |
| Menus | `{{> leed/menu/builder menuName="name" }}` | Navigation structures |
| Forms | `{{> leed/form formId="id" }}` | Form definitions |
| CTAs | `data-leed-cta` on the element | Call-to-action content (Growth; `/leed:create cta`) |

## Company Configuration (`src.11tydata.json`)

This file contains company-level settings from the CMS. It is read-only but all fields are available as global template data. Key sections:

**Notes:**
- **Favicon** is automatically included in the `<head>` by the `leed/head` partial. You do not need to reference it in your templates.
- **Logo** (`{{ logo }}`) is primarily for CMS administrative purposes. Customers typically use multiple logos for different contexts (header, footer, light/dark mode, mobile, etc.), so we recommend placing logo images in `src/static/images/` and referencing them directly in your templates rather than using the `logo` field. Name those files anything but `favicon-*` or `logo-*`, which are reserved for the CMS.
- **Favicon, logo and documentation light/dark logos** are managed by the CMS: set them in Settings → General or with the MCP tool `upload_company_image` (page type documentation logos in the page type editor). Each is at most 100 KB and must be PNG, JPEG, GIF, WebP or SVG (`image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`).

### Auto-Handled Configuration (No Template Access Needed)

These fields exist in the config but are consumed automatically by the build system and `leed/head` — you do not need to reference them in templates:

- **`deployment`** — Used internally by shortcodes (`siteUrl`, `pagesUrl`, `turnstileKey`) to build URLs and configure Cloudflare services
- **`ogCard`** — Open Graph metadata is automatically included in `<head>` by the `leed/head` partial (title, description, image for social sharing)
- **`paging`** — Pagination size and minimum items are used automatically by the collections system (see `collections-and-lists.md`)
- **`favicon`** — Automatically included in `<head>` by `leed/head`

### External Accounts
Available for social links (used by `leed/docs/social-icons` automatically). You can also access these directly if building a custom footer:
```hbs
{{ externalAccounts.linkedinId }}
{{ externalAccounts.twitterId }}
{{ externalAccounts.blueskyId }}
{{ externalAccounts.discordInviteId }}
{{ externalAccounts.githubId }}
{{ externalAccounts.youtubeChannelId }}
{{ externalAccounts.facebookId }}
{{ externalAccounts.mastodonId }}
{{ externalAccounts.instagramId }}
{{ externalAccounts.tiktokId }}
{{ externalAccounts.twitchId }}
{{ externalAccounts.redditId }}
{{ externalAccounts.gitlabId }}
```

### Extended Configuration

The build loads the highlight.js grammar for every language a page's code blocks use that highlight.js's common bundle lacks, on that page only. No template or setting is needed. `extended.highlighter.extraLanguages` is only for a grammar the build cannot find on its own, such as one served from the site's own host; `extended.highlighter.enabledLanguages` sets the editor's code block dropdown and is unused by the build. Which language ids to write is under "Code block languages" in `leed-markdown-format.md`.

### Documentation Configuration (Documentation Sites Only)
For sites using the documentation layout system:
- `documentationConfiguration.layoutName` — Layout theme (`alpha`, `bravo`, `charlie`)
- `documentationConfiguration.colorTheme` — Color scheme class
- `documentationConfiguration.codeTheme` — Code highlighting theme
- `documentationConfiguration.font` — Font family
- `documentationConfiguration.header.button` — Header CTA button config
- `documentationConfiguration.logo.light` / `.dark` — Light/dark mode logos (CMS-managed: Settings → General or MCP `upload_company_image` for the company, the page type editor for a page type; max 100 KB each)
- `documentationConfiguration.startingPage` — Breadcrumb root page
- `documentationConfiguration.searchIndexId` — Search index ID
- `documentationConfiguration.tabGroups` — Tab icon/title configuration per group

#### Tab Groups
Tab groups allow customizing the appearance of tab panels in content. Each group maps tab names to display configuration:

```json
{
  "tabGroups": {
    "api-languages": {
      "curl": { "title": "cURL", "icon": "fa-solid fa-terminal" },
      "typescript": { "title": "TypeScript", "icon": "fa-brands fa-js" },
      "python": { "title": "Python", "icon": "fa-brands fa-python" }
    }
  }
}
```

When a `===tabs-container` in markdown has `data-tabs-groupId="api-languages"`, the tab labels are enriched with the configured icons and titles from the matching group.

## Page Types & Layouts

Each page type has a default layout configured in `pageTypeList.json` (managed by the CMS):

```json
{
  "100111": {
    "slug": "blog",
    "name": "Blog",
    "layout": "blog.hbs"
  }
}
```

When a page has a `pageTypeId`, it automatically uses that page type's default layout. The build system resolves this via `eleventyComputed.js` — you do not need to specify `layout` in frontmatter unless you want to override the default.

**Override the default layout** by setting `layout` explicitly in a page's frontmatter:

```yaml
---
{
  "pageTypeId": "100111",
  "layout": "custom-blog.hbs",
  ...
}
---
```

Setting `"layout": null` disables layout wrapping entirely (the page renders its own full HTML).

Custom pages using `"pageTypeId": "root"` typically define their layout via the template structure (using a block partial wrapper like `site-template`) since root pages don't have a default layout.

## Internal Page Links (ALWAYS use `pageid:`)

**ALWAYS use `pageid:UUID` format for links between pages in the site.** Never hardcode URL paths.

The build system resolves `pageid:` links to the correct URL at build time. If a page's path changes (slug rename, restructure, etc.), all `pageid:` links automatically update — zero broken links.

```hbs
{{!-- Basic internal link --}}
<a href="pageid:64f229a9-9043-4052-ad79-9274cf686649">Link Text</a>

{{!-- With query parameters --}}
<a href="pageid:64f229a9-9043-4052-ad79-9274cf686649?ref=hero&utm_source=homepage">Get Started</a>

{{!-- In buttons, CTAs, navigation --}}
<a href="pageid:64f229a9-9043-4052-ad79-9274cf686649" class="dark-button">
  Request a Demo
</a>
```

**Why not hardcode paths?**
- If `/blog/my-post/` moves to `/articles/my-post/`, hardcoded links break silently
- `pageid:` links always resolve to the current URL, even after changes
- The build system handles tracking automatically

**NEVER put UTM/urchin parameters on internal link URLs.** No `?utm_source=...` on `pageid:` or relative links. If tracking context is needed, use the `data-reason` attribute instead:

```hbs
{{!-- WRONG — never put UTM params on internal links --}}
<a href="pageid:UUID?utm_source=homepage&utm_medium=hero">Get Started</a>

{{!-- CORRECT — use data-reason for tracking context --}}
<a href="pageid:UUID"
   data-reason="utm_campaign=leed&utm_source=internal&utm_medium=hero&utm_term=get-started">
  Get Started
</a>
```

Query parameters on `pageid:` links are supported for functional purposes (e.g., `?ref=hero`), but UTM/urchin tags must always go in `data-reason`.

**Only use direct URLs for:**
- External links (other websites)
- Anchor links within the same page (`#section-id`)
- Static assets (`/static/images/...`)
