# Template Patterns & Best Practices

Real-world patterns from the Leed reference implementation. The rules these patterns follow — menus, links, images, collections, theming — are in `../site-patterns/SKILL.md`.

## Master Site Template Pattern

Every custom site should have a master wrapper partial that all pages use:

```hbs
{{!-- src/_includes/site-template.hbs --}}
<!DOCTYPE html>
<html class="scroll-smooth font-noto-sans">
  <head>
    <title>{{ title }} | {{ siteTitle }}</title>
    {{!-- leed/head opens with src/_includes/header-includes.hbs. Site-wide head tags
          (fonts, verification, analytics, theme-color) go there, not here:
          documentation pages never render this template. --}}
    {{> leed/head }}
  </head>
  <body class="flex flex-col h-screen antialiased text-(--site-text-color) bg-(--site-bg-color)">
    {{> header }}
    <div class="grow mt-(--height-header)">
      {{> @partial-block }}
    </div>
    {{> footer }}
    <script type="module" src="/static/js/main.js"></script>
  </body>
</html>
```

**Site-wide `<head>` tags go in `header-includes.hbs`, not here.** Documentation and API pages render through Leed's own layout, which calls `leed/head` but not `site-template.hbs`, so a font link, verification meta or analytics script written above reaches every page except the docs. `leed/head` renders `src/_includes/header-includes.hbs` first in `<head>` on all of them (site-patterns rule 14):

```hbs
{{!-- src/_includes/header-includes.hbs --}}
<meta name="theme-color" media="(prefers-color-scheme: light)" content="<--brand-bg, light>">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="<--brand-bg, dark>">
<meta name="google-site-verification" content="<token>">
<script defer src="https://<analytics host>/script.js"></script>
```

A tag only one page type needs stays in that page type's layout.

**Usage in pages/layouts:**
```hbs
{{#> site-template scrollBarId="blog-copy" }}
  <main>
    {{{ process content }}}
  </main>
{{/site-template}}
```

## Layout Patterns

### Blog Layout
```hbs
{{#> site-template }}
<article class="max-w-4xl mx-auto px-4 py-12">
  {{!-- Labels --}}
  <div class="flex gap-2 mb-4">
    {{!-- Each label links to its archive page: list-<label index pageId>-<label id> --}}
    {{#Labels this true}}
    <a href="pageid:list-890d4cc3-{{ this.id }}"
       class="text-xs px-2 py-1 rounded-full bg-secondary">
      {{ this.name }}
    </a>
    {{/Labels}}
  </div>

  <h1 class="text-4xl font-bold mb-4">{{ title }}</h1>

  {{!-- Author byline --}}
  <div class="flex items-center gap-3 mb-8">
    {{#Authors this true}}
    <div class="flex items-center gap-2">
      {{#Image image "profiletiny"}}
        class="w-8 h-8 rounded-full"
        alt="Profile picture of {{ fullName }}"
      {{/Image}}
      <span>{{ fullName }}</span>
    </div>
    {{/Authors}}
    <time datetime="{{#date 'iso'}}{{ publishedAt }}{{/date}}">
      {{#date "MMMM D, YYYY" this}}{{ publishedAt }}{{/date}}
    </time>
    {{#if wordCount}}
    <span>{{ readingTime }} min read</span>
    {{/if}}
  </div>

  {{!-- Feature image --}}
  {{!-- The article column is max-w-4xl (56rem), so the image is never wider than 896px --}}
  {{#if featureImage}}
  <div class="mb-8">
    {{#FeatureImage}}class="w-full h-auto rounded-lg" sizes="(min-width: 56rem) 896px, 100vw"{{/FeatureImage}}
  </div>
  {{/if}}

  {{!-- Content --}}
  <section id="content">
    {{{ process content }}}
  </section>

  {{!-- CTA and Recommendations: Growth features, added by /leed:create cta and /leed:create recommendations --}}
  <div data-leed-cta></div>
  <div data-leed-recommendations></div>
</article>
{{/site-template}}
```

