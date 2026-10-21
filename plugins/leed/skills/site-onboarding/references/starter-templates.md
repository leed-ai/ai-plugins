# Writing the starter templates

The starter templates live in `../../../templates/starter/` (`${CLAUDE_PLUGIN_ROOT}/templates/starter/` once installed). `manifest.json` there lists every file; nothing that it does not list is copied. Each source path is the same as its target in the site checkout: the `raw-content` git directory that holds `identity.json`, `src/` and `tailwind/site.config.css`. Every `target` is relative to that directory, never to the site folder above it, which is outside the git repo.

## The manifest

| Key | What it holds |
|---|---|
| `files[].source`, `target` | The file in the plugin, and where it goes in the site checkout |
| `files[].kind` | `provisioned`, `new`, `merge` or `eject`, below |
| `files[].requires` | `starter`: written only when the tier is Starter or above |
| `files[].eject` | For `eject` files, the name `leed site eject --json` must list |
| `files[].dependsOn` | Written or replaced only when every file listed holds the starter's version (below), written by this run or an earlier one |
| `files[].optionalElements` | Elements the starter's version may lack, because onboarding deletes them when they have nothing to show |
| `files[].placeholders` | Every `###…###` the file holds |
| `imports` | The lines `tailwind/site.config.css` must hold, in order |
| `placeholders` | What each placeholder is replaced with |
| `brandTokens` | The brand tokens the interview fills in `theme.css` |
| `fonts` | The bundled font classes `###FONT_CLASS###` may take |

## The four kinds

- **`provisioned`** — a file every new site already has: `src/_includes/site-template.hbs`, `header-includes.hbs`, `header.hbs`, `footer.hbs` and `src/index.hbs`. A site provisioned before the CLI shipped one of them (`header-includes.hbs` is the latest) lacks that file: write it as you would a `new` one. Replace it only while it is the CLI's provisioned original or the starter's version (both under "Recognizing a file" below), and only when every file in its `dependsOn` holds the starter's version. The header's markup needs the starter's `site-header.js` (which measures `--height-header`), `menu.css` and `site.css`: replaced over a site's own copies of those, the header would sit over the page content. When a `dependsOn` file was kept because the site has its own, keep the provisioned file too and report both. A file that is neither original nor starter was changed by the user: keep it, and report it with what the starter would have given them.
- **`new`** — written only when the target does not exist. An existing file is kept and reported.
- **`merge`** — `tailwind/site.config.css`, which is never replaced. For each `imports[]` line the file lacks, add it once: the first after `@import "tailwindcss" …`, each later one right after the line before it in the list. Skip a line whose `requires` names a file that was not written. A `/leed:create` recipe's import already in the file stays where it is.
- **`eject`** — `docs-header.hbs` and `docs-footer.hbs`. Write one only when `leed site eject --json` lists its `eject` name with `customized: false`, and only when its `dependsOn` file is the starter's. The recommendation card, `stub-template.hbs`, is not a starter file: `/leed:create recommendations` writes it on Growth. Leed renders these only on the plan that allows them (site-patterns rule 13); the listing is how you know, never a guess.

Write in this order, so each `dependsOn` is settled before the file that needs it: the `new` files and the `merge`, then the `provisioned` files, then the `eject` files.

## Recognizing a file

Compare line by line, ignoring trailing whitespace.

- **The provisioned original** is `<dist>/static/templates/raw-content/<target>` in the installed CLI. Find `<dist>` the way `/leed:setup` installs the CLI, with Bun: `realpath "$(command -v leed)"` is `…/@leed-ai/cli/dist/leed.mjs`, and its directory is `<dist>`. When `leed` is not a link into a package, use `~/.bun/install/global/node_modules/@leed-ai/cli/dist`. Only an old npm install, which `/leed:setup` replaces, needs `npm ls -g @leed-ai/cli --parseable` (then its `dist/`). Provisioning fills `###DATE###`, `###PAGE_TYPE_ID###` and `###NEW_PAGE_ID###` in that original, so each of those three matches any value. A site provisioned before the CLI's copy changed still has the earlier text, so an earlier original counts too: each is kept at `../../../templates/provisioned-earlier/<target>` (`${CLAUDE_PLUGIN_ROOT}/templates/provisioned-earlier/` once installed), compared the same way. Today that is the header before its background moved from `bg-white` to `--site-header-bg-color`.
- **The starter's version** is the starter source with every placeholder in that file's `placeholders` matching any value, and, in `theme.css`, the color value of each `brandTokens` entry matching any value. An element named in `optionalElements` may be missing, as a whole, with its lines. A file onboarding filled in, in this run or an earlier one, is the starter's version.

