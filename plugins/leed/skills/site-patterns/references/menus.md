# Menus

Details rule 1 in this skill's `SKILL.md`: always `leed/menu/builder`, one builder for desktop and mobile, styled in CSS. Never hand-write nav links.

## Why

A menu is a CMS record. Editors add, reorder and retarget its items in the CMS, and the builder renders whatever the CMS holds. The builder also does work a hand-written list does not:

- it drops an item whose `pageid:` target is unpublished, and a folder whose children are all hidden, so a menu never links to a 404;
- it puts tracking context on every link in `data-reason` (`utm_campaign=leed&utm_source=menu&utm_medium=<menuName>…`), never in the `href`;
- it emits the ARIA state (`aria-haspopup`, `aria-expanded`, `aria-controls`, `aria-hidden`) a drawer or dropdown needs.

A second hand-written list — or a second builder for the mobile drawer — is a copy that drifts the first time an editor changes the menu.

## The call

```hbs
{{> leed/menu/builder menuName="Header Menu" menuClass="menu-top" submenuClass="menu-top-submenu" }}
```

| Param | Required | What it does |
|---|---|---|
| `menuName` | Yes | The menu's **name** in the CMS — the key in `src/_data/menu.json`. Case-sensitive; spaces are allowed (`"Header Menu"`). Read the real name from `menu.json`; never guess `"top"` |
| `menuClass` | No | Extra class on the top `<ul>` |
| `submenuClass` | No | Extra class on **every** submenu `<ul>`, at every level |
| `onClick` | No | Raw attribute text added to each link |
| `instance` | No | Appended to `utm_term`, to tell two placements of the same menu apart |

There is no working `expanded` param. The partial's header lists one, but the builder reads `expanded` inside `{{#with (lookup menu menuName)}}`, so it gets the **menu record's** flag and ignores anything passed in the call. Open state is set in the CMS (see Footers).

## What it emits

Style these. Do not invent others; they are the whole surface.

| Class or attribute | On |
|---|---|
| `leed-menu`, `leed-menu-<menuName>` | The top `<ul>` (the second carries the menu name verbatim; a name with spaces such as `"Header Menu"` splits into several classes, so target `.leed-menu` from a wrapper instead) |
| `leed-menu__item` | A top-level `<li>` |
| `leed-submenu`, `leed-submenu--level-N` | A submenu `<ul>`; `N` starts at 1 |
| `leed-submenu__item` | An `<li>` inside a submenu |
| `leed-menu__item--wrapper` | The `<a>` or `<div>` inside every item |
| `leed-menu__item--link` / `leed-submenu__item--link` | The wrapper when it is a real link |
| `leed-menu__item--no-link` / `leed-submenu__item--no-link` | The wrapper when the item has no renderable `href` (a section heading, or a target that is unpublished) |
| `leed-menu__item--image` | Wraps the item's image (rendered with `ImageTag`) |
| `leed-menu__item--text` | Wraps icon, name and toggle |
| `leed-menu__item--icon` | The item's icon `<i>` |
| `leed-menu__item--name` | The item's label |
| `leed-menu__item--leave` | An empty `<i>` after the name when the item opens in a new tab |
| `leed-menu__item--toggle` | An empty `<i>` on an item with children — style it as the chevron |
| `leed-menu__item--description` | The item's description |
| `data-expanded`, `aria-expanded`, `aria-haspopup`, `aria-controls`, `data-submenu-id` | On an `<li>` with children |
| `aria-hidden` | On a submenu `<ul>` when it renders open |

The full markup is in `{appRoot}/static/site/_includes/leed/menu/builder.hbs`, `item.hbs` and `link.hbs`.

## One builder, two shapes

The bar and the drawer are the same `<ul>`. CSS changes its shape at a breakpoint; a script toggles one class or attribute on a wrapper to open the drawer.

