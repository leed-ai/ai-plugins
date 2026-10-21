import { COLOR_FN, HEX } from "./css.mjs";

/**
 * Design tokens in a JSON file. Two shapes are recognized: the W3C design-tokens format and its
 * variants (a leaf object with `$value` or `value`), and a plain map whose leaves are color strings.
 * A JSON file with neither is not tokens, and the caller lists it as unrecognized.
 */

// Both sources hold a top-level `|`, so each is grouped before it is anchored.
const WHOLE_HEX = new RegExp(`^(?:${HEX.source})$`);
const WHOLE_COLOR_FN = new RegExp(`^(?:${COLOR_FN.source})$`);

const isColor = (value) =>
  typeof value === "string" && (WHOLE_HEX.test(value.trim()) || WHOLE_COLOR_FN.test(value.trim()));

export function readTokens(file, text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { tokens: [], reason: `not valid JSON (${error.message})` };
  }
  const tokens = [];
  const visit = (node, trail, inheritedType) => {
    if (node === null || typeof node !== "object") {
      if (isColor(node)) tokens.push({ file, path: trail.join("."), value: node, type: "color" });
      return;
    }
    const type = node.$type ?? node.type ?? inheritedType;
    if (!Array.isArray(node) && ("$value" in node || ("value" in node && typeof node.value !== "object"))) {
      const value = node.$value ?? node.value;
      tokens.push({
        file,
        path: trail.join("."),
        value,
        type: typeof type === "string" ? type : isColor(value) ? "color" : null,
      });
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith("$")) continue;
      visit(child, [...trail, key], typeof type === "string" ? type : undefined);
    }
  };
  visit(data, [], undefined);
  return tokens.length > 0 ? { tokens, reason: null } : { tokens, reason: "JSON with no design tokens in it" };
}