### Content List Layout (Paginated)
```hbs
{{#> site-template }}
<div class="max-w-6xl mx-auto px-4 py-12">
  <h1 class="text-3xl font-bold mb-8">{{ title }}</h1>

  <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
    {{#each (reverse @root/list.pageData) }}
    <a href="{{ this.url }}" class="group">
      <div class="h-48">
        {{!-- A third of max-w-6xl at most: tell the browser, or it fetches a screen-wide image --}}
        {{#FeatureImage}}class="h-48 w-full rounded-t-lg object-cover" sizes="(min-width: 1024px) 384px, (min-width: 768px) 50vw, 100vw" loading="lazy"{{/FeatureImage}}
      </div>
      <div class="p-4">
        {{#Labels this true}}
        <span class="text-xs px-2 py-1 rounded-full bg-secondary">{{ this.name }}</span>
        {{/Labels}}
        <h3 class="text-lg font-semibold group-hover:text-primary">{{ this.data.title }}</h3>
        <p class="text-sm text-muted-foreground line-clamp-2">{{ this.data.summary }}</p>
        <time class="text-sm text-muted-foreground"
              datetime="{{#date 'iso'}}{{ this.data.publishedAt }}{{/date}}">
          {{#date "MMMM D, YYYY" this}}{{ this.data.publishedAt }}{{/date}}
        </time>
      </div>
    </a>
    {{/each}}
  </div>

  {{!-- Pagination: Leed's component, which hides itself on a single page --}}
  {{> leed/components/pagination }}
</div>
{{/site-template}}
```

## Component Patterns

### Card Grid with Custom Data
```hbs
{{!-- Define data in frontmatter, render with each --}}
<div class="grid md:grid-cols-3 gap-6">
  {{#each items}}
  <div class="p-6 rounded-2xl border border-border bg-card">
    <div class="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
      <i class="{{ this.icon }} text-2xl"></i>
    </div>
    <h3 class="text-xl font-semibold mb-2">{{ this.title }}</h3>
    <p class="text-muted-foreground">{{ this.description }}</p>
    {{#if this.link}}
    <a href="{{ this.link }}" class="text-primary mt-4 inline-flex items-center gap-1">
      Learn more <i class="fa-solid fa-arrow-right"></i>
    </a>
    {{/if}}
  </div>
  {{/each}}
</div>
```

### Inline Partial for Reusable Elements

The tinted grounds below are muted brand tokens (see `../site-patterns/references/theming.md`), not opacity modifiers such as `bg-(--site-primary-color)/20`: Tailwind compiles those to `color-mix()`, whose fallback is the solid color, so the icon vanishes into its own background in a browser without `color-mix`.

```hbs
{{#*inline "featureEntry"}}
<div class="flex justify-center">
  {{#if (eq value true)}}
  <div class="w-8 h-8 rounded-full bg-(--brand-accent-muted) text-(--brand-accent) flex items-center justify-center">
    <i class="fa-solid fa-check text-sm"></i>
  </div>
  {{else if (eq value "partial")}}
  <div class="w-8 h-8 rounded-full bg-(--brand-surface-muted) text-fg-muted flex items-center justify-center">
    <i class="fa-solid fa-minus text-sm"></i>
  </div>
  {{else}}
  <div class="w-8 h-8 rounded-full bg-(--brand-surface-muted) text-fg-muted flex items-center justify-center">
    <i class="fa-solid fa-xmark text-sm"></i>
  </div>
  {{/if}}
</div>
{{/inline}}

{{!-- Usage --}}
{{> featureEntry value=true}}
{{> featureEntry value="partial"}}
{{> featureEntry value=false}}
```

### Dynamic Partial Loading
```hbs
{{!-- Load partials based on data --}}
{{#each testimonials}}
  {{> (concat "block/testimonials/" this) }}
{{/each}}
```

### Conditional Wrapper (Link or Div)
```hbs
{{#if href}}
<a class="group card" href="{{ href }}">
{{else}}
<div class="card">
{{/if}}
  <h3>{{ title }}</h3>
  <p>{{ description }}</p>
{{#if href}}</a>{{else}}</div>{{/if}}
```

## Navigation Pattern

### Header with Menu Builder

One builder renders the navigation for every screen size. Below the breakpoint CSS turns the same list into the drawer, and Alpine only opens and closes it. `menuName` is the menu's name as keyed in `src/_data/menu.json` — read it from there.

