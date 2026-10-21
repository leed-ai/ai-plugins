import fs from "node:fs";
import { validateMap } from "../rewrite.mjs";
import { PLACEHOLDER_ID, ScriptError } from "./placeholders.mjs";

/**
 * What a move has done so far, as the skill records it in its scratch directory: the id map (`move-map.json`, every
 * placeholder the move has mapped to a real id) and the filled list (`move-filled.json`, every placeholder page whose
 * content the move has imported). Both outlive a rewrite, which replaces the placeholders in the sandbox itself, so a
 * plan re-run on resume and the final check read them instead of the sandbox.
 */

function readJsonFile(file, flag) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (error) {
    throw new ScriptError(`${flag} ${file} could not be read as JSON: ${error.message}`);
  }
}

/**
 * Every entry of an id map, as `{ ids, images }`: `ids` maps each placeholder to its real id, `images` each staged
 * image's site path to its upload. A map rewrite.mjs refuses is refused.
 */
export function readMap(file, flag = "--map") {
  return validateMap(readJsonFile(file, flag));
}

/** The page placeholders an id map names, as a Map of placeholder to real id. */
export function pagesOf(ids) {
  return new Map([...ids].filter(([id]) => id.startsWith("ph-page-")));
}

/** The page placeholders the id map in `file` names, as a Map of placeholder to real id. */
export function readMappedPages(file, flag = "--map") {
  return pagesOf(readMap(file, flag).ids);
}

/**
 * The placeholder pages the move has filled: a JSON array of `ph-page-<n>` ids. A file that does not exist yet means
 * nothing has been filled.
 */
export function readFilled(file, flag = "--filled") {
  if (!fs.existsSync(file)) return new Set();
  const list = readJsonFile(file, flag);
  if (
    !Array.isArray(list) ||
    !list.every((id) => typeof id === "string" && id.startsWith("ph-page-") && PLACEHOLDER_ID.test(id))
  ) {
    throw new ScriptError(`${flag} ${file} must be a JSON array of ph-page-<n> ids`);
  }
  return new Set(list);
}
