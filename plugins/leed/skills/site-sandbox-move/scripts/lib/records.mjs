import fs from "node:fs";
import path from "node:path";
import {
  findTokens,
  placeholderToken,
  ScriptError,
  STAGED_IMAGE_PREFIX,
  siteSourceFiles,
  toRel,
} from "./placeholders.mjs";

/**
 * The records a sandbox defines, read from where the CMS would have published them: the `src/_data` maps, each page
 * type's `*.11tydata.json`, a page's own frontmatter, and the images staged under `src/static/images/tmp/`. Each
 * record carries the placeholders its definition names, which is what orders the move.
 */

export const DATA = "src/_data";

/** The menus every Leed site is provisioned with; a sandbox's copies are mapped to them, never created. */
const SEEDED_MENUS = new Set(["Header Menu", "Footer Menu"]);

/** The home page's template; every Leed site is provisioned with it, so a sandbox's is mapped, never created. */
export const HOME_PAGE = "src/index.hbs";

/**
 * Whether the page file `rel` is a template page: a Handlebars template whose frontmatter names a `pageId`, like a
 * contact or about page drawn by its own markup. The template IS the page: it is copied into the checkout with the
 * other templates and renders at its own URL. As provisioning does for the pages it writes, its `pageId` is a UUID
 * minted locally (`template-ids.mjs`) and the CMS holds no record for it: the build resolves `pageid:` links and menu
 * items to it from the pages it rendered. A `.md` page is content: it is created in the CMS and filled.
 */
export function isTemplatePage(rel) {
  return rel.endsWith(".hbs");
}

/** The `_data` maps keyed by record id, with the kind each key is. */
const KEYED_MAPS = [
  ["pageTypeList.json", "pt"],
  ["labelList.json", "label"],
  ["userList.json", "author"],
  ["leedForms.json", "form"],
  ["ctaList.json", "cta"],
  ["searchIndexList.json", "index"],
];

function readJson(root, rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (error) {
    throw new ScriptError(`${rel} is not valid JSON: ${error.message}`);
  }
}

/** The placeholders named anywhere in `value`, minus `self`. */
function tokensIn(value, self) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? null);
  return [...new Set([...text.matchAll(placeholderToken())].map((m) => m[0]))].filter((id) => id !== self);
}

/** A template's or content file's leading JSON or YAML-ish frontmatter, as text. */
export function frontmatterText(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  return match ? match[1] : null;
}

