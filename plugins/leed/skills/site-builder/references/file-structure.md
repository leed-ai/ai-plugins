# Site Repository File Structure & Permissions

## Directory Layout

```
raw-content/
├── src/
│   ├── _layouts/              # ✅ EDITABLE — Handlebars layout templates
│   │   └── *.hbs
│   ├── _includes/             # ✅ EDITABLE — Handlebars partials (customer's own)
│   │   └── **/*.hbs
│   ├── _data/                 # 🔒 READ-ONLY — CMS-managed data files
│   │   ├── menu.json          # Navigation menus
│   │   ├── userList.json      # Author profiles
│   │   ├── labelList.json     # Content labels/tags
│   │   ├── pageTypeList.json  # Page type configurations
│   │   ├── leedForms.json     # Form definitions
│   │   └── autolink.json      # Auto-linking configuration
│   ├── static/                # ✅ EDITABLE — Static assets
│   │   ├── images/            # Images (max 500KB each, no favicon-* or logo-* — CMS-managed, max 100KB)
│   │   ├── js/                # Custom JavaScript
│   │   └── webfonts/          # WOFF2 fonts only
│   ├── {page-type-slug}/      # 🔒 CONTENT READ-ONLY — but .hbs files allowed
│   │   └── {slug}.md          # CMS-managed content (do not edit)
│   ├── index.hbs              # ✅ EDITABLE — Homepage
│   ├── 404.hbs                # ✅ EDITABLE — Error page
│   ├── robots.hbs             # ✅ EDITABLE — robots.txt template
│   └── src.11tydata.json      # 🔒 READ-ONLY — Root data
├── tailwind/                  # ✅ EDITABLE — Tailwind CSS configuration
│   ├── site.config.css        # Entry point (imports all partials)
│   └── **/*.css               # Custom CSS files
├── identity.json              # 🔒 READ-ONLY
├── buildResults.json          # 🔒 READ-ONLY — Build artifacts
├── package.json               # 🔒 READ-ONLY
├── README.md                  # 🔒 READ-ONLY
└── .gitlab-ci.yml             # 🔒 READ-ONLY
```

## What You CAN Edit

| Location | File Types | Purpose |
|----------|-----------|---------|
| `src/_layouts/` | `.hbs` | Page layout templates |
| `src/_includes/` | `.hbs` | Reusable partials and components |
| `src/index.hbs` | `.hbs` | Homepage |
| `src/404.hbs` | `.hbs` | 404 error page |
| `src/robots.hbs` | `.hbs` | robots.txt template |
| `src/*.hbs` | `.hbs` | New custom one-off pages |
| `src/static/images/` | Image files (<500KB) | Site images (not favicon/logo — those are CMS-managed, see below) |
| `src/static/js/` | `.js` | Custom JavaScript |
| `src/static/webfonts/` | `.woff2` only | Custom web fonts (rarely needed — see font auto-install) |
| `tailwind/` | `.css` | Tailwind CSS configuration and custom styles |

Leed's own templates under `src/_includes/leed/` are not editable, but several of them can be **ejected** — copied into your repo as an override you then own. Run `leed site eject` to see the full list with descriptions, destinations and whether you have already customized each one, then `leed site eject <name>` to take one over. See **Customer-Overridable Templates** in `references/handlebars-reference.md`.

## What You MUST NOT Create

- **NEVER create `.md` (Markdown) content files** — content is managed exclusively through the Leed CMS interface. The CMS writes content as `.md` files; you must not create or edit them.
- **NEVER create `.html` content files** — same reason; these are CMS-managed output.
- All customer-created pages should be `.hbs` (Handlebars) files only.

## What You CANNOT Edit

- **`src/_data/**/*`** — All JSON data files (managed by CMS)
- **Content files** (`.md`, `.html`) in page type directories — managed by CMS
- **`*.11tydata.json`** — Eleventy data files
- **`identity.json`** — Site identity
- **`README.md`** — Repository readme
- **`.gitlab-ci.yml`** — CI configuration
- **`src/static/images/favicon-*`** — Favicons
- **`src/static/images/logo-*`** — Logos

The favicon, the company logo and the documentation light/dark logos are managed by the CMS: set them in Settings → General or with the MCP tool `upload_company_image` (page type documentation logos in the page type editor). Each is at most 100 KB and must be PNG, JPEG, GIF, WebP or SVG (`image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`).

**Exception:** You CAN create `.hbs` (Handlebars) files inside page type directories. For example, creating `src/blog/custom-list.hbs` or `src/compare/index.hbs` is allowed. Only `.hbs` files are exempt from the protected path restriction.

### Temporary Edits During Development

During the design/development cycle, you MAY temporarily edit JSON data files (e.g., `_data/menu.json`, `_data/labelList.json`) to experiment with how changes will look in the local build. This is useful for:
- Testing a new menu structure before configuring it in the CMS
- Previewing how different labels or user profiles will render
- Adjusting form definitions to prototype a layout

**These changes MUST be reverted before committing.** The CLI will reject commits that modify data files. After previewing locally, make the real changes through the CMS interface, then pull the updated data files.

To revert temporary data changes:
```bash
git checkout -- src/_data/
```

## Disallowed File Types

These extensions are always rejected:
`mov`, `mpg`, `avi`, `mp4`, `mp3`, `wav`, `pdf`, `xls`, `xlsx`, `doc`, `docx`, `ppt`, `pptx`, `zip`, `ttf`, `ps`, `otf`

## File Size Limit

All files must be under **500KB**. Use Cloudflare image delivery for larger images.

## Protected System Files (Auto-Managed)

The build system copies these into your repo when the build/serve starts, and **automatically removes them when the build/server stops**. You do not need to manually reset them:
- `_includes/leed/**/*` — Leed system partials
- `leed-*.hbs` — System template files
- `leed-*-data.json` — System data files
- `tailwind-*.css` — System tailwind files
- `.leed/**` — Validation tracking

These files are ephemeral — they exist only during a build/serve session.

## 300-Line File Limit

All template files (`.hbs`) should stay under 300 lines. Break large templates into partials.

## Static Asset Caching

**All files in `src/static/` receive permanent `Cache-Control: immutable` headers** when served to browsers. This means once a browser downloads a static file (JS, CSS, image, font), it will never re-request it — it's cached forever.

**To update a cached resource**, append a version query string to the URL:

```hbs
{{!-- Version your static asset references --}}
<script type="module" src="/static/js/main.js?v=2"></script>
<img src="/static/images/hero.jpg?v=3" alt="Hero">
<link rel="stylesheet" href="/static/css/custom.css?v=1">
```

When you change the file content, increment the `?v=` value so browsers fetch the new version. Without a version bump, users will see the old cached file until their browser cache expires (which could be indefinitely).

**Tailwind CSS is automatically versioned** by the build system using content hashes — you do not need to manage this yourself.