```hbs
{{!-- One builder. The drawer is this same list below the breakpoint. --}}
<button type="button" class="menu-btn" data-menu-toggle aria-expanded="false" aria-controls="site-nav">
  <i class="fa-solid leed-icon-menu" aria-hidden="true"></i>
</button>
<div class="nav-right" id="site-nav" data-menu>
  <nav aria-label="Main">
    {{> leed/menu/builder menuName="Header Menu" menuClass="menu-top" submenuClass="menu-top-submenu" }}
  </nav>
</div>
```

```css
/* tailwind/partials/menu.css, imported into layer(components) */
.menu-top { @apply flex items-center gap-7; }
.menu-top > li > .leed-menu__item--wrapper { color: var(--brand-fg-muted); }
.menu-top-submenu { @apply absolute grid gap-1 p-3; background: var(--brand-surface); }

@media (max-width: 767px) {
  .menu-top { @apply flex-col items-stretch gap-0; }
  .menu-top-submenu { @apply static block p-0 pl-3; }
}
```

Leed's own `{appRoot}/static/site/_includes/leed/docs/docs-header.hbs` is this pattern, and its header comment states the rule. A site's own marketing header should be built the same way.

Two traps worth knowing:

- **Submenus render open until the site's own menu script closes them.** Leed's menu partials emit every submenu in the markup and ship no script for marketing headers, so if your deferred script is what collapses the dropdowns, an absolutely-positioned dropdown paints for a frame before it runs. Leed adds no ready class for you: if you guard with one, your script must set it as the last thing it does, e.g. `document.getElementById('menu-container').classList.add('menus-ready');`, paired with `#menu-container:not(.menus-ready) .leed-submenu--level-1 { display: none; }`. Without that line the guard keeps the desktop dropdowns hidden for good. A CSS-only dropdown (`:hover`/`:focus-within`) needs no guard at all.
- **`submenuClass` applies at every level.** A level-2 list inside a dropdown arrives with the same class as the dropdown. Scope nested rules with `.leed-submenu--level-2`, or with `:has(> li > .leed-submenu--level-2)` on the parent panel, so a rule for one panel does not reshape the rest.

## Footers

A footer usually shows every column open. That is the menu's own `expanded` flag, set in the CMS, not a param on the builder call (`expanded=true` in the call is silently ignored):

```bash
leed settings menu create --name "Footer Menu" --expanded true
# or, on an existing menu:
leed settings menu set-menu <menuId> --base-revision <rev> --expanded true
```

Publish the change with `leed settings publish`. With the flag set, every item renders `data-expanded="true"`, `aria-expanded="true"` and its submenu `aria-hidden="false"`. To open only some columns, set the flag on those items instead (`leed settings menu set <menuId> <menuItemId> --base-revision <rev> --expanded true`). The template stays plain:

```hbs
{{> leed/menu/builder menuName="Footer Menu" menuClass="menu-bottom" submenuClass="menu-bottom-submenu" }}
```

## Creating and changing a menu

Menus live in the CMS. Use the `/site-settings` skill:

- `leed settings menu create --name "Header Menu"` makes an empty menu and returns `data.menuId` and `data.revision`;
- `leed settings menu add <menuId> --base-revision <rev> ...` adds items one at a time, with `pageid:` targets. An item's `name` is its label; its `title` is only a hover tooltip (the link's `title` attribute), so leave it unset unless the user wants a tooltip;
- `leed settings publish` sends it to the site.

Editing `src/_data/menu.json` to try a layout locally is fine, and must be reverted before committing — the next settings publish overwrites it.

## Anti-examples

- `<nav><a href="/pricing/">Pricing</a> …</nav>` — hand-written links, path targets, no tracking, no unpublished-page handling.
- Two `leed/menu/builder` calls with the same `menuName`, one `hidden lg:block` and one `lg:hidden` — two copies of the same navigation.
- `menuName="top"` copied from an example — the name must match a key in `menu.json`, or the builder renders nothing.
