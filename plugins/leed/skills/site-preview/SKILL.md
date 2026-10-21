---
name: site-preview
description: Builds and serves the Leed CMS site locally for development preview. Manages the dev server lifecycle including start, restart, and stop.
---

# Site Preview Skill

You manage the local development server for a Leed CMS website. You build the site, start the dev server, handle restarts when needed, and help the user preview their changes.

## Before Starting

Read `cli-commands.md` in the site-builder skill's `references/` folder (`../site-builder/references/cli-commands.md` from this skill's directory) for the full CLI reference.

**A sandbox site previews the same way.** One made with `leed site init --sandbox` (its `identity.json` names `non-cms-company`) builds and serves with no Leed account and no git repository: `leed site build --serve` from its root. Its first build installs the site's packages, so it needs the network or a warm Bun cache once. Publishing refuses there until it is moved into Leed with `/leed:site-sandbox-move`.

## Core Rules

- The dev server command is `leed site build --serve`
- **`--serve` skips minification for you — do not pass `-d` with it.** Minification is roughly 44% of build time and produces nothing you need while developing, so `--serve` and `--wrangler` turn `-d` on by default. Pass `--no-debug` if you ever need a minified dev build (reproducing a minify bug); that is the only reason to.
- **Typing `-d` yourself disqualifies the build.** A build whose `-d` came from the command line is never recorded as the site's last successful build, and `leed import apply` refuses to upload unless a recorded build is newer than the staging run. The default `--serve` applies does NOT disqualify it — serving IS the review the guard is asking for — so `leed site build --serve` both rebuilds fast and satisfies the import guard. Adding `-d` to it takes the recording away for nothing.
- A plain `leed site build` (no flags) still minifies, and so does the production build CI runs after `leed site push`, regardless of what you used locally.
- Default port is 8080, configurable with `--port`
- The server auto-rebuilds on content, CSS, JS, and data file changes
- Layout and partial changes are picked up live — they trigger a config reset and full rebuild, so no restart is needed
- Always check if a server is already running before starting a new one
- The server process must be in the foreground so the user can interact with it

## Commands

### Start the dev server
```bash
leed site build --serve
```

### Start with options
```bash
leed site build --serve --port 3000     # Custom port
leed site build --serve --skip-search   # Faster builds (skip search index)
leed site build --serve --no-debug      # Minify anyway — only to reproduce a minification bug
```

### Build without serving (validation build)
```bash
leed site build         # Minifies and records the build, so `leed import apply` will accept it
leed site build -d      # Faster, but NOT recorded — do not use this before `leed import apply`
```

### Debug Eleventy issues
```bash
DEBUG=Eleventy* leed site build --serve
```

## Workflow

### Starting Fresh
1. Check if a server process is already running (look for existing process on port 8080)
2. If running, ask user if they want to restart or use the existing server
3. Start the server: `leed site build --serve`
4. Tell the user: "Dev server running at http://localhost:8080"

### After Layout/Partial Changes
No action needed. A change under `_layouts/` or `_includes/` resets the config and rebuilds
every page that uses the edited template, recompiling Tailwind on the same pass. Tell the user:
"Template changes rebuilt. Check your browser — it should refresh automatically."

This rebuild re-reads the whole config, so it takes a few seconds longer than a content edit.

### After Content/CSS/JS Changes
No action needed — the server auto-rebuilds. Tell the user:
"Changes auto-rebuild. Check your browser — it should refresh automatically."

### Stopping the Server
```bash
# Ctrl+C in the terminal running the server
# Or find and kill the process:
lsof -ti:8080 | xargs kill
```

## Troubleshooting

### `leed import apply` says to build and review first
The import guard only accepts a **recorded** build newer than the generated set, and a build where YOU passed
`-d` / `--debug` is never recorded, since its output skips minification. `leed site build --serve` is recorded even
though it skips minification too — that default is ours, and serving is the review the guard is asking for. So drop
the `-d` and re-run either `leed site build` or `leed site build --serve`.

### Build Errors
- Check for Handlebars syntax errors (mismatched `{{#if}}...{{/if}}`, unknown helpers)
- Check for missing partials (typo in `{{> partialName }}`)
- Check for malformed frontmatter (invalid JSON in YAML header)
- Run with debug: `DEBUG=Eleventy* leed site build --serve`

### Port Already in Use
```bash
# Find what's using the port
lsof -i:8080
# Kill it if it's a stale process
lsof -ti:8080 | xargs kill
# Or use a different port
leed site build --serve --port 3000
```

### Slow Builds
- Use `--skip-search` to skip Lunr search index generation
- Use `--skip-ai` to skip AI documentation generation
- Minification is already skipped under `--serve` and `--wrangler`; on a plain `leed site build`, `-d` skips it

### npm Registry Failures During Build

The Leed CLI and its packages come from the public npm registry and need no token. If the build fails while installing or fetching `@leed-ai/...` packages with a 401, 403, "unable to authenticate", or "E401" error, the cause is a leftover `"@leed-ai"` line in `~/.bunfig.toml` pointing at a private registry. Ask your user to delete that line, then retry the build. `leed auth rotate` does not help here: it never touches `~/.bunfig.toml`.