```hbs
{{!-- src/_includes/header.hbs --}}
<header id="menu-container" x-data="{ open: false }"
        class="fixed top-0 z-40 w-full border-b border-(--site-border-color) bg-(--site-bg-color)">
  <div class="max-w-7xl mx-auto px-4 flex items-center justify-between py-3">

    {{!-- Logo: the home page by pageid, never "/" --}}
    <a href="pageid:6934df26-d0b1-4cc2-b91a-d094e6f6d581">
      <img src="/static/images/logo.svg" alt="{{ siteTitle }}" class="h-10" data-responsiver="false" />
    </a>

    {{!-- Drawer toggle, below the breakpoint only --}}
    <button type="button" @click="open = !open" class="lg:hidden" :aria-expanded="open" aria-controls="site-nav">
      <i class="fa-solid" :class="open ? 'leed-icon-close' : 'leed-icon-menu'"></i>
    </button>

    {{!-- ONE builder: the bar on desktop, the drawer on mobile --}}
    <nav id="site-nav" class="site-nav" :class="{ 'is-open': open }" aria-label="Main">
      {{> leed/menu/builder menuName="Header Menu" menuClass="menu-top" submenuClass="menu-top-submenu" }}
    </nav>
  </div>
</header>
```

```css
/* tailwind/partials/menu.css, imported into layer(components) */
.menu-top { @apply flex items-center gap-6; }
.menu-top > li > .leed-menu__item--wrapper { color: var(--site-text-color); }

@media (max-width: 1023px) {
  .site-nav { @apply hidden absolute inset-x-0 top-full bg-(--site-bg-color) p-4; }
  .site-nav.is-open { @apply block; }
  .menu-top { @apply flex-col items-stretch gap-0; }
  .menu-top-submenu { @apply static pl-3; }
}
```

The fixed header needs its height measured into `--height-header` for the body offset; see `../site-patterns/references/css-layers.md`.

### Footer with Menu
```hbs
{{!-- src/_includes/footer.hbs --}}
<footer class="border-t border-(--site-border-color) py-12">
  <div class="max-w-6xl mx-auto px-4 grid md:grid-cols-4 gap-8">
    {{> leed/menu/builder menuName="Footer Menu" menuClass="menu-bottom" }}
  </div>
  <div class="max-w-6xl mx-auto px-4 mt-8 text-sm text-muted-foreground">
    &copy; {{ siteTitle }}. All rights reserved.
  </div>
</footer>
```

Footer columns open by default through the menu's own `expanded` flag (`leed settings menu set-menu <menuId> --base-revision <rev> --expanded true`), not through a builder param; see `../site-patterns/references/menus.md`.

## Form Integration Pattern

```hbs
{{!-- In a layout or page --}}
<section class="py-16 bg-muted/30">
  <div class="max-w-md mx-auto">
    <h2 class="text-2xl font-bold mb-6">Get in Touch</h2>
    {{> leed/form formId="72339fba" }}
  </div>
</section>

{{!-- Or with custom heading --}}
{{> leed/form formId="6d126e8e" heading="Subscribe to Our Newsletter" }}
```

## Series Navigation Pattern

```hbs
{{!-- For multipart series (tutorials, guides) --}}
{{#each this.labels}}
{{#with (label this)}}
{{#IfMultipartSeries this}}
<nav class="border rounded-lg p-6 my-8">
  <p class="font-bold mb-2">{{ this.name }}</p>
  <p class="text-sm text-muted-foreground mb-4">{{ this.description }}</p>
  <ol class="space-y-1">
    {{#Series ../this}}
    {{#eq this.data.page.url ../../../page.url}}
    <li class="font-bold">{{ this.data.title }}</li>
    {{else}}
    <li><a href="{{ this.data.page.url }}">{{ this.data.title }}</a></li>
    {{/eq}}
    {{/Series}}
  </ol>
</nav>
{{/IfMultipartSeries}}
{{/with}}
{{/each}}
```

## Analytics & Event Tracking

The Leed build system automatically includes an event tracker on every page. It captures clicks, page views, scroll depth, media playback, and time-on-page. You enhance tracking by adding `data-id` and `data-reason` attributes to your template elements.

