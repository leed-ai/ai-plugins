# Running the starter settings

`../../../templates/starter/settings.json` (`${CLAUDE_PLUGIN_ROOT}/templates/starter/settings.json` once installed) holds the settings onboarding applies, in the same step shape as a `/leed:create` recipe (`../../create/references/recipe-format.md`):

| Key | What it holds |
|---|---|
| `menus` | The two site menus, `Header Menu` (the company's `top` slot) and `Footer Menu` (`bottom`, `expanded: true`), and what their items are |
| `companySettings` | The company fields onboarding writes: always the `menus.top` and `menus.bottom` binding, the site title and documentation font from the interview, and the documentation color theme by tier, with `colorTheme.when` saying which step writes it |
| `steps[]` | `id`, `title`, `needsRepo`, `cli` (the commands, `<…>` marking a value an earlier step returned), `mcp` (the CMS MCP tools that do the same, or `null`), and `do` (what to do, including when to skip) |

## How to run it

- Run the steps in order, once the user has confirmed the proposal. Every step but the last runs in SKILL.md section 3; `docs-color-theme` (`"after": "promote"`) runs after the staging check and promote in section 6. Do what each step's `do` list says with its `cli` commands, or its `mcp` tools when there is no CLI, and nothing else. Tell the user one line per step.
- A step whose `do` list says it applies only to some records (pages, labels, page types the proposal named) runs only for those.
- A step with `needsRepo: true` runs from the site checkout's root. With no checkout, skip it and record that it was skipped.
- **Payloads go through a file.** A page body, a page type payload and the company patch are written to a temporary file outside the site checkout and passed with `--file` or `--from-file`; never inline JSON in a shell argument.
- **Ids come from results.** Every `pageId`, `labelId`, `pageTypeId`, `menuId`, menu `revision` and `companyId` a later step needs is read from an earlier step's `data`. Never guess one.
- **Menu writes chain revisions.** Each `menu add` and `set-menu` answers the next `revision`; pass it to the next write. A `conflict` means someone else changed the menu: read it again and retry that one write once.
- **Publish by id, never `--all`.** Read `leed settings pending --json` (MCP `list_pending_changes`), then publish exactly the entries this run changed that the list holds (`publish_pending_changes` with those ids).

## Tier

A custom documentation theme name (`color-theme-site`) needs the Starter plan or above. The tier comes from `leed site eject --json` (`data.tier`); null, or no checkout, means Free. Below Starter, `company-settings` writes the built-in theme closest to the brand accent, and the starter's `tailwind/docs/color-theme-site.css` is not written. A plan refusal arrives as `permission_denied` with an upgrade hint; it is not retried with the same value.

## Production before staging: the color theme waits for the promote

CMS settings, menus and company settings publish **straight to production** (their deployments build `main`). The starter files go through **staging**: `leed site push` puts them on the preview site, and only a promote puts them on production. So no setting may name something only the starter files define until the promote has happened.

The one such setting is `colorTheme: color-theme-site`, whose `@utility` lives in `tailwind/docs/color-theme-site.css`. Written with the other company settings, it would strip the colors from the live documentation until the promote, and leave them stripped if the staging check failed. So `company-settings` never writes it, and `docs-color-theme` writes it only once that file is on production. When the user does not promote, it is not written, and the user is told so. The built-in themes, the font, the site title and the menus' binding name only what Leed itself ships, so they publish in section 3.

## Search

Onboarding creates no search index. Leed's only search UI is the documentation search, which the starter header shows only on documentation pages; an index over other page types would have nothing to query it. A documentation set made by `/leed:create documentation` brings its own index. Without one, the proposal says there is no search, and why.

## What the menus need

The provisioned Header Menu and Footer Menu are already the company's `top` and `bottom` menus, which is what puts them in the site's `src/_data/menu.json` once they are published. A menu that is not bound to anything never reaches the site, so when a company has lost that binding, `company-settings` restores it.

The header and footer templates read the menus by name (`menuName="Header Menu"`, `menuName="Footer Menu"`), so the names are not to be changed. The builder hides an item whose page is unpublished, so a menu of draft pages renders empty until the user publishes them.