/** `"pageId": "ph-page-3"` or `pageId: ph-page-3` in a frontmatter block. */
function frontmatterPageId(front) {
  return /(?:^|[\s{,])["']?pageId["']?\s*:\s*["']?(ph-page-[1-9]\d*)["']?/.exec(front)?.[1];
}

/** The `pageId` a frontmatter block names, placeholder or real: `"pageId": "<id>"` or `pageId: <id>`. */
export function frontmatterAnyPageId(front) {
  return /(?:^|[\s{,])["']?pageId["']?\s*:\s*["']?([A-Za-z0-9][A-Za-z0-9_-]*)["']?/.exec(front)?.[1];
}

/**
 * A frontmatter block as an object. The CMS publishes JSON frontmatter, which is parsed whole; anything else is read
 * as flat YAML (`key: value`, `key: [a, b]` and `key:` followed by `- item` lines), which is all a sandbox page needs.
 * Returns undefined when the block is JSON that does not parse.
 */
export function parseFrontmatter(front) {
  if (front.trimStart().startsWith("{")) {
    try {
      const parsed = JSON.parse(front);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  const unquote = (value) => value.trim().replace(/^(["'])(.*)\1$/, "$2");
  const fields = {};
  let list;
  for (const line of front.split(/\r?\n/)) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && list) {
      list.push(unquote(item[1]));
      continue;
    }
    const pair = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!pair) continue;
    const [, key, raw] = pair;
    list = undefined;
    if (raw.trim() === "") fields[key] = list = [];
    else if (/^\[.*\]$/.test(raw.trim())) {
      const inner = raw.trim().slice(1, -1).trim();
      fields[key] = inner === "" ? [] : inner.split(",").map(unquote);
    } else fields[key] = unquote(raw);
  }
  return fields;
}

function frontmatterTitle(front) {
  const title = parseFrontmatter(front)?.title;
  return typeof title === "string" ? title : undefined;
}

/** What a person would call the record: a user's full name, a form's heading, else its name or slug. */
function recordName(kind, entry) {
  if (kind === "author") return [entry?.firstName, entry?.lastName].filter(Boolean).join(" ");
  if (kind === "form") return String(entry?.heading ?? entry?.formPrototype ?? "");
  return String(entry?.name ?? entry?.slug ?? "");
}

/**
 * Every record the sandbox at `root` defines, as a Map of id to
 * `{ id, kind, name, definedIn: [file], dependsOn: [id], parent?, seeded? }`. Staged images are keyed by their site
 * path. `seeded` marks a record every Leed site is provisioned with, which the move maps rather than creates.
 */
export function collectRecords(root) {
  const records = new Map();
  const add = (id, kind, fields) => {
    const existing = records.get(id);
    if (existing) {
      existing.definedIn.push(...fields.definedIn);
      existing.dependsOn = [...new Set([...existing.dependsOn, ...fields.dependsOn])];
      // A page is a template page only when every file defining it is a template.
      if (existing.template && !fields.template) delete existing.template;
    } else records.set(id, { id, kind, ...fields });
  };

  for (const [file, kind] of KEYED_MAPS) {
    const map = readJson(root, `${DATA}/${file}`) ?? {};
    for (const [id, entry] of Object.entries(map)) {
      const definedIn = [`${DATA}/${file}`];
      let definition = entry;
      if (kind === "pt" && typeof entry?.slug === "string" && entry.slug !== "") {
        const slug = entry.slug.replace(/\/+$/, "");
        const dataFile = `src/${slug}/${slug.slice(slug.lastIndexOf("/") + 1)}.11tydata.json`;
        const typeData = readJson(root, dataFile);
        if (typeData !== undefined) {
          definedIn.push(dataFile);
          definition = [entry, typeData];
        }
      }
      // Every Leed site already has its root page type (slug ""), so the sandbox's is mapped to it.
      const seeded = kind === "pt" && entry?.slug === "";
      add(id, kind, {
        name: recordName(kind, entry),
        definedIn,
        dependsOn: tokensIn(definition, id),
        ...(seeded ? { seeded } : {}),
      });
    }
  }

  const menus = readJson(root, `${DATA}/menu.json`) ?? {};
  for (const [name, menu] of Object.entries(menus)) {
    if (!menu?.menuId) continue;
    add(menu.menuId, "menu", {
      name,
      definedIn: [`${DATA}/menu.json`],
      dependsOn: [],
      ...(SEEDED_MENUS.has(name) ? { seeded: true } : {}),
    });
    const walk = (items, parent) => {
      for (const item of items ?? []) {
        const { submenu, ...own } = item;
        if (item.menuItemId) {
          add(item.menuItemId, "menuitem", {
            name: item.name ?? "",
            definedIn: [`${DATA}/menu.json`],
            dependsOn: [...new Set([menu.menuId, ...(parent ? [parent] : []), ...tokensIn(own, item.menuItemId)])],
            parent: parent ?? menu.menuId,
          });
        }
        walk(submenu, item.menuItemId ?? parent);
      }
    };
    walk(menu.items, null);
  }

  const autolinks = readJson(root, `${DATA}/autolink.json`);
  for (const entry of Array.isArray(autolinks) ? autolinks : []) {
    if (!entry?.autolinkId) continue;
    add(entry.autolinkId, "autolink", {
      name: entry.text ?? "",
      definedIn: [`${DATA}/autolink.json`],
      dependsOn: tokensIn(entry, entry.autolinkId),
    });
  }

  for (const { rel, full } of siteSourceFiles(root)) {
    if (rel.startsWith(`${DATA}/`)) continue;
    const front = frontmatterText(fs.readFileSync(full, "utf-8"));
    const pageId = front && frontmatterPageId(front);
    if (pageId) {
      // Every Leed site already has its home page, so the sandbox's is mapped to it.
      const seeded = rel === HOME_PAGE;
      add(pageId, "page", {
        name: frontmatterTitle(front) ?? "",
        definedIn: [rel],
        dependsOn: tokensIn(front, pageId),
        ...(seeded ? { seeded } : {}),
        ...(!seeded && isTemplatePage(rel) ? { template: true } : {}),
      });
    }
  }

  const staged = path.join(root, "src", "static", "images", "tmp");
  if (fs.existsSync(staged) && fs.statSync(staged).isDirectory()) {
    for (const entry of fs.readdirSync(staged, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile()) continue;
      const rel = toRel(root, path.join(entry.parentPath, entry.name));
      const sitePath = `${STAGED_IMAGE_PREFIX}${toRel(staged, path.join(entry.parentPath, entry.name))}`;
      add(sitePath, "image", { name: entry.name, definedIn: [rel], dependsOn: [] });
    }
  }
  return records;
}

/** Every placeholder and staged-image reference in the site source under `root`, as `{ token, kind, file, line }`, in file order. */
export function collectReferences(root) {
  const refs = [];
  for (const { rel, full } of siteSourceFiles(root)) {
    for (const found of findTokens(fs.readFileSync(full, "utf-8"))) refs.push({ ...found, file: rel });
  }
  return refs;
}

/**
 * `ph-asset-*` ids have no definition of their own: an asset exists where something names it (a menu item's image, a
 * page's feature image). Each referenced one is added to `records` as defined by the first file naming it.
 */
export function addAssetRecords(records, references) {
  for (const ref of references) {
    if (ref.kind === "asset" && !records.has(ref.token)) {
      records.set(ref.token, { id: ref.token, kind: "asset", name: "", definedIn: [ref.file], dependsOn: [] });
    }
  }
  return records;
}