### `data-id` — Element Identification for Tracking

Add `data-id` to any element you want to track for **click attribution** and **scroll depth / visibility**. The value of `data-id` must always be a **UUID**.

**Click tracking:** When a user clicks an `<a>` or `<button>`, the tracker looks for a `data-id` on the clicked element or its parent. This identifies *what* was clicked.

**Scroll depth / visibility:** The tracker observes elements with `data-id` and reports when they reach 0%, 50%, and 100% visibility in the viewport. Elements inside `<header>` or `<footer>` are excluded.

**Tracked element types:**
- Content: `p`, `ul`, `ol`, `blockquote`, `pre`, `img`, `iframe`, `audio`
- Headings: `h1`, `h2`, `h3`, `h4`, `h5`, `h6`
- Markdown blocks: `aside` (alerts), `details` (collapsibles), `figure` (captioned images), `table`
- Template structure: `section`
- Leed components: `div.leed-tabs__container` (tab panels), `div[name="cta"]` (dynamic CTA containers)

```hbs
{{!-- Track visibility of a hero section --}}
<section data-id="a1b2c3d4-e5f6-7890-abcd-ef1234567890">
  <h1>Welcome</h1>
</section>

{{!-- Track which CTA button was clicked --}}
<a href="pageid:UUID" data-id="b2c3d4e5-f6a7-8901-bcde-f12345678901" class="dark-button">
  Get Started
</a>

{{!-- Track visibility of a feature grid --}}
<section data-id="c3d4e5f6-a7b8-9012-cdef-123456789012" class="grid md:grid-cols-3 gap-6">
  {{#each items}}
  <div>{{ this.title }}</div>
  {{/each}}
</section>

{{!-- Track visibility of the recommendation widget (but NOT individual cards, which are dynamic) --}}
<section data-leed-recommendations data-id="d4e5f6a7-b8c9-0123-defa-234567890123">
  <h2>Read next</h2>
</section>
```

**When to use `data-id`:**
- Static content sections you want scroll depth analytics on (hero, features, pricing, testimonials)
- Important buttons and CTAs for click attribution
- Container elements around dynamic content (recommendations, CTAs) — but not the dynamic items themselves
- Any element where you want to answer "did users see this?" or "did users click this?"

**When NOT to use `data-id`:**
- On every element (adds noise — be selective)
- On dynamically injected content (recommendations, CTA content) — track the container instead
- On navigation menu items (the menu builder handles UTM tracking automatically)

### `data-reason` — Click Context / UTM Parameters

Add `data-reason` to links and buttons to capture **why** a click happened — typically UTM parameters for attribution.

**Always use `utm_campaign=leed`** for all internal tracking. This is the standard campaign value that buckets all internal website interactions (autolinks, menus, recommendations, custom features) into a single campaign for analytics breakdowns. The `utm_medium` distinguishes the specific feature.

```hbs
{{!-- Track a hero CTA --}}
<a href="pageid:UUID"
   data-reason="utm_campaign=leed&utm_source=internal&utm_medium=hero&utm_term=get-started">
  Get Started
</a>

{{!-- Track a custom footer link --}}
<a href="pageid:UUID"
   data-reason="utm_campaign=leed&utm_source=internal&utm_medium=footer&utm_term=about">
  About Us
</a>
```

**Standard `data-reason` format (preferred ordering):**
- `utm_campaign=leed` — always `leed` for all internal tracking
- `utm_source={source}` — `internal` for content links, `menu` for navigation elements
- `utm_medium={feature}` — what feature area: `hero`, `footer`, `sidebar`, `demo`, `cta`, etc.
- `utm_term={identifier}` — specific item clicked (button name, demo name, etc.)
- `utm_content={text}` — optional, the visible text of the link (auto-added by some system features)

**System-managed `data-reason` tracking (automatic — do not replicate):**

Preferred field ordering: `utm_campaign, utm_source, utm_medium, utm_term, utm_content`