A re-run therefore treats its own earlier output as replaceable, not as the user's: a `provisioned` file that is the starter's version is filled and written again (so a hero button can be added once its page is published), and a `new` file that is the starter's version is left as it is and counts as written. Only a file that is neither is the user's, and kept.

## Placeholders

Fill every one before the file is committed. A file still holding `###` is broken.

- `###HOME_PAGE_ID###`, `###HOME_PUBLISHED_AT###` and `###ROOT_PAGE_TYPE_ID###` come from the frontmatter of the site's current `src/index.hbs`, read before it is replaced. Keeping the home page's `pageId` keeps every `pageid:` link to it working.
- `###MODIFIED_AT###` is the current time in ISO 8601 UTC.
- `###THEME_COLOR_LIGHT###` and `###THEME_COLOR_DARK###` are the light and dark values of `--brand-bg` as `tailwind/site/theme.css` holds them once the interview's colors are in: the `:root` block's and the `@media (prefers-color-scheme: dark)` block's. They fill the two `theme-color` metas in `src/_includes/header-includes.hbs`, the browser chrome's color. A meta cannot read a CSS variable, so this is the one copy of a brand color outside `theme.css` (site-patterns rules 9 and 14); a later change to `--brand-bg` changes them too. Fill them after `theme.css` is written, and when `theme.css` was kept as the user's, read the values from their file.
- `###FONT_CLASS###` is the chosen font, one of `fonts` (e.g. `font-inter`). It fills `--font-sans: var(--###FONT_CLASS###)` in `tailwind/site/theme.css`, the one place the site font is set, and `site-template.hbs` applies it with `font-sans`, as leed.ai does. To change the font later, change that line.
- `###TAGLINE###` is the interview's one-sentence description, HTML-escaped.
- `###PRIMARY_PAGE_ID###` and `###PRIMARY_LABEL###` are the section page the hero button opens and its text, and only a **published** page may fill them: check its `status` with `leed page sync-state` (MCP `list_pages`). Leed's build replaces a `pageid:` link to an unpublished page with a plain `<span class="page-removed">`, on staging and in production, so a button to a draft would vanish. The section pages `create-pages` makes are drafts, so on a first run delete the whole `site-hero__actions` element, with its lines, and tell the user the home page has no button until that page is published; running onboarding again then adds it.

The brand colors are not placeholders in `theme.css`: it ships a neutral palette with a blue accent, so a site with no brand yet still builds. Replace the values of the eleven `brandTokens` in its light `:root` block and its dark block with the interview's colors, and touch nothing else in the file.

## Then publish

Use the `site-publish` skill (`../../site-publish/SKILL.md`) from the `raw-content` directory:

1. `leed site init --font-awesome`, which installs Font Awesome Free so the starter's icons (the header's `leed-icon-menu`) draw. It does nothing when the site already has Font Awesome, Free or its owner's own Pro, so it is safe on a re-run.
2. `leed site validate`, then `leed site build`, which also installs the chosen font.
3. `leed site commit --dry-run -m "Add the site starter templates from /leed:site-onboarding" --json`. It commits the whole working tree: when it lists anything onboarding did not write, stop and ask the user to commit or set those changes aside first.
4. `leed site commit -m "Add the site starter templates from /leed:site-onboarding"`, then `leed site push --json`. Never raw `git commit` or `git push`.

Always push, even when there is nothing new to commit: an earlier run may have committed and then failed before its push.

The push reaches staging only. Production gets these files from the promote at the end of the `site-publish` staging check, and nothing in the CMS may name one of them before then: CMS settings publish straight to production. That is why `documentationConfiguration.colorTheme: color-theme-site` is not written with the other company settings but by the `docs-color-theme` step in `settings.json`, after the promote.