| Feature | utm_campaign | utm_source | utm_medium | utm_term | utm_content |
|---------|-------------|-----------|-----------|---------|------------|
| Menu links | `leed` | `menu` | `{menuName}` | `{menuItemId}[-{instance}]` | `{item name}` |
| Autolinks | `leed` | `internal` | `autolink` | — | `{matched text}` |
| Dynamic CTAs | `leed` | `internal` | `cta` | `{ctaId}` | `{link text}` |
| Recommendations (stubs) | `leed` | `internal` | `recommendation` | `{pageId}` | `{link text}` |
| Docs header logo/CTA | `leed` | `menu` | `header` | — | — |
| Docs footer logo | `leed` | `menu` | `footer` | — | — |

**Menu tracking detail:** For menus, `utm_source=menu` identifies this as a menu interaction, while `utm_medium` captures the specific menu name (e.g., `Header Menu`, `Footer Menu`). This is important because the same menu can be used in multiple locations — `utm_medium` tells you which instance was clicked. When an `instance` parameter is passed to the menu builder, it's appended to `utm_term` (e.g., `{menuItemId}-{instance}`) to further disambiguate.

You only need to add `data-reason` manually for links in your custom templates (hero buttons, inline CTAs, promotional sections, custom navigation).

### Interactive Tracking Pattern: Alpine.js + Static Data Attributes

For pages where Alpine.js dynamically shows/hides content (tabs, demos, interactive showcases), the tracking attributes should remain static in the HTML while Alpine controls visibility:

```hbs
{{!-- Demo selector with Alpine state --}}
<div x-data="{ selectedDemo: '', iframeSrc: '' }">

  {{!-- Dropdown toggle — data-id tracks clicks on the control --}}
  <button data-id="ca3b6147-8fb8-4c6c-ad77-fb635e2e661f"
          @click="open = !open"
          class="demo-selector">
    Select a Demo
  </button>

  {{!-- Each demo option — data-reason disambiguates WHICH item was selected --}}
  {{#each demos}}
  <div x-show="selectedDemo === '{{ this.name }}'">
    <a href="javascript:void(0);"
       @click="loadDemo('{{ this.name }}')"
       data-id="aca639a7-c0ae-4b65-9b57-cd4a212284c9"
       data-reason="{{ concat 'utm_source=internal&utm_medium=demo&utm_campaign=leed&utm_term=' this.name }}">
      <i class="fa-solid fa-play"></i> Start Demo
    </a>
  </div>
  {{/each}}
</div>
```

**Key principles for interactive tracking:**

1. **Place `data-id` on the action trigger** (button/link), not on the container that shows/hides
2. **Use `data-reason` with dynamic `utm_term`** to disambiguate which item in a set was clicked — a single `data-id` can serve multiple items when `data-reason` captures the specific selection
3. **Use `x-show` (not `x-if`) for tracked elements** — `x-show` hides via CSS but keeps the element in the DOM, so tracking stays attached. `x-if` removes the element entirely, breaking tracker listeners.
4. **Keep `data-*` attributes static** — don't modify them via Alpine bindings. Let Alpine's visibility state control when tracking fires; the attributes themselves are authored at template time.

## Auto-Loaded JavaScript Libraries

The `leed/head` partial automatically includes these scripts on every page:

**Always loaded:**
- Alpine.js 3.15.0 (interactivity)
- js-cookie 3.0.5 (cookie management)
- Leed tracker (whisper.js — analytics events)
- Leed utilities (forms, CTA, recommendations, autofill)
- Fingerprint JS (device identification)
- Privacy JS (consent management)
- Timer JS (time-on-page tracking)
- Documentation JS (docs navigation)
- Search JS (Lunr search)
- Zoomable JS (image zoom on click)

**Conditionally loaded at build time** (only when the rendered page contains matching content):

| Content Detected | Scripts Added |
|-----------------|---------------|
| `<pre><code>` (code blocks) | Syntax highlighting (highlight.js) |
| `<code class="math">` (math) | KaTeX rendering |
| `<pre class="mermaid">` (diagrams) | Mermaid rendering |
| `iframe[data-cloudflare-video]` (video) | Cloudflare Stream player |
| `#document-search` element (search) | Search index and UI |

You do not need to manually add `<script>` tags for any of these — the build detects content and includes the appropriate libraries automatically.
