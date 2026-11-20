#!/usr/bin/env node
/**
 * campaign: the stateless checker every /leed:campaign-* skill runs over the campaign JSON the agent fetched from the
 * CMS. Each command is built by the issue that first needs it. The checks are the CMS's own (#520), from
 * `libs/data-types/src/campaignChecks/`, so the CMS refuses an agent write with the same findings this prints; the plugin
 * build bundles them with this file into the one dependency-free `campaign.mjs` it ships.
 *
 *   node campaign.mjs calendar materialize --from <file|-> [--day0 YYYY-MM-DD] [--tz <IANA>]
 *   node campaign.mjs chars <channel> --from <file|-> [--deliverable <id|ref>]
 *   node campaign.mjs check brief --from <file|->
 *   node campaign.mjs check plan --from <file|-> [--now <ISO>]
 *   node campaign.mjs check post --from <file|-> --deliverable <id|ref>
 *   node campaign.mjs check research --from <file|-> [--today YYYY-MM-DD]
 *   node campaign.mjs review pack --from <file|-> <target>
 *   node campaign.mjs review check --from <file|-> <target> [--rerun]
 *
 * where <target> is `--deliverable <id|ref>`, or `--page <pageId>` with `--persona <id> --journey <journeyId>` when
 * no deliverable links the page.
 *
 * `--from` names one JSON object, `{ campaign, audience, brief, deliverables, company }`, each value exactly as the
 * CMS returns it: `campaign` and `audience` from `get_campaign`, `brief` from `get_campaign_brief`, `deliverables`
 * from `list_campaign_deliverables` and `company` from `get_company_overview`. `-` reads it from stdin. A CLI
 * `{ ok, data }` envelope is unwrapped, and keys a command does not read are ignored.
 *
 * `check research` (#476) needs `brief`, and reads `campaign`, `company` and `appendResearch` (the pending research
 * run, exactly as `update_campaign_brief` will be sent it) when they are there. `--today` is the date it checks
 * against, today's UTC date by default; any other shape is a usage error. Beside the findings and warnings it prints
 * `next: { run, source, finding }`, the brief's next free ids, and `research: { runs, sources, findings, stale,
 * fresh, bytes }`, the brief as the write would leave it.
 *
 * `calendar materialize` (#479) reads `{ campaign, slots: [{ ref, slot }] }`, each slot a Day offset around the launch
 * and a local time, `D<+|-><n> HH:MM`. `--day0` and `--tz` default to the campaign's `launchDate` and `timezone`, and
 * with both the campaign may be left out. It prints `day0`, `timezone` and `slots`, each slot with its local date,
 * weekday, UTC offset and `scheduledDate` in ms epoch, ready for the deliverable tools. A wall time a DST change skips
 * is a finding; a timezone `Intl` refuses, no Day 0 or a malformed flag is a usage error.
 *
 * `check plan` (#479) needs `campaign`, `audience`, `brief` and `deliverables`, the plan pending or written, and reads
 * `pages` (`list_pages` for the posts type) and `journeys` when they are there. `--now` is the ISO time it checks
 * against, the current time by default; any other shape is a usage error. It counts every deliverable that is not
 * `rejected`, and reads its local date and time in the campaign's timezone as `calendar materialize` does.
 *
 * `chars <channel>` (#480) counts a social post the way its network does: `x`, `linkedin`, `bluesky` or `discord`,
 * the channel given as the word after the command. It reads `{ text }`, or with `--deliverable` that deliverable's
 * `copy` from `deliverables`, and `company` when it is there. X weighs its text (a link, and the `{{link}}`
 * placeholder, count 23; an emoji and most characters outside Latin count 2), Bluesky counts graphemes and UTF-8 bytes,
 * and LinkedIn and Discord count UTF-16 code units. Off X, `{{link}}` counts as the short link it becomes, which needs
 * `company`'s `public.domain`. Beside the findings and warnings it prints `channel`, `unit`, `limit`, `length` and
 * `remaining`. An unknown channel, or the placeholder off X with no company, is a usage error.
 *
 * `check post` (#480) checks a pillar post and its social set before and after campaign-draft writes them. It needs
 * `campaign`, `audience`, `brief` and `deliverables`, `page` (`get_page_body`), `pageMeta` (`get_page`, whose `page`
 * holds the metadata), `pageTypes` (`list_page_types`), `labels` (`list_labels`) and `users` (`list_users`), and reads
 * `company` when it is there. `--deliverable` names the pillar by id or `ref`. A pending post is written in the same
 * shapes, with no `pageId` yet, and the cut checks that need the page's id are skipped.
 *
 * `review pack` and `review check` (#477) also need `personas` (`list_personas`) and `journeys`
 * (`list_journey_stages`), and `page` (`get_page_body`, or `leed page get --json`) when the target is a page.
 * `--deliverable` names the deliverable by id or `ref`; `--page` names a page, which is the campaign's `new-page` or
 * `republish` deliverable that links it, or else a standalone page, reviewed for `--persona` at `--journey`.
 * `review pack` adds `packet`, the one thing the critic sees. `review check` reads `result`, the review to store,
 * and `previous`, a standalone page's round 1, and adds `thresholds`, each pass gate met or not. `--rerun` allows
 * round 1 over a stored review that failed round 2 or that a person accepted.
 *
 * It makes no network call, keeps no state and reads nothing but `--from`. It prints one JSON document,
 * `{ ok, findings: [{ section, id, message }], warnings: [{ section, id, message }] }`. Exit codes: 0 no findings
 * (warnings alone do not fail), 1 findings, or input that lacks what the command needs, 2 a usage error, printed as
 * `{ ok: false, error }`.
 */

// src/campaignChecker/main.ts
import fs2 from "node:fs";
import { pathToFileURL } from "node:url";

// ../../libs/data-types/src/campaignChecks/findings.ts
class CheckUsageError extends Error {
}
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function publicDomain(company) {
  const domain = isObject(company) && isObject(company.public) ? company.public.domain : null;
  return typeof domain === "string" && domain.trim() !== "" ? domain.trim() : null;
}
var toInt = (value) => Number.isInteger(value) ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null;
function report(findings, warnings = []) {
  return { document: { ok: findings.length === 0, findings, warnings }, code: findings.length === 0 ? 0 : 1 };
}
function refusal(section, message) {
  return report([{ section, id: null, message }]);
}

// src/campaignChecker/cliInput.ts
import fs from "node:fs";
function parseFlags(argv, booleans = []) {
  const flags = {};
  for (let i = 0;i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--"))
      throw new CheckUsageError(`unexpected argument ${arg}`);
    const name = arg.slice(2);
    if (booleans.includes(name)) {
      flags[name] = true;
      continue;
    }
    const value = argv[++i];
    if (value === undefined || value.startsWith("--"))
      throw new CheckUsageError(`--${name} needs a value`);
    if (flags[name] !== undefined)
      throw new CheckUsageError(`--${name} was given twice`);
    flags[name] = value;
  }
  return flags;
}
function onlyFlags(flags, known) {
  for (const name of Object.keys(flags)) {
    if (!known.includes(name))
      throw new CheckUsageError(`unknown flag --${name}`);
  }
}
function required(flags, name) {
  const value = flags[name];
  if (value === undefined || value === true)
    throw new CheckUsageError(`--${name} is required`);
  return value;
}
function unwrapEnvelope(value) {
  return isObject(value) && "ok" in value && "data" in value ? value.data : value;
}
var INPUT_SOURCES = {
  campaign: "get_campaign",
  audience: "get_campaign",
  readiness: "get_campaign",
  brief: "get_campaign_brief",
  deliverables: "list_campaign_deliverables",
  journeys: "list_journey_stages",
  pages: "list_pages",
  page: "get_page_body",
  pageMeta: "get_page",
  pageTypes: "list_page_types",
  labels: "list_labels",
  users: "list_users",
  personas: "list_personas",
  company: "get_company_overview"
};
function readInput(source) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(source === "-" ? 0 : source, "utf-8"));
  } catch (error) {
    throw new CheckUsageError(`cannot read --from ${source} as JSON (${error.message})`);
  }
  const data = unwrapEnvelope(parsed);
  if (!isObject(data))
    throw new CheckUsageError(`--from ${source} must hold one JSON object`);
  return data;
}
var unwrapPart = (value) => isObject(value) && value.ok === false ? undefined : unwrapEnvelope(value);
function normalizeInput(input) {
  const out = { ...input };
  const parts = Object.keys(INPUT_SOURCES);
  const fills = {};
  for (const key of parts) {
    let value = unwrapPart(out[key]);
    if (isObject(value) && key in value) {
      for (const other of parts) {
        if (other !== key && other in value)
          fills[other] ??= value[other];
      }
      value = unwrapPart(value[key]);
    }
    if (value === undefined)
      delete out[key];
    else
      out[key] = value;
  }
  for (const [key, value] of Object.entries(fills)) {
    const part = unwrapPart(value);
    if (out[key] == null && part !== undefined)
      out[key] = part;
  }
  return out;
}
function finish(document, code = 0) {
  process.stdout.write(`${JSON.stringify(document, null, 2)}
`);
  process.exitCode = code;
}
function fail(error) {
  if (!(error instanceof CheckUsageError))
    throw error;
  finish({ ok: false, error: error.message }, 2);
}

// ../../libs/data-types/src/campaignChecks/researchText.ts
function canParseUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
var DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
function isIsoDate(value) {
  const match = typeof value === "string" ? DATE.exec(value) : null;
  if (!match)
    return false;
  const day = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return day.toISOString().slice(0, 10) === value;
}
var DATE_TIME = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d+)?)?(?:Z|([+-])([01]\d|2[0-3]):([0-5]\d))$/;
function isIsoDateTime(value, { seconds = true } = {}) {
  const match = typeof value === "string" ? DATE_TIME.exec(value) : null;
  return match !== null && isIsoDate(match[1]) && (!seconds || match[4] !== undefined);
}
function utcDate(value) {
  const match = typeof value === "string" ? DATE_TIME.exec(value) : null;
  if (!match || !isIsoDate(match[1]))
    return null;
  const [, date, hour, minute, second, sign, offsetHour, offsetMinute] = match;
  const [year, month, day] = date.split("-").map(Number);
  const offset = sign ? (sign === "-" ? -1 : 1) * (Number(offsetHour) * 60 + Number(offsetMinute)) : 0;
  const ms = Date.UTC(year, month - 1, day, Number(hour), Number(minute) - offset, Number(second ?? 0));
  return new Date(ms).toISOString().slice(0, 10);
}
var bareHost = (host) => host.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
function hostKey(url) {
  return canParseUrl(url) ? bareHost(new URL(url).hostname) : null;
}
function domainKey(domain) {
  return domain.includes("://") ? hostKey(domain) : bareHost(domain.trim().split(/[/:]/)[0]);
}
function onDomains(url, domains) {
  const host = hostKey(url);
  if (!host)
    return false;
  return domains.map(domainKey).some((domain) => domain !== null && domain !== "" && (host === domain || host.endsWith(`.${domain}`)));
}
var idPattern = (prefix) => new RegExp(`^${prefix}-(\\d{2,3})$`);
function nextId(prefix, ids) {
  const pattern = idPattern(prefix);
  const numbers = ids.flatMap((id) => {
    const match = typeof id === "string" ? pattern.exec(id) : null;
    return match ? [Number(match[1])] : [];
  });
  const highest = Math.max(0, ...numbers);
  return highest >= 999 ? null : `${prefix}-${String(highest + 1).padStart(2, "0")}`;
}
var HANDLE = /(?<![\w.])@([A-Za-z0-9_](?:[A-Za-z0-9_.-]*[A-Za-z0-9_])?)/g;
function handles(text) {
  return [...text.matchAll(HANDLE)].map(([, handle]) => handle);
}
function quoteShowsHandle(quote, handle) {
  const wanted = handle.toLowerCase();
  return handles(quote).some((shown) => shown.toLowerCase() === wanted);
}
function decoded(part) {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}
function urlShowsHandle(url, handle) {
  if (!canParseUrl(url))
    return false;
  const { pathname, searchParams } = new URL(url);
  const wanted = handle.toLowerCase();
  const parts = [...pathname.split("/").map(decoded), ...searchParams.values()];
  return parts.some((part) => part.replace(/^@/, "").toLowerCase() === wanted);
}
var NUMBER = /(\d+(?:[.,]\d+)*)(?:\s?(k|m|b|thousand|million|billion)\b)?/gi;
var ONE_NUMBER = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;
var SCALE = { k: 3, thousand: 3, m: 6, million: 6, b: 9, billion: 9 };
var ISO_DATE = /(?<!\d)(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?(?!\d)/g;
function exactValue(digits, scale) {
  const shift = scale ? SCALE[scale.toLowerCase()] : 0;
  const [whole, fraction = ""] = digits.replaceAll(",", "").split(".");
  const padded = fraction.padEnd(shift, "0");
  const integer = `${whole}${padded.slice(0, shift)}`.replace(/^0+(?=\d)/, "");
  const decimals = padded.slice(shift).replace(/0+$/, "");
  return decimals ? `${integer}.${decimals}` : integer;
}
function numbers(text) {
  const plain = text.replace(ISO_DATE, (whole, date) => isIsoDate(date) ? " " : whole);
  return [...plain.matchAll(NUMBER)].flatMap(([whole, digits, scale]) => ONE_NUMBER.test(digits) ? [{ text: whole, value: exactValue(digits, scale) }] : digits.split(/[.,]/).map((group) => ({ text: group, value: exactValue(group) })));
}
var figures = (text) => new Set(numbers(text).map(({ value }) => value));
var KEYWORD_TERM = /^\s*Keyword\s+(?:"([^"]*)"|“([^”]*)”)\s*:/i;
var escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function withoutKeywordTerm(claim) {
  const match = KEYWORD_TERM.exec(claim);
  if (!match)
    return claim;
  const rest = claim.slice(match[0].length);
  const words = (match[1] ?? match[2]).split(/\s+/).filter(Boolean);
  if (words.length === 0)
    return rest;
  const term = words.map(escapeRegExp).join("\\s+");
  const whole = `(?<![\\p{L}\\p{N}_]|\\p{N}[.,])${term}(?![\\p{L}\\p{N}_]|[.,]\\p{N})`;
  return rest.replace(new RegExp(whole, "giu"), " ");
}
var claimNumbers = (claim) => numbers(withoutKeywordTerm(claim));

// ../../libs/data-types/src/campaignChecks/zonedTime.ts
var MINUTE_MS = 60000;
var DAY_MS = 86400000;
var FORMATTERS = new Map;
function formatter(timeZone) {
  let format = FORMATTERS.get(timeZone);
  if (format === undefined) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "long"
    });
    FORMATTERS.set(timeZone, format);
  }
  return format;
}
function isTimeZone(timeZone) {
  if (typeof timeZone !== "string" || timeZone.trim() === "")
    return false;
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}
var pad = (value, width = 2) => String(value).padStart(width, "0");
function offsetText(minutes) {
  const sign = minutes < 0 ? "-" : "+";
  const whole = Math.abs(minutes);
  return `${sign}${pad(Math.floor(whole / 60))}:${pad(whole % 60)}`;
}
function localOf(instant, timeZone) {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(new Date(instant)).map(({ type, value }) => [type, value]));
  const [year, month, day, hour, minute, second] = ["year", "month", "day", "hour", "minute", "second"].map((type) => Number(parts[type]));
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMinutes = Math.round((wall - Math.floor(instant / 1000) * 1000) / MINUTE_MS);
  return {
    date: `${pad(year, 4)}-${pad(month)}-${pad(day)}`,
    time: `${pad(hour)}:${pad(minute)}`,
    weekday: parts.weekday,
    utcOffset: offsetText(offsetMinutes),
    offsetMinutes
  };
}
var offsetAt = (instant, timeZone) => localOf(instant, timeZone).offsetMinutes * MINUTE_MS;
function instantOf(date, time, timeZone) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - offsetAt(guess, timeZone);
  const candidates = new Set([
    first,
    guess - offsetAt(first, timeZone),
    guess - offsetAt(guess - DAY_MS, timeZone),
    guess - offsetAt(guess + DAY_MS, timeZone)
  ]);
  const matches = [...candidates].filter((instant) => {
    const local = localOf(instant, timeZone);
    return local.date === date && local.time === time;
  }).sort((a, b) => a - b);
  if (matches.length === 0)
    return { instant: null, skipped: true, repeated: false };
  return { instant: matches[0], skipped: false, repeated: matches.length > 1 };
}
function addDays(date, n) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + n)).toISOString().slice(0, 10);
}

// ../../libs/data-types/src/campaignChecks/calendar.ts
var SLOT = /^D([+-])(\d{1,3}) ([01]\d|2[0-3]):([0-5]\d)$/;
var MAX_DAYS = 365;
var WEEKEND = new Set(["Saturday", "Sunday"]);
function dayZero(flags, campaign) {
  if (flags.day0 !== undefined) {
    if (!isIsoDate(flags.day0))
      throw new CheckUsageError(`--day0 must be a date written YYYY-MM-DD, not ${flags.day0}`);
    return flags.day0;
  }
  const launch = isObject(campaign) ? campaign.launchDate : undefined;
  if (isIsoDate(launch))
    return launch;
  if (launch != null) {
    throw new CheckUsageError(`the campaign's launchDate ${JSON.stringify(launch)} is not a date written YYYY-MM-DD`);
  }
  throw new CheckUsageError("calendar materialize needs Day 0: pass --day0 YYYY-MM-DD, or a campaign with a launchDate");
}
function zoneOf(flags, campaign) {
  const timeZone = flags.tz ?? (isObject(campaign) ? campaign.timezone : undefined);
  if (timeZone == null) {
    throw new CheckUsageError("calendar materialize needs a timezone: pass --tz <IANA>, or a campaign with a timezone");
  }
  if (!isTimeZone(timeZone)) {
    throw new CheckUsageError(`${JSON.stringify(timeZone)} is not a timezone Intl knows; name an IANA zone such as UTC`);
  }
  return timeZone;
}
function materialize(ref, slot, { day0, timezone }) {
  const match = typeof slot === "string" ? SLOT.exec(slot) : null;
  if (!match || Number(match[2]) > MAX_DAYS) {
    const given = JSON.stringify(slot) ?? "none";
    return { finding: `${ref} has slot ${given}; a slot is written D<+|-><n> HH:MM, with n from 0 to 365` };
  }
  const [, sign, days, hour, minute] = match;
  const date = addDays(day0, (sign === "-" ? -1 : 1) * Number(days));
  const time = `${hour}:${minute}`;
  const { instant, repeated } = instantOf(date, time, timezone);
  if (instant === null) {
    return { finding: `${ref} is at ${date} ${time}, a time the clocks skip in ${timezone}; pick another time` };
  }
  const local = localOf(instant, timezone);
  const iso = new Date(instant).toISOString();
  const warnings = [];
  if (repeated) {
    warnings.push(`${ref} is at ${date} ${time}, which happens twice in ${timezone}; the earlier, ${iso}, is used`);
  }
  if (WEEKEND.has(local.weekday))
    warnings.push(`${ref} falls on a ${local.weekday}, ${date}`);
  const row = { ref, slot, date, weekday: local.weekday, local: `${date} ${time}` };
  return { row: { ...row, utcOffset: local.utcOffset, scheduledDate: instant, iso }, warnings };
}
function calendarMaterialize(input, flags = {}) {
  const day0 = dayZero(flags, input.campaign);
  const timezone = zoneOf(flags, input.campaign);
  if (!Array.isArray(input.slots)) {
    return refusal("slots", "calendar materialize needs slots, a list of { ref, slot }, in the --from input");
  }
  const findings = [];
  const warnings = [];
  const slots = [];
  const seen = new Set;
  for (const [index, entry] of input.slots.entries()) {
    const ref = isObject(entry) && typeof entry.ref === "string" && entry.ref.trim() !== "" ? entry.ref : null;
    const flag = (message) => findings.push({ section: "slots", id: ref, message });
    if (ref === null) {
      flag(`slot ${index + 1} has no ref`);
      continue;
    }
    if (seen.has(ref)) {
      flag(`${ref} is the ref of more than one slot; each slot has its own`);
      continue;
    }
    seen.add(ref);
    const { finding, row, warnings: notes } = materialize(ref, entry.slot, { day0, timezone });
    if (finding)
      flag(finding);
    else {
      slots.push(row);
      for (const message of notes)
        warnings.push({ section: "slots", id: ref, message });
    }
  }
  const { document, code } = report(findings, warnings);
  return { document: { ...document, day0, timezone, slots }, code };
}

// ../../libs/data-types/src/campaignChecks/charCount.ts
var LIMITS = Object.freeze({
  x: Object.freeze({ unit: "weighted", limit: 280 }),
  linkedin: Object.freeze({ unit: "utf16", limit: 3000 }),
  bluesky: Object.freeze({ unit: "graphemes", limit: 300, bytes: 3000 }),
  discord: Object.freeze({ unit: "utf16", limit: 2000 })
});
var X_LINK_WEIGHT = 23;
var LINK_PLACEHOLDER = "{{link}}";
var SHORT_CODE_LENGTH = 8;
var UNIT_NAMES = Object.freeze({
  weighted: "weighted characters",
  graphemes: "graphemes",
  bytes: "UTF-8 bytes",
  utf16: "UTF-16 code units"
});
var WEB_URL = /[Hh][Tt][Tt][Pp][Ss]?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/;
var URL_TAIL = /[.,;:!?)\]'"]+$/;
var URLS = new RegExp(WEB_URL, "g");
var LINKS = new RegExp(`\\{\\{link\\}\\}|(?<![A-Za-z0-9@\\uFF20$#\\uFF03])${WEB_URL.source}`, "g");
function urlsIn(text) {
  return [...text.matchAll(URLS)].map((match) => match[0].replace(URL_TAIL, ""));
}
function withoutUrls(text) {
  return text.replace(URLS, " ");
}
var SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });
var EMOJI = /^\p{RGI_Emoji}$/v;
function codePointWeight(codePoint) {
  if (codePoint <= 4351)
    return 1;
  if (codePoint >= 8192 && codePoint <= 8205)
    return 1;
  if (codePoint >= 8208 && codePoint <= 8223)
    return 1;
  if (codePoint >= 8242 && codePoint <= 8247)
    return 1;
  return 2;
}
function plainWeight(text) {
  let weight = 0;
  for (const { segment } of SEGMENTER.segment(text)) {
    if (EMOJI.test(segment))
      weight += 2;
    else
      for (const char of segment)
        weight += codePointWeight(char.codePointAt(0) ?? 0);
  }
  return weight;
}
function xWeightedLength(text) {
  const normal = text.normalize("NFC");
  let weight = 0;
  let from = 0;
  for (const match of normal.matchAll(LINKS)) {
    const at = match.index ?? 0;
    const link = match[0] === LINK_PLACEHOLDER ? match[0] : match[0].replace(URL_TAIL, "");
    weight += plainWeight(normal.slice(from, at)) + X_LINK_WEIGHT;
    from = at + link.length;
  }
  return weight + plainWeight(normal.slice(from));
}
function graphemeCount(text) {
  let count = 0;
  for (const _segment of SEGMENTER.segment(text))
    count += 1;
  return count;
}
function utf8Bytes(text) {
  return new TextEncoder().encode(text).length;
}
function withShortLinks(text, domain) {
  return text.replaceAll(LINK_PLACEHOLDER, `https://${domain}/s/${"x".repeat(SHORT_CODE_LENGTH)}`);
}
function countFor(channel, text) {
  const { unit, limit } = LIMITS[channel];
  if (channel === "x")
    return { unit, limit, length: xWeightedLength(text) };
  if (channel === "bluesky") {
    return {
      unit,
      limit,
      length: graphemeCount(text),
      bytes: { limit: LIMITS.bluesky.bytes, length: utf8Bytes(text) }
    };
  }
  return { unit, limit, length: text.length };
}

// ../../libs/data-types/src/campaignChecks/reviewTarget.ts
var PAGE_TYPES = ["new-page", "republish"];
var VALUE_FLAGS = ["deliverable", "page", "persona", "journey"];
function checkFlags(flags) {
  const empty = VALUE_FLAGS.find((name) => typeof flags[name] === "string" && flags[name].trim() === "");
  if (empty)
    throw new CheckUsageError(`--${empty} needs a value`);
  const given = ["deliverable", "page"].filter((name) => typeof flags[name] === "string");
  if (given.length !== 1)
    throw new CheckUsageError("give exactly one of --deliverable <id|ref> and --page <pageId>");
  if (flags.deliverable !== undefined && (flags.persona !== undefined || flags.journey !== undefined)) {
    throw new CheckUsageError("--persona and --journey go only with --page, for a page no deliverable links");
  }
  if (flags.persona !== undefined && toInt(flags.persona) === null) {
    throw new CheckUsageError(`--persona must be a persona id, a whole number (got ${flags.persona})`);
  }
}
var hasRef = (item) => typeof item.ref === "string" && item.ref !== "";
var deliverableLabel = (item) => `deliverable ${item.id}${hasRef(item) ? ` (${item.ref})` : ""}`;
var deliverableId = (item) => hasRef(item) ? item.ref : String(item.id);
function findDeliverable(items, value) {
  const id = toInt(value);
  return items.find((item) => id !== null && toInt(item.id) === id) ?? items.find((item) => item.ref === value);
}
function fromDeliverable(item) {
  return {
    label: deliverableLabel(item),
    id: deliverableId(item),
    deliverable: item,
    pageId: PAGE_TYPES.includes(item.type) ? item.pageId : null,
    personaId: item.personaId,
    journeyId: item.journeyId,
    questionIds: Array.isArray(item.questionIds) && item.questionIds.length > 0 ? item.questionIds : null,
    stored: isObject(item.review) ? item.review : null
  };
}
var found = (target) => ({ findings: [], target });
var notFound = (id, message) => ({ findings: [{ section: "deliverables", id, message }], target: null });
function resolveTarget(input, flags) {
  if (!Array.isArray(input.deliverables))
    return notFound(null, "deliverables is not a list");
  const items = input.deliverables.filter(isObject);
  const campaignId = isObject(input.campaign) ? input.campaign.id : undefined;
  const asTarget = (item) => campaignId !== undefined && item.campaignId !== undefined && item.campaignId !== campaignId ? notFound(deliverableId(item), `${deliverableLabel(item)} belongs to campaign ${item.campaignId}, not campaign ${campaignId}`) : found(fromDeliverable(item));
  if (typeof flags.deliverable === "string") {
    const item = findDeliverable(items, flags.deliverable);
    if (!item)
      return notFound(flags.deliverable, `deliverable ${flags.deliverable} is not one of the campaign's deliverables`);
    return asTarget(item);
  }
  const pageId = flags.page;
  const linking = items.filter((item) => PAGE_TYPES.includes(item.type) && item.pageId === pageId);
  if (linking.length > 1) {
    const names = linking.map(deliverableLabel).join(" and ");
    return notFound(pageId, `page ${pageId} is linked by ${names}; name one with --deliverable`);
  }
  if (linking.length === 1) {
    const [item] = linking;
    if (flags.persona === undefined && flags.journey === undefined)
      return asTarget(item);
    return notFound(deliverableId(item), `page ${pageId} is ${deliverableLabel(item)}, which names its own persona and journey stage; review it with --deliverable ${item.id}`);
  }
  if (flags.persona === undefined || flags.journey === undefined) {
    throw new CheckUsageError(`no deliverable links page ${pageId}, so name who to review it for with --persona <id> --journey <journeyId>`);
  }
  return found({
    label: `page ${pageId}`,
    id: pageId,
    deliverable: null,
    pageId,
    personaId: toInt(flags.persona),
    journeyId: flags.journey,
    questionIds: null,
    stored: isObject(input.previous) ? input.previous : null
  });
}
function pageBody(input, target) {
  if (input.page == null) {
    return {
      refusal: refusal("page", `${target.label} is a page, so this command needs page (the result of get_page_body) in the --from input`)
    };
  }
  const page = input.page;
  const flag = (message) => ({ findings: [{ section: "page", id: target.id, message }] });
  if (!isObject(page) || typeof page.markdown !== "string") {
    return flag("page has no markdown: it must be the result of get_page_body or leed page get --json, not get_page");
  }
  if (typeof page.pageId === "string" && page.pageId !== target.pageId) {
    return flag(`page holds page ${page.pageId}, but ${target.label} is page ${target.pageId}`);
  }
  return { findings: [], markdown: page.markdown };
}
function contentOf(input, target) {
  const item = target.deliverable;
  const none = (section, why) => ({
    findings: [{ section, id: target.id, message: `${target.label} has no content to review: ${why}` }]
  });
  if (item && item.type === "social") {
    if (typeof item.copy !== "string" || item.copy.trim() === "")
      return none("copy", "it is a social deliverable with no copy");
    return { findings: [], content: { kind: "social", channel: item.channel ?? null, copy: item.copy } };
  }
  if (item && !PAGE_TYPES.includes(item.type)) {
    return none("type", `it is a ${item.type}, and only a new-page or republish with its page, or a social with its copy, has any`);
  }
  if (typeof target.pageId !== "string" || target.pageId === "") {
    return none("pageId", item ? `it is a ${item.type} with no page linked yet` : "no page id was given");
  }
  const body = pageBody(input, target);
  if (body.refusal || body.findings.length > 0)
    return body;
  return { findings: [], content: { kind: "page", markdown: body.markdown } };
}

// ../../libs/data-types/src/campaignChecks/chars.ts
var BARE_DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+([a-z]{2,})(?:\/\S*)?$/i;
var FILE_SUFFIX = /^(?:jsx?|mjs|cjs|tsx?|mdx|json|ya?ml|toml|css|html?)$/i;
var FILE_NAME = /^[a-z0-9-]+\.(?:md|py|sh)$/i;
var EDGES = /^[([{"'<]+|[.,;:!?)\]}"'>]+$/g;
var GLUED_LINK = /([^\s(])\{\{link\}\}/u;
function bareDomains(text) {
  return withoutUrls(text).replaceAll(LINK_PLACEHOLDER, " ").split(/\s+/).map((word) => word.replace(EDGES, "")).filter((word) => {
    const domain = word.includes("@") ? null : BARE_DOMAIN.exec(word);
    return domain !== null && !FILE_SUFFIX.test(domain[1]) && !FILE_NAME.test(word);
  });
}
function source(input, flags, channel) {
  const refuse = (section, message) => ({ findings: [{ section, id: null, message }], id: null, label: "" });
  if (flags.deliverable === undefined) {
    if (typeof input.text !== "string")
      return refuse("text", "text is not a string; give the copy to count as text");
    return { findings: [], id: null, label: "the text", copy: input.text };
  }
  if (!Array.isArray(input.deliverables)) {
    return refuse("deliverables", "chars --deliverable needs deliverables (the result of list_campaign_deliverables) in the --from input");
  }
  const value = flags.deliverable;
  const row = findDeliverable(input.deliverables.filter(isObject), value);
  const flag = (section, id, message) => ({ findings: [{ section, id, message }], id, label: id });
  if (row === undefined)
    return flag("deliverables", value, `no deliverable has id or ref ${value}`);
  const id = deliverableId(row);
  if (row.type !== "social") {
    return flag("type", id, `${id} is a ${row.type} deliverable; chars counts a social deliverable's copy`);
  }
  if (typeof row.copy !== "string" || row.copy === "")
    return flag("copy", id, `${id} has no copy yet`);
  const findings = [];
  if (row.channel !== channel) {
    const message = `${id} is a ${row.channel} deliverable, counted here for ${channel}; count it for ${row.channel}`;
    findings.push({ section: "channel", id, message });
  }
  return { findings, id, label: id, copy: row.copy };
}
function noDomain(channel) {
  return new CheckUsageError(`${LINK_PLACEHOLDER} on ${channel} counts as the short link it becomes, https://<public.domain>/s/ and 8 characters: add company (the result of get_company_overview) to the --from input`);
}
function checkChars(input, flags, channel) {
  if (input.text !== undefined === (flags.deliverable !== undefined)) {
    throw new CheckUsageError("chars counts exactly one of text in the --from input and --deliverable <id|ref>");
  }
  const target = source(input, flags, channel);
  const { unit, limit } = LIMITS[channel];
  const fields = { channel, unit, limit, length: null, remaining: null };
  const finish = (findings, warnings, extra = {}) => {
    const { document, code } = report(findings, warnings);
    return { document: { ...document, ...fields, ...extra }, code };
  };
  if (target.copy === undefined)
    return finish(target.findings, []);
  const { copy, id, label } = target;
  const domain = publicDomain(input.company);
  if (channel !== "x" && copy.includes(LINK_PLACEHOLDER) && domain === null)
    throw noDomain(channel);
  const counted = countFor(channel, channel === "x" ? copy : withShortLinks(copy, String(domain)));
  const findings = [...target.findings];
  const over = (length, max, unitName) => findings.push({
    section: "length",
    id,
    message: `${label} is ${length} ${unitName} on ${channel}, over its limit of ${max}`
  });
  if (counted.length > limit)
    over(counted.length, limit, UNIT_NAMES[unit]);
  if (counted.bytes && counted.bytes.length > counted.bytes.limit) {
    over(counted.bytes.length, counted.bytes.limit, UNIT_NAMES.bytes);
  }
  const warnings = [];
  if (!copy.includes(LINK_PLACEHOLDER) && !WEB_URL.test(copy)) {
    warnings.push({ section: "link", id, message: `${label} has no link; social copy holds ${LINK_PLACEHOLDER}` });
  }
  const glued = GLUED_LINK.exec(copy);
  if (glued !== null) {
    const message = `${label} has ${LINK_PLACEHOLDER} straight after "${glued[1]}"; put a space or a line break before it, since X and Bluesky may not link a URL written that way, and X then counts it in full`;
    warnings.push({ section: "link", id, message });
  }
  if (channel === "x") {
    for (const word of bareDomains(copy)) {
      const message = `${label} has ${word}, a domain X may link and count as a link of 23; write it as a URL or leave it out`;
      warnings.push({ section: "link", id, message });
    }
  }
  return finish(findings, warnings, { length: counted.length, remaining: limit - counted.length });
}

// ../../libs/data-types/src/campaignChecks/briefLimits.ts
var BRIEF_LIMITS = {
  narrative: 2000,
  messages: 30,
  messageText: 500,
  messageSources: 10,
  questions: 200,
  questionText: 300,
  journeyId: 100,
  runs: 50,
  runTopic: 200,
  sources: 300,
  sourceUrl: 2000,
  sourceTitle: 300,
  quoteChars: 300,
  quoteWords: 25,
  findings: 300,
  findingClaim: 500,
  findingSources: 10
};
var MAX_BRIEF_BYTES = 512 * 1024;
var STALE_AFTER_DAYS = 90;
function quoteWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
var URL_PARTS = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^#]*)/i;
function sourceUrlKey(url) {
  const match = URL_PARTS.exec(url);
  if (!match)
    return url.split("#")[0];
  const [, scheme, authority, rest] = match;
  const at = authority.lastIndexOf("@");
  return `${scheme.toLowerCase()}://${authority.slice(0, at + 1)}${authority.slice(at + 1).toLowerCase()}${rest}`;
}
var DAY_MS2 = 86400000;
var DATE2 = /^(\d{4})-(\d{2})-(\d{2})$/;
function dayNumber(date) {
  const match = DATE2.exec(date);
  if (!match)
    return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS2;
}
function isRetrievalStale(retrievedAt, today) {
  const retrieved = dayNumber(retrievedAt);
  const now = dayNumber(today);
  return retrieved !== null && now !== null && now - retrieved > STALE_AFTER_DAYS;
}

// ../../libs/data-types/src/campaignDeliverableRules.ts
var TARGET_COLUMNS = ["pageId", "deploymentId", "leadBatchId"];
var SITE_PAGE_TYPES = new Set(["new-page", "republish"]);
var COMPLETABLE_TYPES = new Set(["social", "event"]);
function ruleIssue(path, message) {
  return { path, message, code: "custom" };
}
var SHAPE_GROUPS = [
  [...TARGET_COLUMNS, "sitePath"],
  ["channel", "account"]
];

// ../../libs/data-types/src/campaignBriefRules.ts
var utf8 = new TextEncoder;
var bytes = (text) => text === null ? 0 : utf8.encode(text).length;
function briefSectionBytes(brief) {
  return {
    narrative: bytes(brief.narrative),
    messages: bytes(JSON.stringify(brief.messages)),
    questions: bytes(JSON.stringify(brief.questions)),
    research: bytes(JSON.stringify(brief.research))
  };
}
function capIssues(brief) {
  const lists = [
    ["messages", brief.messages.length, BRIEF_LIMITS.messages, "messages"],
    ["questions", brief.questions.length, BRIEF_LIMITS.questions, "questions"],
    ["research.runs", brief.research.runs.length, BRIEF_LIMITS.runs, "runs"],
    ["research.sources", brief.research.sources.length, BRIEF_LIMITS.sources, "sources"],
    ["research.findings", brief.research.findings.length, BRIEF_LIMITS.findings, "findings"]
  ];
  return lists.flatMap(([path, count, cap, noun]) => count > cap ? [ruleIssue(path, `a brief holds at most ${cap} ${noun}; this write would leave ${count}`)] : []);
}
function duplicateIdIssues(section, items) {
  const seen = new Set;
  const reported = new Set;
  const issues = [];
  for (const { id } of items) {
    if (seen.has(id) && !reported.has(id)) {
      reported.add(id);
      issues.push(ruleIssue(`${section}.${id}`, `${id} appears more than once; ids are unique within ${section}`));
    }
    seen.add(id);
  }
  return issues;
}
function duplicateUrlIssues(brief, appended) {
  const first = new Map;
  const issues = [];
  for (const source of brief.research.sources) {
    const key = sourceUrlKey(source.url);
    const holder = first.get(key);
    if (holder === undefined) {
      first.set(key, source.id);
      continue;
    }
    const isAppended = appended.has(source.id);
    const message = isAppended && !appended.has(holder) ? `this URL is already on the brief as ${holder}; refresh that source instead` : `the same URL as ${holder}; no two sources on a brief share a URL`;
    const section = isAppended ? "appendResearch.sources" : "research.sources";
    issues.push(ruleIssue(`${section}.${source.id}.url`, message));
  }
  return issues;
}
function referenceIssues(brief) {
  const sources = new Set(brief.research.sources.map((s) => s.id));
  const runs = new Set(brief.research.runs.map((r) => r.id));
  const findings = new Set(brief.research.findings.map((f) => f.id));
  const issues = [];
  for (const finding of brief.research.findings) {
    finding.sourceIds.forEach((id, index) => {
      if (!sources.has(id)) {
        issues.push(ruleIssue(`research.findings.${finding.id}.sourceIds.${index}`, `${id} is not a source on the brief`));
      }
    });
    if (!runs.has(finding.runId)) {
      issues.push(ruleIssue(`research.findings.${finding.id}.runId`, `${finding.runId} is not a run on the brief`));
    }
  }
  for (const message of brief.messages) {
    message.sources.forEach((ref, index) => {
      const path = `messages.${message.id}.sources.${index}`;
      if (ref.kind === "research" && !sources.has(ref.sourceId)) {
        issues.push(ruleIssue(path, `${message.id} cites source ${ref.sourceId}, which is not on the brief`));
      } else if (ref.kind === "finding" && !findings.has(ref.findingId)) {
        issues.push(ruleIssue(path, `${message.id} cites finding ${ref.findingId}, which is not on the brief`));
      }
    });
  }
  return issues;
}
function sizeIssues(brief) {
  const sizes = briefSectionBytes(brief);
  const total = Object.values(sizes).reduce((sum, n) => sum + n, 0);
  if (total <= MAX_BRIEF_BYTES)
    return [];
  const [largest] = Object.entries(sizes).sort(([, a], [, b]) => b - a);
  return [
    ruleIssue(largest[0], `the brief would be ${total} bytes, over the ${MAX_BRIEF_BYTES}-byte (512 KB) limit; ${largest[0]} is the largest section at ${largest[1]} bytes`)
  ];
}
function briefCapIssues(brief) {
  return [...capIssues(brief), ...sizeIssues(brief)];
}
function briefIssues(brief, appendedSourceIds) {
  return [
    ...capIssues(brief),
    ...duplicateIdIssues("messages", brief.messages),
    ...duplicateIdIssues("questions", brief.questions),
    ...duplicateIdIssues("research.runs", brief.research.runs),
    ...duplicateIdIssues("research.sources", brief.research.sources),
    ...duplicateIdIssues("research.findings", brief.research.findings),
    ...duplicateUrlIssues(brief, appendedSourceIds),
    ...referenceIssues(brief),
    ...sizeIssues(brief)
  ];
}

// ../../libs/data-types/src/campaignChecks/briefRules.ts
var ITEM_ID = /^(CM|Q|R|S|F)-\d{2,3}$/;
function findingFromIssue(issue) {
  const parts = issue.path.split(".");
  const at = parts.findIndex((part) => ITEM_ID.test(part));
  if (at < 0)
    return { section: issue.path, id: null, message: issue.message };
  return { section: parts.slice(0, at).join("."), id: parts[at], message: issue.message };
}
var objects = (value) => Array.isArray(value) ? value.filter(isObject) : [];
var withId = (value) => objects(value).filter((item) => typeof item.id === "string" && item.id !== "");
var strings = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
var filled = (value) => typeof value === "string" && value !== "";
var resolvable = (ref) => ref.kind === "research" && filled(ref.sourceId) || ref.kind === "finding" && filled(ref.findingId) || ref.kind === "page" || ref.kind === "user";
function asStored(brief) {
  const research = isObject(brief.research) ? brief.research : {};
  return {
    narrative: typeof brief.narrative === "string" ? brief.narrative : null,
    messages: withId(brief.messages).map((message) => ({
      ...message,
      sources: objects(message.sources).filter(resolvable)
    })),
    questions: withId(brief.questions),
    research: {
      runs: withId(research.runs),
      sources: withId(research.sources).filter((source) => typeof source.url === "string"),
      findings: withId(research.findings).map((finding) => ({ ...finding, sourceIds: strings(finding.sourceIds) }))
    }
  };
}
function unreadLists(brief) {
  const research = isObject(brief.research) ? brief.research : {};
  return new Set(["runs", "sources", "findings"].filter((list) => !Array.isArray(research[list])));
}
function targetList(issue, brief) {
  if (/^research\.findings\.[^.]+\.runId$/.test(issue.path))
    return "runs";
  if (/^research\.findings\.[^.]+\.sourceIds\.\d+$/.test(issue.path))
    return "sources";
  const ref = /^messages\.([^.]+)\.sources\.(\d+)$/.exec(issue.path);
  if (ref === null)
    return null;
  const message = withId(brief.messages).find((item) => item.id === ref[1]);
  const kind = objects(message?.sources).filter(resolvable)[Number(ref[2])]?.kind;
  return kind === "research" ? "sources" : kind === "finding" ? "findings" : null;
}
function briefRuleFindings(brief) {
  const unread = unreadLists(brief);
  return briefIssues(asStored(brief), new Set).filter((issue) => {
    const target = targetList(issue, brief);
    return target === null || !unread.has(target);
  }).map(findingFromIssue);
}
function briefCapFindings(sections) {
  return briefCapIssues(sections).map(findingFromIssue);
}

// ../../libs/data-types/src/campaignChecks/enums.ts
var DELIVERABLE_VERDICTS = ["advance", "stall", "bounce"];
var QUESTION_COVERAGES = ["full", "partial", "none"];
var INDEPENDENCE_BASES = ["cross-vendor", "cross-family", "same-family", "unknown"];
var SOCIAL_CHANNELS = ["x", "linkedin", "bluesky", "discord"];
var SOURCE_REF_KINDS = ["page", "research", "finding", "user"];
var WRITTEN_BY = ["agent", "person"];
var RESEARCH_MODES = ["competitors", "serp", "keywords", "topic"];
var RESEARCH_CONFIDENCES = ["low", "medium", "high"];
var isOneOf = (values, value) => typeof value === "string" && values.includes(value);

// ../../libs/data-types/src/campaignChecks/checkBrief.ts
var LISTS = {
  messages: (brief) => brief.messages,
  questions: (brief) => brief.questions,
  "research.runs": (brief) => isObject(brief.research) ? brief.research.runs : undefined,
  "research.sources": (brief) => isObject(brief.research) ? brief.research.sources : undefined,
  "research.findings": (brief) => isObject(brief.research) ? brief.research.findings : undefined
};
function missingSections(brief) {
  const missing = ["messages", "questions", "research"].filter((section) => brief[section] == null);
  if (isObject(brief.research)) {
    for (const list of ["runs", "sources", "findings"]) {
      if (brief.research[list] == null)
        missing.push(`research.${list}`);
    }
  }
  return missing;
}
var idOf = (item) => isObject(item) && typeof item.id === "string" && item.id !== "" ? item.id : null;
function listsOf(brief, findings) {
  if (brief.research != null && !isObject(brief.research)) {
    findings.push({ section: "research", id: null, message: "research is not an object" });
  }
  const lists = {};
  for (const [section, pick] of Object.entries(LISTS)) {
    const value = pick(brief);
    if (Array.isArray(value))
      lists[section] = value;
    else {
      if (value != null)
        findings.push({ section, id: null, message: `${section} is not a list` });
      lists[section] = [];
    }
  }
  return lists;
}
function missingIds(section, items, findings) {
  items.forEach((item, index) => {
    if (idOf(item) === null)
      findings.push({ section, id: null, message: `item ${index + 1} in ${section} has no id` });
  });
}
var RESOLVED = new Map([
  ["research", { field: "sourceId", noun: "source" }],
  ["finding", { field: "findingId", noun: "finding" }]
]);
function checkMessages(messages, findings, warnings) {
  for (const message of messages.filter(isObject)) {
    const id = idOf(message);
    const label = id ?? "a message";
    const flag = (text) => findings.push({ section: "messages", id, message: `${label} ${text}` });
    if (!Array.isArray(message.sources) || message.sources.length === 0) {
      flag("has no source; every message needs at least one");
      continue;
    }
    message.sources.forEach((ref, index) => {
      const kind = isObject(ref) ? ref.kind : undefined;
      if (typeof kind !== "string" || kind === "") {
        flag(`has source ${index + 1} with no kind, which is not a SourceRef`);
      } else if (RESOLVED.has(kind)) {
        const { field, noun } = RESOLVED.get(kind);
        const target = ref[field];
        if (typeof target !== "string" || target === "")
          flag(`cites a ${noun} with no ${field}`);
      } else if (!isOneOf(SOURCE_REF_KINDS, kind)) {
        warnings.push({
          section: "messages",
          id,
          message: `${label} cites a source of unknown kind ${JSON.stringify(kind)}, which is not checked`
        });
      }
    });
  }
}
function checkQuestions(questions, audience, findings) {
  if (!isObject(audience) || !Array.isArray(audience.personaIds)) {
    findings.push({ section: "audience", id: null, message: "the audience has no personaIds list" });
    return;
  }
  const personas = new Set(audience.personaIds.map(toInt).filter((id) => id !== null));
  for (const question of questions.filter(isObject)) {
    const id = idOf(question);
    const label = id ?? "a question";
    const persona = toInt(question.personaId);
    if (persona === null) {
      findings.push({
        section: "questions",
        id,
        message: `${label} has no integer personaId (${JSON.stringify(question.personaId) ?? "none"})`
      });
    } else if (!personas.has(persona)) {
      findings.push({
        section: "questions",
        id,
        message: `${label} is for persona ${persona}, which is not in the campaign's audience`
      });
    }
  }
}
function checkBrief(input) {
  const { brief, audience } = input;
  if (!isObject(brief))
    return report([{ section: "brief", id: null, message: "the brief is not an object" }]);
  const missing = missingSections(brief);
  if (missing.length > 0) {
    return refusal("brief", `the brief has no ${missing.join(", ")}; check brief needs the whole brief, read with get_campaign_brief and no sections`);
  }
  const findings = [];
  const warnings = [];
  const lists = listsOf(brief, findings);
  for (const [section, items] of Object.entries(lists))
    missingIds(section, items, findings);
  findings.push(...briefRuleFindings(brief));
  checkMessages(lists.messages, findings, warnings);
  checkQuestions(lists.questions, audience, findings);
  return report(findings, warnings);
}

// ../../libs/data-types/src/campaignChecks/researchMerge.ts
var list = (value) => Array.isArray(value) ? value : [];
var without = (key) => (item) => isObject(item) ? Object.fromEntries(Object.entries(item).filter(([name]) => name !== key)) : item;
function storedSections(brief) {
  return {
    narrative: typeof brief.narrative === "string" ? brief.narrative : null,
    messages: list(brief.messages),
    questions: list(brief.questions).map(without("coveredBy")),
    research: {
      runs: list(brief.research.runs),
      sources: list(brief.research.sources),
      findings: list(brief.research.findings).map(without("stale"))
    }
  };
}
var trimmed = (value) => typeof value === "string" ? value.trim() : value;
var added = (content) => ({ ...content, writtenBy: "agent" });
var runContent = ({ id, mode, topic, ranAt }) => ({
  id,
  mode,
  ...topic !== undefined ? { topic: trimmed(topic) } : {},
  ranAt
});
var sourceContent = ({ id, url, title, retrievedAt, quote }) => ({
  id,
  url: trimmed(url),
  title: trimmed(title),
  retrievedAt,
  quote: trimmed(quote)
});
var findingContent = ({ id, claim, sourceIds, confidence, runId }) => ({
  id,
  claim: trimmed(claim),
  sourceIds,
  confidence,
  runId
});
function applyAppend(sections, append) {
  if (!isObject(append))
    return sections;
  const objects = (value) => list(value).filter(isObject);
  const { research } = sections;
  const sources = [...research.sources, ...objects(append.sources).map((s) => added(sourceContent(s)))];
  for (const { sourceId, retrievedAt, quote } of objects(append.refresh)) {
    const index = sources.findIndex((source) => isObject(source) && source.id === sourceId);
    if (index === -1)
      continue;
    const before = sources[index];
    const refreshed = { ...before, retrievedAt, ...quote !== undefined ? { quote: trimmed(quote) } : {} };
    const changed = refreshed.retrievedAt !== before.retrievedAt || refreshed.quote !== before.quote;
    sources[index] = changed ? added(refreshed) : before;
  }
  return {
    ...sections,
    research: {
      runs: [...research.runs, ...isObject(append.run) ? [added(runContent(append.run))] : []],
      sources,
      findings: [...research.findings, ...objects(append.findings).map((f) => added(findingContent(f)))]
    }
  };
}
function retrievalDates(research) {
  return new Map(research.sources.filter(isObject).map((source) => [source.id, source.retrievedAt]));
}
function staleFindings(research, today) {
  const dates = retrievalDates(research);
  return research.findings.filter(isObject).flatMap((finding) => {
    const cited = list(finding.sourceIds).map((id) => dates.get(id));
    const stale = cited.length > 0 && cited.every((date) => typeof date === "string" && isRetrievalStale(date, today));
    return stale ? [{ finding, newest: cited.sort().at(-1) }] : [];
  });
}
function sectionBytes(sections) {
  return Object.values(briefSectionBytes(sections)).reduce((sum, n) => sum + n, 0);
}
function researchCounts(sections, today) {
  const { runs, sources, findings } = sections.research;
  const stale = staleFindings(sections.research, today).length;
  return {
    runs: runs.length,
    sources: sources.length,
    findings: findings.length,
    stale,
    fresh: findings.length > 0 && stale === 0,
    bytes: sectionBytes(sections)
  };
}

// ../../libs/data-types/src/campaignChecks/planBlock.ts
var PLAN_TITLE = "Plan (campaign-plan)";
var PLAN_LABELS = Object.freeze([
  "Primary keyword",
  "Secondary keyword",
  "Intent",
  "Slug",
  "Canonical URL",
  "Internal links",
  "Messages"
]);
var KEYWORDS = ["Primary keyword", "Secondary keyword"];
var PAGE_TYPES2 = new Set(["new-page", "republish"]);
var KEYWORD_VALUE = /^(.+?) \((F-\d{2,3})\)$/;
var UNRESEARCHED_KEYWORD_VALUE = /^(.+?) \(no research\)$/;
var INTENTS = new Set(["informational", "commercial", "transactional", "navigational"]);
var CLAIM_INTENT = /^\s*([\w-]+) intent\s*;/i;
var normal = (text) => text.trim().replace(/\s+/g, " ").toLowerCase();
var listed = (value) => value.split(",").map((part) => part.trim()).filter(Boolean);
function readPlanBlock(detail) {
  const text = typeof detail === "string" ? detail.replace(/\r\n?/g, `
`) : "";
  const all = text.split(`
`).map((line) => line.trim());
  const start = all.findIndex((line) => line !== "");
  if (start < 0)
    return null;
  const end = all.indexOf("", start);
  const [title, ...lines] = all.slice(start, end < 0 ? undefined : end);
  if (title !== PLAN_TITLE)
    return null;
  const fields = {};
  const missing = [];
  PLAN_LABELS.forEach((label, index) => {
    const line = lines[index] ?? "";
    if (line === `${label}:` || line.startsWith(`${label}: `))
      fields[label] = line.slice(label.length + 1).trim();
    else
      missing.push(label);
  });
  return { fields, missing };
}
function keyword(plan, value) {
  const unresearched = UNRESEARCHED_KEYWORD_VALUE.exec(value);
  if (unresearched) {
    const hasKeywordRuns = [...plan.runsById.values()].some((run) => run.mode === "keywords");
    if (hasKeywordRuns) {
      return {
        findingId: null,
        problem: `is "${value}", but the brief has keywords research; cite its finding (F-nn)`
      };
    }
    return { term: unresearched[1], findingId: null, intent: null, unresearched: true };
  }
  const match = KEYWORD_VALUE.exec(value);
  if (!match)
    return { findingId: null, problem: `is "${value}", which is not written <term> (F-nn)` };
  const [, term, findingId] = match;
  const flaw = (problem) => ({ findingId, problem });
  const finding = plan.findingsById.get(findingId);
  if (finding === undefined)
    return flaw(`cites ${findingId}, which is not a finding on the brief`);
  if (plan.runsById.get(finding.runId)?.mode !== "keywords") {
    return flaw(`cites ${findingId}, which is not from a keywords run`);
  }
  const claim = typeof finding.claim === "string" ? KEYWORD_TERM.exec(finding.claim) : null;
  if (!claim)
    return flaw(`cites ${findingId}, whose claim is not written Keyword "<term>": <intent> intent`);
  const named = claim[1] ?? claim[2];
  if (normal(named) !== normal(term))
    return flaw(`is "${term}", but ${findingId} is about "${named}"`);
  const intent = CLAIM_INTENT.exec(finding.claim.slice(claim[0].length));
  return { term, findingId, intent: intent ? intent[1].toLowerCase() : null };
}
function valueIssues(plan, pillar, fields, [primary, secondary], warnings) {
  const issues = [];
  for (const [label, result] of [
    ["primary keyword", primary],
    ["secondary keyword", secondary]
  ]) {
    if (result.problem)
      issues.push(`'s ${label} ${result.problem}`);
  }
  if (!primary.problem && !secondary.problem) {
    const sameFinding = primary.findingId !== null && primary.findingId === secondary.findingId;
    if (sameFinding || normal(primary.term) === normal(secondary.term)) {
      issues.push(`'s secondary keyword repeats its primary, "${primary.term}"; a pillar targets two keywords`);
    }
  }
  if (primary.unresearched) {
    if (!INTENTS.has(normal(fields.Intent))) {
      issues.push(`'s intent is "${fields.Intent}", not one of ${[...INTENTS].join(", ")}`);
    }
  } else if (!primary.problem) {
    const intent = normal(fields.Intent);
    if (primary.intent === null)
      issues.push(`'s primary keyword cites ${primary.findingId}, whose claim gives no intent`);
    else if (intent !== primary.intent) {
      issues.push(`'s intent is "${fields.Intent}", but ${primary.findingId} gives ${primary.intent}`);
    }
  }
  const links = [...new Set(listed(fields["Internal links"]))].filter((pageId) => pageId !== pillar.pageId);
  if (links.length < 2) {
    const count = links.length === 1 ? "one internal link" : "no internal links";
    issues.push(` has ${count}; a pillar links at least two published pages other than its own`);
  }
  const { Slug: slug, "Canonical URL": url } = fields;
  if (slug === "")
    issues.push(" has no slug");
  else if (!url.startsWith("https://"))
    issues.push(`'s canonical URL ${url || "(none)"} is not https`);
  else if (!url.endsWith(`/${slug}/`))
    issues.push(`'s canonical URL ${url} does not end in /${slug}/`);
  if (pillar.sitePath !== null)
    issues.push(...sitePathIssues(pillar.sitePath, slug, url));
  const unknown = listed(fields.Messages).filter((id) => !plan.messageIds.has(id));
  if (unknown.length > 0)
    issues.push(` carries ${unknown.join(", ")}, which the brief's messages do not hold`);
  const postsSlug = pillar.sitePath === null ? slug : "";
  if (plan.pages !== null)
    issues.push(...pageIssues(plan.pages, pillar, links, postsSlug, warnings));
  return issues;
}
function sitePathIssues(sitePath, slug, url) {
  const route = sitePath.replace(/^src\//, "").replace(/\.hbs$/, "").replace(/(^|\/)index$/, "");
  const name = route.split("/").pop() ?? "";
  const issues = [];
  if (slug !== "" && name !== slug)
    issues.push(`'s file ${sitePath} builds /${route}/, whose last segment is not its slug ${slug}`);
  else if (url.startsWith("https://") && !url.endsWith(`/${route}/`)) {
    issues.push(`'s canonical URL ${url} does not end in /${route}/, the URL its file ${sitePath} builds`);
  }
  return issues;
}
function pageIssues(pages, pillar, links, slug, warnings) {
  const issues = [];
  for (const pageId of links) {
    const page = pages.find((it) => it.pageId === pageId);
    if (page === undefined) {
      const message = `${pillar.label} links ${pageId}, which is not a posts page; check that it is a published page`;
      warnings.push({ section: "planBlock", id: pillar.id, message });
    } else if (page.hasBeenPublished !== true) {
      issues.push(` links ${pageId}, which has never been published; link only published pages`);
    }
  }
  const holder = pages.find((it) => it.slug === slug && it.pageId !== pillar.pageId);
  if (slug !== "" && holder !== undefined) {
    issues.push(`'s slug ${slug} is already page ${holder.pageId}'s; give the post a slug no posts page has`);
  }
  return issues;
}
function heldValues(plan) {
  const pages = new Map;
  for (const item of plan.active) {
    if (item.ref !== null || !PAGE_TYPES2.has(item.type) || item.pageId === null || pages.has(item.pageId))
      continue;
    pages.set(item.pageId, item.label);
  }
  return { pages, slugs: new Map, primaries: new Map };
}
function holderOf(held, key, label) {
  const holder = held.get(key);
  if (holder !== undefined)
    return holder;
  held.set(key, label);
  return null;
}
function repeatIssues(held, pillar, slug, primary) {
  const issues = [];
  const slugHolder = slug === "" ? null : holderOf(held.slugs, slug, pillar.label);
  if (slugHolder !== null)
    issues.push(`'s slug ${slug} is ${slugHolder}'s too; each pillar has its own slug`);
  const termHolder = primary.problem ? null : holderOf(held.primaries, normal(primary.term), pillar.label);
  if (termHolder !== null) {
    issues.push(`'s primary keyword "${primary.term}" (${primary.findingId ?? "no research"}) is ${termHolder}'s primary too; a keyword is the primary of at most one pillar`);
  }
  return issues;
}
var isApproved = (item) => item.row.approvalStatus === "approved";
var approvedFirst = (a, b) => Number(isApproved(b)) - Number(isApproved(a));
function planBlockFindings(plan, findings, warnings) {
  const today = new Date(plan.now).toISOString().slice(0, 10);
  const stale = new Map(staleFindings(plan.research, today).map(({ finding, newest }) => [finding.id, newest]));
  const pillars = plan.active.filter((item) => item.parsed?.kind === "pillar" && item.type === "new-page").sort(approvedFirst);
  const held = heldValues(plan);
  for (const pillar of pillars) {
    const flag = (message) => findings.push({ section: "planBlock", id: pillar.id, message: `${pillar.label}${message}` });
    const pageHolder = pillar.pageId === null ? null : holderOf(held.pages, pillar.pageId, pillar.label);
    if (pageHolder !== null) {
      flag(` links page ${pillar.pageId}, as ${pageHolder} does; a page is planned once, so it is never adopted twice`);
    }
    const block = readPlanBlock(pillar.row.detail);
    if (block === null) {
      flag(` has no plan block; its detail opens with "${PLAN_TITLE}" and the plan's lines`);
      continue;
    }
    if (block.missing.length > 0) {
      flag(`'s plan block has no ${block.missing.map((label) => `"${label}: "`).join(", ")} line in its place`);
      continue;
    }
    const keywords = KEYWORDS.map((label) => keyword(plan, block.fields[label]));
    for (const issue of valueIssues(plan, pillar, block.fields, keywords, warnings))
      flag(issue);
    for (const issue of repeatIssues(held, pillar, block.fields.Slug, keywords[0]))
      flag(issue);
    KEYWORDS.forEach((label, index) => {
      const { findingId } = keywords[index];
      if (!stale.has(findingId))
        return;
      const message = `${pillar.label}'s ${label.toLowerCase()} rests on ${findingId}, which is stale: its newest source was read on ${stale.get(findingId)}`;
      warnings.push({ section: "planBlock", id: pillar.id, message });
    });
  }
}

// ../../libs/data-types/src/campaignChecks/planModel.ts
var CHANNEL_CODES = Object.freeze({
  li: "linkedin",
  x: "x",
  bs: "bluesky",
  dc: "discord"
});
var PILLAR_REF = /^P([1-9]\d*)$/;
var CUT_REF = /^P([1-9]\d*)-(li|x|bs|dc)-([1-9]\d*)$/;
function parseRef(ref) {
  if (PILLAR_REF.test(ref))
    return { kind: "pillar" };
  const cut = CUT_REF.exec(ref);
  return cut ? { kind: "cut", pillar: `P${cut[1]}`, code: cut[2], channel: CHANNEL_CODES[cut[2]] } : null;
}
var MAX_EPOCH_MS = 8640000000000000;
function instantFrom(value) {
  if (typeof value === "number")
    return Math.abs(value) <= MAX_EPOCH_MS ? value : null;
  return isIsoDateTime(value, { seconds: false }) ? Date.parse(value) : null;
}
var hasText = (value) => typeof value === "string" && value.trim() !== "";
var text = (value) => hasText(value) ? value : null;
function planDeliverables(rows, timeZone) {
  return rows.filter(isObject).map((row) => {
    const ref = text(row.ref);
    const at = instantFrom(row.scheduledDate);
    return {
      row,
      ref,
      id: ref ?? String(row.id),
      label: ref ?? `deliverable ${row.id}`,
      parsed: ref === null ? null : parseRef(ref),
      type: row.type,
      channel: text(row.channel),
      account: text(row.account),
      pageId: text(row.pageId),
      sitePath: text(row.sitePath),
      active: row.approvalStatus !== "rejected",
      draft: row.approvalStatus === "draft" || row.approvalStatus == null,
      at,
      local: at === null ? null : localOf(at, timeZone),
      questionIds: list(row.questionIds).filter((id) => typeof id === "string")
    };
  });
}
function pillarOf(active, cut) {
  return active.find((item) => item.parsed?.kind === "pillar" && item.ref === cut.parsed.pillar);
}
var localText = (item) => `${item.local.date} ${item.local.time}`;

// ../../libs/data-types/src/campaignChecks/planDates.ts
var HOUR_MS = 3600000;
function dateFindings(plan, findings) {
  const { startDate, endDate } = plan.campaign;
  const nowIso = new Date(plan.now).toISOString();
  for (const item of plan.active) {
    const flag = (message) => findings.push({ section: "dates", id: item.id, message: `${item.label} ${message}` });
    if (item.at === null) {
      flag("has no scheduledDate that reads as an ISO time or ms epoch");
      continue;
    }
    const { date } = item.local;
    if (isIsoDate(startDate) && date < startDate)
      flag(`is on ${date}, before the campaign starts on ${startDate}`);
    else if (isIsoDate(endDate) && date > endDate)
      flag(`is on ${date}, after the campaign ends on ${endDate}`);
    if (item.draft && item.at <= plan.now) {
      const iso = new Date(item.at).toISOString();
      flag(`is a draft dated ${iso}, at or before now (${nowIso}); approval refuses a past date, so date it later`);
    }
  }
}
var byTime = (a, b) => a.at - b.at || a.label.localeCompare(b.label);
function spacingFindings(plan, findings) {
  const dated = plan.active.filter((item) => item.at !== null);
  const flag = (item, message) => findings.push({ section: "spacing", id: item.id, message });
  for (const cut of dated.filter((item) => item.parsed?.kind === "cut")) {
    const pillar = pillarOf(plan.active, cut);
    if (pillar?.at == null || cut.at >= pillar.at)
      continue;
    flag(cut, `${cut.label} is at ${localText(cut)}, before its pillar ${pillar.label} at ${localText(pillar)}`);
  }
  const { launchDate } = plan.campaign;
  if (isIsoDate(launchDate)) {
    const day = dated.filter((item) => item.local.date === launchDate).sort(byTime);
    day.forEach((item, index) => {
      const before = day[index - 1];
      if (before === undefined || item.at - before.at >= HOUR_MS)
        return;
      const minutes = Math.floor((item.at - before.at) / MINUTE_MS);
      flag(item, `${before.label} and ${item.label} are ${minutes} minutes apart on launch day, ${launchDate}; launch-day deliverables are at least 60 minutes apart`);
    });
  }
  const linkedin = new Map;
  for (const item of dated.filter((it) => it.channel === "linkedin" && it.account !== null)) {
    const key = JSON.stringify([item.account, item.local.date]);
    linkedin.set(key, [...linkedin.get(key) ?? [], item]);
  }
  for (const group of linkedin.values()) {
    if (group.length < 2)
      continue;
    const [first, second] = group.sort(byTime);
    const names = group.map((item) => item.label).join(" and ");
    flag(second, `${names} post from the LinkedIn account ${first.account} on ${first.local.date}; one LinkedIn post per account per day`);
  }
}

// ../../libs/data-types/src/campaignChecks/planRefs.ts
var named = (items) => items.map((item) => item.label).join(", ");
function coverageFindings(plan, findings) {
  for (const question of plan.questions) {
    const listing = (item) => item.questionIds.includes(question.id);
    if (plan.active.some(listing))
      continue;
    const rejected = plan.items.filter((item) => !item.active && listing(item));
    const only = rejected.length === 0 ? "" : `; only rejected ${named(rejected)} ${rejected.length === 1 ? "lists" : "list"} it`;
    findings.push({
      section: "coverage",
      id: question.id,
      message: `${question.id} is listed by no active deliverable${only}`
    });
  }
}
function refIssue(item, active) {
  const { parsed, ref, type } = item;
  if (parsed === null)
    return `${ref} is not a plan ref; a pillar is P<n> and a social cut P<n>-<li|x|bs|dc>-<k>`;
  if (parsed.kind === "pillar") {
    return type === "new-page" ? null : `${ref} is a pillar, so its type is new-page, not ${type}`;
  }
  if (type !== "social")
    return `${ref} is a social cut, so its type is social, not ${type}`;
  if (item.channel !== parsed.channel) {
    return `${ref}'s code ${parsed.code} is ${parsed.channel}, but its channel is ${item.channel ?? "not set"}`;
  }
  const pillar = pillarOf(active, item);
  if (pillar === undefined)
    return `${ref} is a cut of ${parsed.pillar}, which is not an active pillar`;
  if (item.pageId === null || item.pageId === pillar.pageId)
    return null;
  const its = pillar.pageId === null ? "no page" : `page ${pillar.pageId}`;
  return `${ref} links page ${item.pageId}, but its pillar ${pillar.label} links ${its}; a cut links its pillar's page`;
}
function refFindings(plan, findings) {
  const byRef = new Map;
  for (const item of plan.items.filter((it) => it.ref !== null))
    byRef.set(item.ref, [...byRef.get(item.ref) ?? [], item]);
  for (const [ref, items] of byRef) {
    if (items.length < 2 || !items.some((item) => item.active))
      continue;
    findings.push({
      section: "refs",
      id: ref,
      message: `${ref} is the ref of ${items.length} deliverables; a ref is unique within the campaign, a rejected deliverable's included`
    });
  }
  for (const item of plan.active.filter((it) => it.ref !== null)) {
    const message = refIssue(item, plan.active);
    if (message)
      findings.push({ section: "refs", id: item.id, message });
  }
}
function socialFindings(plan, findings) {
  const { channels } = plan.campaign;
  if (!Array.isArray(channels)) {
    findings.push({ section: "social", id: null, message: "the campaign has no channels list; [] means posts only" });
    return;
  }
  const entries = channels.filter(isObject);
  const assets = plan.active.filter((item) => item.parsed !== null);
  const cuts = assets.filter((item) => item.parsed.kind === "cut" && item.type === "social");
  for (const pillar of assets.filter((item) => item.parsed.kind === "pillar" && item.type === "new-page")) {
    for (const { channel, account } of entries) {
      const ofEntry = (cut) => cut.parsed.pillar === pillar.ref && cut.channel === channel && cut.account === account;
      if (cuts.some(ofEntry))
        continue;
      findings.push({
        section: "social",
        id: pillar.id,
        message: `${pillar.label} has no active ${channel} cut for ${account}; each pillar has one for every channel entry`
      });
    }
  }
  for (const cut of plan.active.filter((item) => item.ref !== null && item.type === "social")) {
    if (entries.some(({ channel, account }) => channel === cut.channel && account === cut.account))
      continue;
    findings.push({
      section: "social",
      id: cut.id,
      message: `${cut.label} posts to ${cut.channel ?? "no channel"} as ${cut.account ?? "no account"}, which is not one of the campaign's channels`
    });
  }
}
function personaFindings(plan, findings) {
  for (const item of plan.active.filter((it) => it.ref !== null)) {
    const flag = (message) => findings.push({ section: "persona", id: item.id, message: `${item.label} ${message}` });
    const persona = toInt(item.row.personaId);
    const missing = [persona === null ? "personaId" : null, hasText(item.row.journeyId) ? null : "journeyId"];
    if (missing.some(Boolean))
      flag(`has no ${missing.filter(Boolean).join(" or ")}`);
    else if (!plan.audienceIds.has(persona))
      flag(`is for persona ${persona}, which is not in the campaign's audience`);
    if (item.parsed?.kind === "pillar" && item.questionIds.length === 0) {
      flag("lists no questionIds; a pillar answers at least one question on the brief");
    }
  }
}

// ../../libs/data-types/src/campaignChecks/planWarnings.ts
var them = (ids) => `${ids.join(", ")}, which ${ids.length === 1 ? "is" : "are"}`;
function itemWarnings(plan, item, questions) {
  const notes = [];
  const unknown = item.questionIds.filter((id) => !questions.has(id));
  if (unknown.length > 0)
    notes.push(["questions", `lists ${them(unknown)} not on the brief`]);
  const persona = toInt(item.row.personaId);
  const journey = item.row.journeyId;
  if (persona !== null && hasText(journey)) {
    const elsewhere = item.questionIds.filter((id) => {
      const question = questions.get(id);
      return question !== undefined && (toInt(question.personaId) !== persona || question.journeyId !== journey);
    });
    if (elsewhere.length > 0) {
      notes.push([
        "questions",
        `is for persona ${persona} at ${journey}, but lists ${them(elsewhere)} for another persona or stage`
      ]);
    }
  }
  if (item.parsed?.kind === "cut") {
    const pillar = pillarOf(plan.active, item);
    const extra = pillar === undefined ? [] : item.questionIds.filter((id) => !pillar.questionIds.includes(id));
    if (extra.length > 0)
      notes.push(["questions", `lists ${them(extra)} not listed by its pillar ${pillar.label}`]);
  }
  if (item.type === "social" && !hasText(item.row.assigneeId)) {
    notes.push(["social", "has no assigneeId; give it its channel entry's assignee, or ask who posts it"]);
  }
  return notes;
}
function planWarnings(plan, warnings) {
  const questions = new Map(plan.questions.map((question) => [question.id, question]));
  for (const item of plan.active) {
    for (const [section, note] of itemWarnings(plan, item, questions)) {
      warnings.push({ section, id: item.id, message: `${item.label} ${note}` });
    }
  }
  if (plan.journeys === null)
    return;
  for (const persona of plan.audienceIds) {
    for (const { journeyId } of plan.journeys) {
      const asked = plan.questions.some((q) => toInt(q.personaId) === persona && q.journeyId === journeyId);
      if (asked)
        continue;
      warnings.push({ section: "questions", id: null, message: `persona ${persona} has no question at ${journeyId}` });
    }
  }
}

// ../../libs/data-types/src/campaignChecks/checkPlan.ts
function parseNow(value) {
  if (value === undefined)
    return Date.now();
  if (!isIsoDateTime(value, { seconds: false })) {
    throw new CheckUsageError(`--now must be an ISO time with an offset, such as 2026-11-02T15:00:00Z, not ${value}`);
  }
  return Date.parse(value);
}
function unreadable(input) {
  const { campaign, audience, brief, deliverables } = input;
  if (!isObject(campaign))
    return refusal("campaign", "the campaign is not an object");
  if (!isTimeZone(campaign.timezone)) {
    const zone = JSON.stringify(campaign.timezone) ?? "none";
    return refusal("campaign", `the campaign's timezone ${zone} is not one Intl knows; check plan reads dates in it`);
  }
  if (!isObject(audience) || !Array.isArray(audience.personaIds)) {
    return refusal("audience", "the audience has no personaIds list");
  }
  if (!isObject(brief))
    return refusal("brief", "the brief is not an object");
  const missing = missingSections(brief);
  if (missing.length > 0) {
    return refusal("brief", `the brief has no ${missing.join(", ")}; check plan needs the whole brief, read with get_campaign_brief and no sections`);
  }
  if (!Array.isArray(deliverables))
    return refusal("deliverables", "deliverables is not a list");
  for (const [part, tool] of [
    ["pages", "list_pages"],
    ["journeys", "list_journey_stages"]
  ]) {
    if (input[part] !== undefined && !Array.isArray(input[part])) {
      return refusal(part, `${part} is not a list; give the result of ${tool}, or leave it out`);
    }
  }
  return null;
}
function planOf(input, now) {
  const { campaign, audience, brief } = input;
  const items = planDeliverables(input.deliverables, campaign.timezone);
  const research = {
    runs: list(brief.research.runs),
    sources: list(brief.research.sources),
    findings: list(brief.research.findings)
  };
  return {
    campaign,
    audience,
    audienceIds: new Set(list(audience.personaIds).map(toInt).filter((id) => id !== null)),
    now,
    items,
    active: items.filter((item) => item.active),
    questions: list(brief.questions).filter((q) => isObject(q) && typeof q.id === "string" && q.id !== ""),
    messageIds: new Set(list(brief.messages).map((message) => isObject(message) ? message.id : null)),
    research,
    findingsById: new Map(research.findings.filter(isObject).map((finding) => [finding.id, finding])),
    runsById: new Map(research.runs.filter(isObject).map((run) => [run.id, run])),
    pages: Array.isArray(input.pages) ? input.pages.filter(isObject) : null,
    journeys: Array.isArray(input.journeys) ? input.journeys.filter(isObject) : null
  };
}
function checkPlan(input, flags = {}) {
  const now = parseNow(flags.now);
  const refused = unreadable(input);
  if (refused)
    return refused;
  const plan = planOf(input, now);
  const empty = [
    plan.questions.length === 0 ? "the brief has no questions" : null,
    plan.active.length === 0 ? "no deliverable is active" : null
  ].filter(Boolean);
  if (empty.length > 0) {
    return report([{ section: "plan", id: null, message: `nothing planned: ${empty.join(", and ")}` }]);
  }
  const findings = [];
  const warnings = [];
  coverageFindings(plan, findings);
  refFindings(plan, findings);
  socialFindings(plan, findings);
  personaFindings(plan, findings);
  dateFindings(plan, findings);
  spacingFindings(plan, findings);
  planBlockFindings(plan, findings, warnings);
  planWarnings(plan, warnings);
  return report(findings, warnings);
}

// ../../libs/data-types/src/campaignChecks/postInline.ts
var ASCII_PUNCTUATION = /^[!-/:-@[-`{-~]$/;
var MATH_LABEL = "math ";
var STYLE_CLASS = /^fa-(?:solid|regular|light|thin|duotone|brands|sharp|sharp-duotone|kit)$/;
var isCloser = (text, at) => text[at] === "%" && text[at + 1] === "}";
var isSpace = (char) => char === " " || char === "\t";
function runOf(text, from, length) {
  for (let at = text.indexOf("`", from);at !== -1; ) {
    let end = at;
    while (text[end] === "`")
      end += 1;
    if (end - at === length)
      return at;
    at = text.indexOf("`", end);
  }
  return -1;
}
function outsideCode(text) {
  let out = "";
  let math = false;
  for (let at = 0;at < text.length; ) {
    if (text[at] === "\\" && ASCII_PUNCTUATION.test(text[at + 1] ?? "")) {
      out += "  ";
      at += 2;
      continue;
    }
    if (text[at] !== "`") {
      out += text[at];
      at += 1;
      continue;
    }
    let end = at;
    while (text[end] === "`")
      end += 1;
    const length = end - at;
    const opensMath = length >= 2 && text.startsWith(MATH_LABEL, end);
    const from = end + MATH_LABEL.length;
    const mathClose = !opensMath ? -1 : length === 2 ? text.indexOf("``", from) : runOf(text, from, length);
    const close = mathClose !== -1 ? mathClose : runOf(text, end, length);
    if (close === -1) {
      out += text.slice(at, end);
      at = end;
      continue;
    }
    if (mathClose !== -1)
      math = true;
    out += " ";
    at = close + length;
  }
  return { text: out, math };
}
var PAGE_LINK = /\]\(pageid:([^)#\s]+)/g;
function labelStart(text, close) {
  let depth = 0;
  for (let at = close - 1;at >= 0; at--) {
    if (text[at] === "]")
      depth += 1;
    else if (text[at] === "[") {
      if (depth === 0)
        return at;
      depth -= 1;
    }
  }
  return -1;
}
function pageLinks(text) {
  return [...text.matchAll(PAGE_LINK)].filter((match) => labelStart(text, match.index) !== -1).map((match) => match[1]);
}
function bareEnd(text, at, key) {
  let end = at;
  while (end < text.length && !isSpace(text[end]) && !isCloser(text, end) && text[end] !== '"' && text[end] !== "'") {
    if (key && text[end] === "=")
      break;
    end += 1;
  }
  return end;
}
function readTag(text, at, name) {
  if (!text.startsWith("{%", at))
    return null;
  let pos = at + 2;
  while (isSpace(text[pos]))
    pos += 1;
  if (!text.startsWith(name, pos) || !isSpace(text[pos + name.length]))
    return null;
  pos += name.length;
  while (isSpace(text[pos]))
    pos += 1;
  const args = [];
  while (pos < text.length && !isCloser(text, pos)) {
    const keyEnd = bareEnd(text, pos, true);
    if (keyEnd === pos)
      return null;
    const key = text.slice(pos, keyEnd);
    pos = keyEnd;
    if (text[pos] !== "=")
      args.push([key, true]);
    else if (text[pos + 1] === '"' || text[pos + 1] === "'") {
      const close = text.indexOf(text[pos + 1], pos + 2);
      if (close === -1)
        return null;
      args.push([key, text.slice(pos + 2, close)]);
      pos = close + 1;
    } else {
      const valueEnd = bareEnd(text, pos + 1, false);
      args.push([key, text.slice(pos + 1, valueEnd)]);
      pos = valueEnd;
    }
    const gap = pos;
    while (isSpace(text[pos]))
      pos += 1;
    if (gap === pos && !isCloser(text, pos))
      return null;
  }
  if (!isCloser(text, pos) || args.length === 0)
    return null;
  return { args, end: pos + 2 };
}
function holdsIcon(text) {
  for (let at = text.indexOf("{%");at !== -1; at = text.indexOf("{%", at + 2)) {
    const tag = readTag(text, at, "icon");
    if (tag?.args.some(([key, value]) => value === true && key.startsWith("fa-") && !STYLE_CLASS.test(key))) {
      return true;
    }
  }
  return false;
}
function isIframeLine(line) {
  const text = line.trimStart();
  const tag = readTag(text, 0, "iframe");
  if (tag === null || text.slice(tag.end).trim() !== "")
    return false;
  return tag.args.some(([key, value]) => key === "src" && value !== true);
}

// ../../libs/data-types/src/campaignChecks/postLines.ts
var TRAILING_GROUP = /(?<!%\}[ \t]*)[ \t]*\{(?!%)[^{}\n]*\}[ \t]*$/;
var FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
var HEADING = /^ {0,3}(#{1,6})(?=[ \t]|$)[ \t]*(.*?)[ \t]*#*[ \t]*$/;
var QUOTE = /^ {0,3}> ?/;
var LIST_MARKER = /^ {0,3}(?:[-+*]|(\d{1,9})[.)])(?=[ \t]|$)/;
var THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
var SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
var COMMENT_OPEN = /^ {0,3}<!--/;
var BLOCK_START = /^ {0,3}(?:>|(?:[-+*]|\d{1,9}[.)])(?:[ \t]|$)|#{1,6}(?:[ \t]|$)|`{3,}|~{3,}|<!--)/;
var EMBED_LINE = /^ {0,3}\{%(?![ \t]*icon[ \t]).*%\}[ \t]*$/;
var ALERT_MARKER = /:{3,}(?:[ \t]*\w+)?(?=[\s{]|$)/;
var COLLAPSE_MARKER = /(?:\+{3,}|\+{2,}>)(?=[\s{]|$)/;
var BLOCK_LINE = new RegExp(`^ {0,3}(?:${ALERT_MARKER.source}|${COLLAPSE_MARKER.source}|===|@tab\\b)|${EMBED_LINE.source}`);
var TAB_GROUP_OPEN = /^ {0,3}===tabs-container\b/;
var TAB = /^ {0,3}@tab\b/;
var opensBlock = (text) => HEADING.test(text) || THEMATIC_BREAK.test(text) || BLOCK_LINE.test(text);
var indentOf = (text) => /^ */.exec(text)?.[0].length ?? 0;
function untab(text, column = 0) {
  const lead = /^[ \t>]*/.exec(text)?.[0] ?? "";
  if (!lead.includes("\t"))
    return text;
  let out = "";
  for (const char of lead)
    out += char === "\t" ? " ".repeat(4 - (column + out.length) % 4) : char;
  return out + text.slice(lead.length);
}
function listItem(text, interrupting) {
  if (THEMATIC_BREAK.test(text))
    return null;
  const marker = LIST_MARKER.exec(text);
  if (marker === null)
    return null;
  const after = untab(text.slice(marker[0].length), marker[0].length);
  const blank = after.trim() === "";
  if (interrupting && (blank || marker[1] !== undefined && Number(marker[1]) !== 1))
    return null;
  const spaces = indentOf(after);
  const gap = blank || spaces > 4 ? 1 : spaces;
  return { indent: marker[0].length + gap, rest: blank ? "" : after.slice(gap), kind: marker[0].trim().slice(-1) };
}
function closesFence(text, opened) {
  const marker = FENCE.exec(text);
  return marker !== null && marker[1][0] === opened[0] && marker[1].length >= opened.length && !marker[2].trim();
}
function opensTable(header, row) {
  const line = row.trimStart();
  if (indentOf(row) >= 4 || indentOf(header) >= 4 || !/^[-:|][-:| \t]+$/.test(line) || /^-[ \t]/.test(line)) {
    return false;
  }
  const cells = line.split("|").map((cell) => cell.trim());
  const inner = cells.filter((cell, at) => cell !== "" || at !== 0 && at !== cells.length - 1);
  if (!inner.every((cell) => /^:?-+:?$/.test(cell)))
    return false;
  if (!header.includes("|"))
    return false;
  const heads = header.trim().split(/(?<!\\)\|/);
  if (heads[0].trim() === "")
    heads.shift();
  if (heads.at(-1)?.trim() === "")
    heads.pop();
  return heads.length === inner.length;
}
function tableDepth(header, here) {
  for (let at = 0;at < header.texts.length && header.from + at < here.length; at++) {
    if (opensTable(header.texts[at], here[header.from + at]))
      return header.from + at;
  }
  return -1;
}
function bodyLines(markdown) {
  const blocks = [];
  let open = [];
  let raw = null;
  let paragraph = [];
  let table = false;
  let tabGroups = 0;
  const lists = [];
  let start = null;
  const close = () => {
    paragraph = [];
    table = false;
  };
  for (const source of markdown.replace(/\r\n?/g, `
`).split(`
`)) {
    let text = untab(source.replace(TRAILING_GROUP, ""));
    const here = [text];
    let depth = 0;
    for (;depth < open.length; depth++) {
      if (open[depth] === null) {
        const quote = QUOTE.exec(text);
        if (quote === null)
          break;
        text = text.slice(quote[0].length);
      } else if (text.trim() === "")
        text = "";
      else if (indentOf(text) >= open[depth])
        text = text.slice(open[depth]);
      else
        break;
      here.push(text);
    }
    const header = start;
    start = null;
    const tableAt = table || header === null ? -1 : tableDepth(header, here);
    if (header !== null && tableAt !== -1 && !(tabGroups > 0 && TAB.test(header.texts.at(-1) ?? ""))) {
      const row = header.texts.at(-1) ?? "";
      if (blocks.length > header.block)
        blocks.length = header.block;
      if (TAB_GROUP_OPEN.test(row))
        tabGroups -= 1;
      open = open.slice(0, tableAt);
      lists.length = tableAt;
      raw = null;
      blocks.push({ type: "row", text: row }, { type: "table" });
      close();
      table = true;
      continue;
    }
    if (depth === open.length && raw !== null) {
      if (raw === "<!--" ? text.includes("-->") : closesFence(text, raw))
        raw = null;
      continue;
    }
    if (depth < open.length) {
      if (paragraph.length > 0 && text.trim() !== "" && !BLOCK_START.test(text) && !THEMATIC_BREAK.test(text)) {
        paragraph.push(text);
        blocks.push({ type: "line", text, joins: true });
        continue;
      }
      open = open.slice(0, depth);
      raw = null;
      close();
    }
    if (paragraph.length > 0 && opensTable(paragraph.at(-1) ?? "", text)) {
      blocks.push({ type: "table" });
      close();
      table = true;
      continue;
    }
    if (paragraph.length > 0 && SETEXT.test(text) && !(tabGroups > 0 && text.trim() === "===")) {
      blocks.push({ type: "setext", level: text.trim()[0] === "=" ? 1 : 2, text: paragraph.join(" ") });
      close();
      continue;
    }
    const level = open.length;
    const texts = [text];
    let continues = false;
    for (;; ) {
      if (indentOf(text) >= 4)
        break;
      const quote = QUOTE.exec(text);
      const item = quote === null ? listItem(text, paragraph.length > 0) : null;
      if (quote === null && item === null)
        break;
      if (open.length === level)
        continues = item !== null && lists[level] === item.kind;
      lists.length = open.length;
      if (item !== null)
        lists[open.length] = item.kind;
      open.push(quote === null ? item.indent : null);
      text = quote === null ? item.rest : text.slice(quote[0].length);
      texts.push(text);
      close();
    }
    if (open.length === level && text.trim() !== "")
      lists.length = level;
    const block = blocks.length;
    start = continues ? { from: level + 1, texts: texts.slice(1), block } : { from: level, texts, block };
    if (text.trim() === "") {
      close();
      continue;
    }
    if (indentOf(text) >= 4) {
      if (paragraph.length > 0) {
        paragraph.push(text);
        blocks.push({ type: "line", text, joins: true });
      } else {
        table = false;
        blocks.push({ type: "code" });
      }
      continue;
    }
    const fence = FENCE.exec(text);
    if (fence !== null && !(fence[1][0] === "`" && fence[2].includes("`"))) {
      raw = fence[1];
      close();
      blocks.push({ type: "fence", info: fence[2].trim() });
      continue;
    }
    if (COMMENT_OPEN.test(text)) {
      if (!text.includes("-->"))
        raw = "<!--";
      close();
      continue;
    }
    const joins = paragraph.length > 0 && (EMBED_LINE.test(text) || !opensBlock(text));
    blocks.push({ type: "line", text, joins });
    if (TAB_GROUP_OPEN.test(text))
      tabGroups += 1;
    else if (tabGroups > 0 && text.trim() === "===")
      tabGroups -= 1;
    if (!joins && opensBlock(text))
      close();
    else if (!table)
      paragraph.push(text);
  }
  return blocks;
}

// ../../libs/data-types/src/campaignChecks/postBody.ts
var FORMATTING_FEATURES = Object.freeze({
  codeBlock: Object.freeze({ label: "code blocks", default: true }),
  diagrams: Object.freeze({ label: "diagrams (mermaid)", default: false }),
  mathBlock: Object.freeze({ label: "math blocks", default: false }),
  alert: Object.freeze({ label: "alerts", default: false }),
  icons: Object.freeze({ label: "icons", default: false }),
  tabGroup: Object.freeze({ label: "tab groups", default: false }),
  iframe: Object.freeze({ label: "iframes", default: false }),
  collapsibleBlock: Object.freeze({ label: "collapsible blocks", default: false }),
  table: Object.freeze({ label: "tables", default: false })
});
var IMAGE = /!\[([^\]]*)\]\(/g;
var LINE_FEATURES = [
  [/^ {0,3}:{3,}[ \t]*\w+(?=[\s{]|$)/, "alert"],
  [new RegExp(`^ {0,3}${COLLAPSE_MARKER.source}`), "collapsibleBlock"],
  [/^ {0,3}===tabs-container\b/, "tabGroup"]
];
var MARKER_LINE = new RegExp(`^ {0,3}(?:${ALERT_MARKER.source}|${COLLAPSE_MARKER.source}|===|@tab\\b|\\{%.*%\\}\\s*$)`);
function wordsOf(text) {
  return text.toLowerCase().split(/\s+/).map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter((word) => word !== "");
}
function holdsPhrase(words, phrase) {
  const wanted = wordsOf(phrase);
  if (wanted.length === 0)
    return false;
  for (let at = 0;at + wanted.length <= words.length; at++) {
    if (wanted.every((word, index) => words[at + index] === word))
      return true;
  }
  return false;
}
function plainText(line) {
  if (MARKER_LINE.test(line))
    return "";
  return line.replace(/<!--.*?(?:-->|$)/g, " ").replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\{%[^%]*%\}/g, " ").replace(/\{[^{}]*\}/g, " ").replace(/^\s*#{1,6}\s+/, "").replace(/^\s*\[[ xX]\]\s+/, "").replace(/\|/g, " ").replace(/[*~`]+|(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu, "");
}
function readBody(markdown) {
  const read = {
    h1: [],
    h2: [],
    words: [],
    links: new Set,
    images: [],
    features: new Set
  };
  let inline = [];
  const flush = () => {
    if (inline.length > 0)
      readInline(inline.join(`
`), read);
    inline = [];
  };
  for (const block of bodyLines(markdown)) {
    if (block.type !== "line" || !block.joins)
      flush();
    if (block.type === "fence")
      read.features.add(block.info === "mermaid" ? "diagrams" : "codeBlock");
    else if (block.type === "code")
      read.features.add("codeBlock");
    else if (block.type === "table")
      read.features.add("table");
    else if (block.type === "setext")
      (block.level === 1 ? read.h1 : read.h2).push(block.text);
    else if (block.type === "row") {
      read.words.push(...wordsOf(plainText(block.text)));
      inline.push(block.text);
    } else {
      readLine(block, read);
      inline.push(block.text);
    }
  }
  flush();
  return { ...read, links: [...read.links], features: [...read.features] };
}
function readLine({ text, joins }, read) {
  const heading = HEADING.exec(text);
  if (heading?.[1] === "#")
    read.h1.push(heading[2]);
  if (heading?.[1] === "##")
    read.h2.push(heading[2]);
  for (const [pattern, feature] of LINE_FEATURES)
    if (pattern.test(text))
      read.features.add(feature);
  if (!joins && isIframeLine(text))
    read.features.add("iframe");
  read.words.push(...wordsOf(plainText(text)));
}
function readInline(text, read) {
  const outside = outsideCode(text);
  if (outside.math)
    read.features.add("mathBlock");
  if (holdsIcon(outside.text))
    read.features.add("icons");
  for (const pageId of pageLinks(outside.text))
    read.links.add(pageId);
  for (const [, alt] of outside.text.matchAll(IMAGE))
    read.images.push({ alt });
}

// ../../libs/data-types/src/campaignChecks/reviewResult.ts
var RUBRIC_DIMENSIONS = Object.freeze([
  "clarity",
  "stageRelevance",
  "comprehensiveness",
  "differentiation",
  "funnelAdvance"
]);
var SCORE_RANGE = Object.freeze({ min: 1, max: 5 });
var REVIEW_CAPS = Object.freeze({
  questions: 50,
  objections: 20,
  claims: 50,
  gapFixes: 20,
  gapsOpen: 20,
  text: 500,
  model: 100,
  questionId: 32,
  refId: 64,
  userNote: 280
});
var ISO_DATE_TIME = /^(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))T(?:(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))$/;
var REF_FIELDS = Object.freeze({
  page: ["pageId", REVIEW_CAPS.refId],
  research: ["sourceId", REVIEW_CAPS.refId],
  finding: ["findingId", REVIEW_CAPS.refId],
  user: ["note", REVIEW_CAPS.userNote]
});
var KEYS = [
  "verdict",
  "pass",
  "scores",
  "coveragePct",
  "drafterModel",
  "criticModel",
  "independent",
  "round",
  "reviewedAt",
  "questions",
  "objections",
  "claims",
  "gapFixes",
  "gapsOpen"
];
var OPTIONAL_KEYS = ["independenceBasis"];
var isText = (value, min, max) => typeof value === "string" && value.length >= min && value.length <= max;
function checkSource(source, section, flag) {
  if (source === null)
    return;
  const field = isObject(source) && isOneOf(SOURCE_REF_KINDS, source.kind) ? REF_FIELDS[source.kind] : undefined;
  if (!field)
    return flag(section, `${section} is neither null nor a SourceRef of kind ${SOURCE_REF_KINDS.join(", ")}`);
  const [name, max] = field;
  const extra = Object.keys(source).filter((key) => key !== "kind" && key !== name);
  if (extra.length > 0)
    flag(section, `${section} holds ${extra.join(", ")}, which a ${source.kind} SourceRef does not have`);
  if (!isText(source[name], 1, max))
    flag(section, `${section}.${name} must be text of 1 to ${max} characters`);
}
function checkList(result, key, flag, each) {
  const list = result[key];
  if (list === undefined)
    return;
  if (!Array.isArray(list))
    return flag(key, `${key} is not a list`);
  if (list.length > REVIEW_CAPS[key])
    flag(key, `${key} holds ${list.length} entries; at most ${REVIEW_CAPS[key]}`);
  for (const [index, item] of list.entries())
    each(item, `${key}[${index}]`);
}
function checkTexts(result, key, flag) {
  checkList(result, key, flag, (item, section) => {
    if (!isText(item, 0, REVIEW_CAPS.text))
      flag(section, `${section} must be text of at most ${REVIEW_CAPS.text} characters`);
  });
}
function checkScores(scores, flag) {
  if (!isObject(scores))
    return flag("scores", "scores is not an object");
  for (const key of Object.keys(scores).filter((name) => !RUBRIC_DIMENSIONS.includes(name))) {
    flag(`scores.${key}`, `scores holds ${key}, which the rubric does not score`);
  }
  for (const name of RUBRIC_DIMENSIONS) {
    const value = scores[name];
    if (value === undefined)
      flag(`scores.${name}`, `scores has no ${name}`);
    else if (!Number.isInteger(value) || value < SCORE_RANGE.min || value > SCORE_RANGE.max) {
      const range = `a whole number from ${SCORE_RANGE.min} to ${SCORE_RANGE.max}`;
      flag(`scores.${name}`, `scores.${name} is ${JSON.stringify(value)}; it must be ${range}`);
    }
  }
}
var FIELD_CHECKS = {
  verdict: (value) => isOneOf(DELIVERABLE_VERDICTS, value) || `must be one of ${DELIVERABLE_VERDICTS.join(", ")}`,
  pass: (value) => typeof value === "boolean" || "must be true or false",
  independent: (value) => typeof value === "boolean" || "must be true or false",
  independenceBasis: (value) => isOneOf(INDEPENDENCE_BASES, value) || `must be one of ${INDEPENDENCE_BASES.join(", ")}`,
  coveragePct: (value) => Number.isInteger(value) && value >= 0 && value <= 100 || "must be a whole number from 0 to 100",
  drafterModel: (value) => isText(value, 1, REVIEW_CAPS.model) || `must be text of 1 to ${REVIEW_CAPS.model} characters`,
  criticModel: (value) => isText(value, 1, REVIEW_CAPS.model) || `must be text of 1 to ${REVIEW_CAPS.model} characters`,
  round: (value) => value === 1 || value === 2 || "must be 1 or 2: a review has at most two rounds",
  reviewedAt: (value) => typeof value === "string" && ISO_DATE_TIME.test(value) || "must be an ISO 8601 date-time with Z or an offset"
};
function checkQuestion(item, section, flag) {
  if (!isObject(item))
    return flag(section, `${section} is not an object`);
  const id = isText(item.id, 1, REVIEW_CAPS.questionId) ? item.id : null;
  for (const key of Object.keys(item).filter((name) => !["id", "coverage", "why"].includes(name))) {
    flag(`${section}.${key}`, `${section} holds ${key}, which a question does not have`, id);
  }
  if (id === null)
    flag(`${section}.id`, `${section}.id must be text of 1 to ${REVIEW_CAPS.questionId} characters`);
  if (!isOneOf(QUESTION_COVERAGES, item.coverage)) {
    const allowed = QUESTION_COVERAGES.join(", ");
    flag(`${section}.coverage`, `${section}.coverage is ${JSON.stringify(item.coverage)}; it must be one of ${allowed}`, id);
  }
  if (!isText(item.why, 0, REVIEW_CAPS.text)) {
    flag(`${section}.why`, `${section}.why must be text of at most ${REVIEW_CAPS.text} characters`, id);
  }
}
function checkClaim(item, section, flag) {
  if (!isObject(item))
    return flag(section, `${section} is not an object`);
  for (const key of Object.keys(item).filter((name) => name !== "text" && name !== "source")) {
    flag(`${section}.${key}`, `${section} holds ${key}, which a claim does not have`);
  }
  if (!isText(item.text, 1, REVIEW_CAPS.text)) {
    flag(`${section}.text`, `${section}.text must be text of 1 to ${REVIEW_CAPS.text} characters`);
  }
  if (item.source === undefined)
    flag(`${section}.source`, `${section} has no source; null means it cannot be traced`);
  else
    checkSource(item.source, `${section}.source`, flag);
}
function checkShape(result) {
  const findings = [];
  const flag = (section, message, id = null) => findings.push({ section, id, message });
  if (!isObject(result)) {
    flag("result", "result is not an object");
    return findings;
  }
  for (const key of Object.keys(result).filter((name) => !KEYS.includes(name) && !OPTIONAL_KEYS.includes(name))) {
    if (key === "override") {
      flag(key, "result holds override, which a review never writes: only Accept review on the Plan calendar sets it");
    } else
      flag(key, `result holds ${key}, which a deliverable review does not have`);
  }
  for (const key of KEYS.filter((name) => result[name] === undefined))
    flag(key, `result has no ${key}`);
  for (const [key, check] of Object.entries(FIELD_CHECKS)) {
    const verdict = result[key] === undefined || check(result[key]);
    if (verdict !== true)
      flag(key, `${key} is ${JSON.stringify(result[key])}; it ${verdict}`);
  }
  if (result.scores !== undefined)
    checkScores(result.scores, flag);
  checkList(result, "questions", flag, (item, section) => checkQuestion(item, section, flag));
  checkTexts(result, "objections", flag);
  checkList(result, "claims", flag, (item, section) => checkClaim(item, section, flag));
  checkTexts(result, "gapFixes", flag);
  checkTexts(result, "gapsOpen", flag);
  return findings;
}
var GENERATED_QUESTIONS = Object.freeze({ min: 5, max: 8 });
var GENERATED_ID = /^G-\d{2}$/;
function checkQuestionIds(result, questionIds) {
  if (!isObject(result) || !Array.isArray(result.questions))
    return [];
  const findings = [];
  const flag = (id, message) => findings.push({ section: "questions", id, message });
  const counts = new Map;
  for (const item of result.questions) {
    if (isObject(item) && typeof item.id === "string")
      counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  }
  for (const [id, count] of counts)
    if (count > 1)
      flag(id, `${id} is listed ${count} times in questions`);
  if (questionIds) {
    for (const id of questionIds)
      if (!counts.has(id))
        flag(id, `questions has no entry for ${id}, which the deliverable cites`);
    for (const id of counts.keys()) {
      if (!questionIds.includes(id))
        flag(id, `questions holds ${id}, which is not one of the deliverable's questionIds`);
    }
    return findings;
  }
  const { min, max } = GENERATED_QUESTIONS;
  const count = result.questions.length;
  if (count < min || count > max) {
    flag(null, `the target cites no questions, so the critic writes ${min} to ${max} of its own; questions holds ${count}`);
  }
  for (const id of counts.keys())
    if (!GENERATED_ID.test(id))
      flag(id, `${id} is not a G-nn id, as a question the critic wrote has`);
  return findings;
}
function coverageOf(questions) {
  if (!Array.isArray(questions) || questions.length === 0)
    return null;
  const coverage = questions.map((item) => isObject(item) ? item.coverage : undefined);
  if (!coverage.every((value) => isOneOf(QUESTION_COVERAGES, value)))
    return null;
  const full = coverage.filter((value) => value === "full").length;
  const partial = coverage.filter((value) => value === "partial").length;
  const pct = Math.floor((200 * full + 100 * partial + questions.length) / (2 * questions.length));
  return { full, partial, count: questions.length, pct };
}

// ../../libs/data-types/src/campaignChecks/reviewPacket.ts
var PERSONA_FIELDS = [
  "name",
  "summary",
  "goals",
  "pains",
  "triggers",
  "objections",
  "preferredContent",
  "kpis"
];
var DATA_ID = /\s*(?<![\w-])data-id=(?:"[^"]*"|'[^']*'|[^\s"'}]+)/g;
var GROUP = /([ \t]*)\{([^{}\n]*)\}/g;
function stripAnchors(markdown) {
  const out = [];
  for (const line of markdown.split(`
`)) {
    let anchored = false;
    const stripped = line.replace(GROUP, (whole, space, body) => {
      if (!body.match(DATA_ID))
        return whole;
      anchored = true;
      const rest = body.replace(DATA_ID, "").trim();
      return rest === "" ? "" : `${space}{${rest}}`;
    });
    if (anchored && stripped.trim() === "")
      continue;
    out.push(stripped);
  }
  return out.join(`
`);
}
var refField = (kind) => REF_FIELDS[kind][0];
function refKey(ref) {
  if (!isObject(ref) || !isOneOf(SOURCE_REF_KINDS, ref.kind))
    return null;
  const value = ref[refField(ref.kind)];
  return typeof value === "string" && value !== "" ? `${ref.kind}:${value}` : null;
}
var listOf = (value) => Array.isArray(value) ? value.filter(isObject) : [];
var researchOf = (brief) => isObject(brief.research) ? brief.research : {};
var text2 = (value) => typeof value === "string" ? value : null;
function pageIds(input, content) {
  const ids = [];
  for (const message of listOf(input.brief.messages)) {
    for (const ref of listOf(message.sources))
      if (ref.kind === "page" && typeof ref.pageId === "string")
        ids.push(ref.pageId);
  }
  const context = isObject(input.campaign) && isObject(input.campaign.contextSources) ? input.campaign.contextSources : {};
  for (const id of Array.isArray(context.pageIds) ? context.pageIds : [])
    if (typeof id === "string")
      ids.push(id);
  if (content?.kind === "page")
    ids.push(...readBody(content.markdown).links);
  else if (content)
    for (const [, id] of content.copy.matchAll(/\]\(pageid:([^)#\s]+)/g))
      ids.push(id);
  return [...new Set(ids.filter((id) => id !== ""))];
}
var canonical = (ref) => ({ kind: ref.kind, [refField(ref.kind)]: ref[refField(ref.kind)] });
var sourceFields = (source) => ({
  id: source.id,
  url: text2(source.url),
  title: text2(source.title),
  quote: text2(source.quote),
  retrievedAt: text2(source.retrievedAt)
});
var findingFields = (finding) => ({
  id: finding.id,
  claim: text2(finding.claim),
  sourceIds: Array.isArray(finding.sourceIds) ? finding.sourceIds.filter((id) => typeof id === "string") : [],
  confidence: text2(finding.confidence),
  stale: finding.stale === true
});
function sourcesOf(input, content) {
  const research = researchOf(input.brief);
  const withId = (items) => listOf(items).filter((item) => typeof item.id === "string" && item.id !== "");
  const sources = withId(research.sources).map((source) => ({
    ref: { kind: "research", sourceId: source.id },
    ...sourceFields(source)
  }));
  const findings = withId(research.findings).map((finding) => ({
    ref: { kind: "finding", findingId: finding.id },
    ...findingFields(finding)
  }));
  const resolved = new Map([...sources, ...findings].map(({ ref, ...fields }) => [refKey(ref), fields]));
  const messages = listOf(input.brief.messages).map((message) => ({
    id: text2(message.id),
    text: text2(message.text),
    sources: listOf(message.sources).filter((ref) => refKey(ref) !== null).map((ref) => ({ ref: canonical(ref), ...resolved.get(refKey(ref)) }))
  }));
  const pages = pageIds(input, content).map((pageId) => ({ ref: { kind: "page", pageId } }));
  return { messages, research: { sources, findings }, pages };
}
function holdings(sources) {
  const { messages, research, pages } = sources;
  const notes = messages.flatMap((message) => message.sources.map((source) => source.ref));
  const refs = [...research.sources, ...research.findings, ...pages].map((entry) => entry.ref);
  return new Set([...refs, ...notes.filter((ref) => ref.kind === "user")].map(refKey));
}
var personasOf = (value) => listOf(Array.isArray(value) ? value : isObject(value) ? value.personas : undefined);
var journeysOf = (value) => listOf(Array.isArray(value) ? value : isObject(value) ? value.journeys : undefined);
function audienceParts(input, target) {
  const findings = [];
  const flag = (section, message) => findings.push({ section, id: target.id, message: `${target.label} ${message}` });
  const missing = missingSections(input.brief);
  if (missing.length > 0) {
    flag("brief", `cannot be packed from a brief without ${missing.join(", ")}; read it with get_campaign_brief and no sections`);
  }
  const personaId = toInt(target.personaId);
  const audience = isObject(input.audience) && Array.isArray(input.audience.personaIds) ? input.audience.personaIds : [];
  const persona = personasOf(input.personas).find((it) => personaId !== null && toInt(it.id) === personaId);
  if (personaId === null)
    flag("personaId", "has no persona");
  else if (!audience.map(toInt).includes(personaId))
    flag("personaId", `is for persona ${personaId}, which is not in the campaign's audience`);
  else if (!persona)
    flag("personaId", `is for persona ${personaId}, which list_personas does not return`);
  const journey = journeysOf(input.journeys).find((it) => it.journeyId === target.journeyId);
  if (typeof target.journeyId !== "string" || target.journeyId === "")
    flag("journeyId", "has no journey stage");
  else if (!journey)
    flag("journeyId", `is for journey stage ${target.journeyId}, which is not one of the company's journey stages`);
  const onBrief = new Map(listOf(input.brief.questions).map((question) => [question.id, question]));
  for (const id of target.questionIds ?? []) {
    if (!onBrief.has(id))
      flag("questionIds", `cites question ${id}, which is not on the brief`);
  }
  if (findings.length > 0)
    return { findings };
  return {
    findings,
    persona: Object.fromEntries(PERSONA_FIELDS.map((field) => [field, text2(persona[field])])),
    journey: { journeyId: journey.journeyId, name: text2(journey.name), description: text2(journey.description) },
    questions: (target.questionIds ?? []).map((id) => ({ id, text: text2(onBrief.get(id).text) }))
  };
}
function buildPacket(input, target, content) {
  const parts = audienceParts(input, target);
  if (parts.findings.length > 0)
    return { findings: parts.findings, packet: null };
  const shown = content.kind === "page" ? { kind: "page", markdown: stripAnchors(content.markdown) } : { kind: "social", channel: content.channel, copy: content.copy };
  const { persona, journey, questions } = parts;
  return { findings: [], packet: { persona, journey, questions, sources: sourcesOf(input, content), content: shown } };
}

// ../../libs/data-types/src/campaignChecks/postDetail.ts
var DETAIL_MAX = 1e4;
var DETAIL_BLOCKS = Object.freeze({
  seo: "SEO brief (campaign-draft)",
  image: "Feature image (campaign-draft)",
  claims: "Claims (campaign-draft)",
  hooks: "Hook variants (campaign-draft)"
});
var CLAIM_SOURCE = /^(page|research|finding|user) (\S+)$/;
var REF_FIELD = Object.freeze({
  page: "pageId",
  research: "sourceId",
  finding: "findingId"
});
function detailBlocks(detail) {
  const text = typeof detail === "string" ? detail.replace(/\r\n?/g, `
`) : "";
  const blocks = new Map;
  for (const chunk of text.split(/\n(?:[ \t]*\n)+/)) {
    const [title, ...lines] = chunk.split(`
`).map((line) => line.trim()).filter(Boolean);
    if (title !== undefined && !blocks.has(title))
      blocks.set(title, lines);
  }
  return blocks;
}
var objects2 = (value) => Array.isArray(value) ? value.filter(isObject) : [];
function claimSources(input, markdown) {
  const sources = sourcesOf(input, { kind: "page", markdown });
  return {
    held: holdings(sources),
    stale: new Set(sources.research.findings.filter((finding) => finding.stale).map((finding) => finding.id)),
    messages: objects2(input.brief.messages)
  };
}
function claimIssues({ held, stale, messages }, lines) {
  const problems = [];
  const staleIds = [];
  for (const line of lines) {
    const at = line.lastIndexOf(" | ");
    const source = line.startsWith("- ") && at > 2 ? CLAIM_SOURCE.exec(line.slice(at + 3)) : null;
    if (source === null) {
      problems.push(`claims entry "${line}" is not written "- <claim> | <page|research|finding|user> <id>"`);
      continue;
    }
    const [, kind, id] = source;
    if (kind === "user") {
      const message = messages.find((it) => it.id === id);
      if (message === undefined)
        problems.push(`claim cites user ${id}, which is not a message on the brief`);
      else if (!objects2(message.sources).some((ref) => ref.kind === "user")) {
        problems.push(`claim cites user ${id}, whose message has no user source`);
      }
    } else if (!held.has(refKey({ kind, [REF_FIELD[kind]]: id }))) {
      problems.push(kind === "page" ? `claim cites page ${id}, which no message cites, the campaign does not name as context and the post does not link` : `claim cites ${kind} ${id}, which is not on the brief`);
    } else if (kind === "finding" && stale.has(id))
      staleIds.push(id);
  }
  return { problems, staleIds };
}
function traceClaims(model, id, lines, findings, warnings) {
  const { problems, staleIds } = claimIssues(model.claims, lines);
  for (const problem of problems)
    findings.push({ section: "claims", id, message: `${id}'s ${problem}` });
  for (const findingId of staleIds) {
    const message = `${id} has a claim on ${findingId}, which is stale; refresh its sources or cut the claim`;
    warnings.push({ section: "claims", id, message });
  }
}
function detailFindings(model, findings, warnings) {
  const { ref, pillar } = model;
  const flag = (section, message) => findings.push({ section, id: ref, message });
  const detail = String(pillar.row.detail);
  if (detail.length > DETAIL_MAX) {
    flag("detail", `${ref}'s detail is ${detail.length} characters, over the ${DETAIL_MAX} a deliverable's detail holds`);
  }
  const blocks = detailBlocks(detail);
  for (const title of [DETAIL_BLOCKS.seo, DETAIL_BLOCKS.image, DETAIL_BLOCKS.claims]) {
    if (!blocks.has(title))
      flag("detail", `${ref}'s detail has no "${title}" block below its plan block`);
  }
  const image = blocks.get(DETAIL_BLOCKS.image);
  if (image !== undefined && !image.some((line) => /^Alt text: \S/.test(line))) {
    flag("images", `${ref}'s image brief has no alt text; write it on an "Alt text: " line`);
  }
  const claims = blocks.get(DETAIL_BLOCKS.claims);
  if (claims !== undefined && claims.length === 0)
    flag("detail", `${ref}'s claims list is empty`);
  traceClaims(model, ref, claims ?? [], findings, warnings);
}
function shortLink(domain) {
  const host = domain === null ? "[^/\\s]+" : domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^https://${host}/s/[A-Za-z0-9_-]+$`, "i");
}
function socialFindings2(model, findings, warnings) {
  const short = shortLink(model.domain);
  const cuts = model.items.filter((item) => item.active && item.type === "social" && item.parsed?.kind === "cut" && item.parsed.pillar === model.ref);
  for (const cut of cuts) {
    const flag = (message) => findings.push({ section: "social", id: cut.id, message: `${cut.id}${message}` });
    const copy = cut.row.copy;
    if (typeof copy !== "string" || copy === "") {
      warnings.push({ section: "social", id: cut.id, message: `${cut.id} has no copy yet` });
      continue;
    }
    if (model.pageId !== null && cut.pageId !== model.pageId) {
      flag(` is on page ${cut.pageId ?? "none"}, not its pillar's page ${model.pageId}`);
    }
    const urls = urlsIn(copy);
    const links = copy.split(LINK_PLACEHOLDER).length - 1 + urls.filter((url) => short.test(url)).length;
    if (links !== 1)
      flag(`'s copy holds ${links} links; it holds ${LINK_PLACEHOLDER} exactly once`);
    for (const url of urls.filter((it) => !short.test(it))) {
      flag(`'s copy holds ${url}; the only link social copy holds is ${LINK_PLACEHOLDER}`);
    }
    for (const url of model.domain === null ? urls.filter((it) => short.test(it)) : []) {
      const message = `${cut.id}'s copy holds ${url}, a short link whose host only company (the result of get_company_overview) can confirm`;
      warnings.push({ section: "social", id: cut.id, message });
    }
    const blocks = detailBlocks(cut.row.detail);
    for (const title of [DETAIL_BLOCKS.hooks, DETAIL_BLOCKS.claims].filter((it) => !blocks.has(it))) {
      findings.push({
        section: "detail",
        id: cut.id,
        message: `${cut.id}'s detail has no "${title}" block below its angle`
      });
    }
    traceClaims(model, cut.id, blocks.get(DETAIL_BLOCKS.claims) ?? [], findings, warnings);
  }
}

// ../../libs/data-types/src/campaignChecks/postMeta.ts
var TITLE_MAX = 60;
var SUMMARY_MIN = 140;
var SUMMARY_MAX = 160;
function dateOf(value) {
  if (typeof value === "number" && Number.isFinite(value))
    return new Date(value).toISOString().slice(0, 10);
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}
function lengthFindings(model, flag) {
  const { ref, meta } = model;
  const title = typeof meta.title === "string" ? meta.title : "";
  if (title.length > TITLE_MAX)
    flag("lengths", `${ref}'s title is ${title.length} characters, over ${TITLE_MAX}`);
  const summary = typeof meta.summary === "string" ? meta.summary : "";
  if (summary.length < SUMMARY_MIN || summary.length > SUMMARY_MAX) {
    const length = summary === "" ? "missing" : `${summary.length} characters`;
    flag("lengths", `${ref}'s summary is ${length}; the meta description is ${SUMMARY_MIN} to ${SUMMARY_MAX} characters`);
  }
  if (!list(meta.keywords).some((keyword) => typeof keyword === "string" && keyword.trim() !== "")) {
    flag("lengths", `${ref} has no keywords; give its primary and secondary keywords first`);
  }
}
function fieldFindings(model, flag) {
  const { ref, meta, pillar, campaign } = model;
  if (model.postsType === undefined) {
    flag("metadata", `${ref}: the campaign's posts type ${campaign.postsPageTypeId} is not in list_page_types`);
  }
  if (meta.pageTypeId !== campaign.postsPageTypeId) {
    flag("metadata", `${ref}'s page type is ${meta.pageTypeId}, not the campaign's posts type ${campaign.postsPageTypeId}`);
  }
  for (const label of list(meta.labels).filter((it) => !model.labelIds.has(it))) {
    flag("metadata", `${ref} has label ${label}, which list_labels does not have; use only the company's labels`);
  }
  const authors = list(meta.authors);
  const assignee = typeof pillar.row.assigneeId === "string" ? pillar.row.assigneeId : null;
  for (const author of authors) {
    if (!model.userIds.has(author))
      flag("metadata", `${ref}'s author ${author} is not one of list_users`);
    else if (assignee !== null && author !== assignee) {
      flag("metadata", `${ref}'s author ${author} is not the pillar's assignee, ${assignee}`);
    }
  }
  if (assignee !== null && !authors.includes(assignee)) {
    flag("metadata", `${ref}'s authors leave out the pillar's assignee, ${assignee}`);
  }
  if ((meta.journeyId ?? null) !== (pillar.row.journeyId ?? null)) {
    flag("metadata", `${ref}'s journeyId is ${meta.journeyId ?? "unset"}, not the deliverable's ${pillar.row.journeyId}`);
  }
  const planned = dateOf(meta.plannedDate);
  const expected = pillar.local?.date ?? null;
  if (planned !== expected) {
    flag("metadata", `${ref}'s plannedDate is ${planned ?? "unset"}, not ${expected ?? "unset"}, its scheduledDate's local date in ${campaign.timezone}`);
  }
}
var slashed = (path) => `/${path.replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");
var hrefOf = (url) => canParseUrl(url) ? new URL(url).href : url;
function canonicalFindings(model, flag) {
  const { ref, meta, plan, domain, postsType } = model;
  if (domain === null || postsType === undefined || meta.slug !== plan.Slug)
    return;
  const planned = plan["Canonical URL"];
  const host = domain.toLowerCase();
  const plannedHost = hostKey(planned);
  if (plannedHost === null || plannedHost !== hostKey(`https://${host}`)) {
    flag("canonical", `${ref}'s plan gives the canonical URL ${planned}, which is not on ${domain}; a post's canonical URL is on the company's own site, so revise the plan`);
    return;
  }
  const path = typeof meta.url === "string" ? meta.url : [postsType.slug, meta.slug].filter(Boolean).join("/");
  const own = `https://${host}${slashed(path)}`;
  const isOwn = hrefOf(planned) === hrefOf(own);
  const extra = isObject(meta.extraFrontmatter) ? meta.extraFrontmatter : {};
  const set = typeof extra.canonicalUrl === "string" && extra.canonicalUrl !== "" ? extra.canonicalUrl : null;
  if (isOwn && set !== null) {
    flag("canonical", `${ref} sets canonicalUrl, but its plan's canonical URL is the page's own, ${own}; leave it unset`);
  } else if (!isOwn && set !== planned) {
    flag("canonical", `${ref}'s plan gives the canonical URL ${planned}, not the page's own ${own}, so canonicalUrl is ${planned}, not ${set ?? "unset"}`);
  }
}
function metadataFindings(model, findings) {
  const flag = (section, message) => findings.push({ section, id: model.ref, message });
  lengthFindings(model, flag);
  fieldFindings(model, flag);
  canonicalFindings(model, flag);
}

// ../../libs/data-types/src/campaignChecks/postPage.ts
var OPENING_WORDS = 100;
var MIN_PAGE_LINKS = 2;
var textOf = (value) => typeof value === "string" ? value : "";
function contentFindings(model, flag) {
  const { ref, primary, plan, body, meta } = model;
  const title = textOf(meta.title);
  if (!holdsPhrase(wordsOf(title), primary)) {
    flag("keyword", `${ref}'s title "${title}" does not hold its primary keyword "${primary}"`);
  }
  if (!holdsPhrase(body.words.slice(0, OPENING_WORDS), primary)) {
    flag("keyword", `${ref}'s body does not hold its primary keyword "${primary}" in its first ${OPENING_WORDS} words`);
  }
  for (const heading of body.h1) {
    flag("body", `${ref}'s body has a # heading, "${heading}"; the title is the page's H1, so the body opens with its subhead and its sections are ##`);
  }
  if (meta.slug !== plan.Slug) {
    flag("slug", `${ref}'s slug is ${meta.slug ?? "unset"}, not ${plan.Slug}, the plan block's; the page keeps the plan's slug`);
  }
  const links = body.links.filter((pageId) => pageId !== model.pageId);
  if (links.length < MIN_PAGE_LINKS) {
    flag("links", `${ref} links ${links.length} other page(s) with pageid:; a post links at least ${MIN_PAGE_LINKS}`);
  }
  for (const pageId of listed(plan["Internal links"]).filter((id) => id !== model.pageId)) {
    if (!body.links.includes(pageId)) {
      flag("links", `${ref} does not link ${pageId}, which its plan block names; link it as [label](pageid:${pageId})`);
    }
  }
  for (const image of body.images) {
    if (image.alt.trim() === "")
      flag("images", `${ref}'s body has an image with no alt text; every image carries it`);
  }
}
function blockFindings(model, flag) {
  const type = model.postsType;
  if (type === undefined || type.formattingEnforced === false)
    return;
  const options = type.editorFormattingOptions ?? {};
  for (const feature of model.body.features) {
    const { label, default: on } = FORMATTING_FEATURES[feature];
    const allowed = typeof options[feature] === "boolean" ? options[feature] : on;
    if (allowed)
      continue;
    const instead = feature === "table" ? "; write it as a list" : "; write the post without them";
    flag("blocks", `${model.ref}'s body uses ${label} (${feature}), which the posts type ${type.slug} disables${instead}`);
  }
}
function pageFindings(model, findings) {
  const flag = (section, message) => findings.push({ section, id: model.ref, message });
  contentFindings(model, flag);
  blockFindings(model, flag);
}
function pageWarnings(model, warnings) {
  const { ref, primary, secondary, body, meta } = model;
  const warn = (message) => warnings.push({ section: "keyword", id: ref, message });
  const slug = textOf(meta.slug);
  if (!holdsPhrase(wordsOf(slug.replaceAll("-", " ")), primary.replaceAll("-", " "))) {
    warn(`${ref}'s slug ${slug} does not hold its primary keyword "${primary}"`);
  }
  if (!holdsPhrase(wordsOf(textOf(meta.summary)), primary)) {
    warn(`${ref}'s summary does not hold its primary keyword "${primary}"`);
  }
  if (!body.h2.some((heading) => holdsPhrase(wordsOf(heading), primary))) {
    warn(`${ref} has no ## heading that holds its primary keyword "${primary}"`);
  }
  if (secondary !== null && !holdsPhrase(body.words, secondary)) {
    warn(`${ref}'s body does not hold its secondary keyword "${secondary}"`);
  }
}

// ../../libs/data-types/src/campaignChecks/checkPost.ts
var LISTS2 = [
  ["pageTypes", "list_page_types"],
  ["labels", "list_labels"],
  ["users", "list_users"]
];
function unreadable2(input) {
  const { campaign, brief, page, pageMeta } = input;
  if (!isObject(campaign))
    return refusal("campaign", "the campaign is not an object");
  if (!isTimeZone(campaign.timezone)) {
    const zone = JSON.stringify(campaign.timezone) ?? "none";
    return refusal("campaign", `the campaign's timezone ${zone} is not one Intl knows; check post reads dates in it`);
  }
  if (!isObject(brief))
    return refusal("brief", "the brief is not an object");
  const missing = missingSections(brief);
  if (missing.length > 0) {
    return refusal("brief", `the brief has no ${missing.join(", ")}; check post needs the whole brief, read with get_campaign_brief and no sections`);
  }
  if (!Array.isArray(input.deliverables))
    return refusal("deliverables", "deliverables is not a list");
  if (!isObject(page) || typeof page.markdown !== "string") {
    return refusal("page", "page must be get_page_body's result (markdown, blocks); get_page's result goes in pageMeta");
  }
  if (!isObject(pageMeta) || !isObject(pageMeta.page)) {
    return refusal("pageMeta", "pageMeta must be get_page's result, whose page holds the post's metadata");
  }
  for (const [part, tool] of LISTS2) {
    if (!Array.isArray(input[part]))
      return refusal(part, `${part} is not a list; give the result of ${tool}`);
  }
  return null;
}
function targetOf(input, value) {
  const items = planDeliverables(input.deliverables, input.campaign.timezone);
  const rows = items.map((item) => item.row);
  const pillar = items[rows.indexOf(findDeliverable(rows, value))];
  const stop = (ref, message) => ({ finding: { section: "target", id: ref, message } });
  if (pillar === undefined)
    return stop(value, `no deliverable has id or ref ${value}`);
  const { id: ref, label } = pillar;
  if (!pillar.active)
    return stop(ref, `${label} was rejected; check post checks an active pillar`);
  if (pillar.type !== "new-page") {
    return stop(ref, `${label} is a ${pillar.type} deliverable; check post checks a pillar (new-page) and its cuts with it`);
  }
  const block = readPlanBlock(pillar.row.detail);
  if (block === null) {
    return stop(ref, `${label}'s detail does not open with the plan block, "Plan (campaign-plan)" and its lines`);
  }
  if (block.missing.length > 0) {
    const lines = block.missing.map((name) => `"${name}: "`).join(", ");
    return stop(ref, `${label}'s plan block has no ${lines} line in its place; check plan names the fix`);
  }
  const keywordOf = (value) => KEYWORD_VALUE.exec(value) ?? UNRESEARCHED_KEYWORD_VALUE.exec(value);
  const primary = keywordOf(block.fields["Primary keyword"]);
  if (primary === null) {
    return stop(ref, `${label}'s primary keyword is not written <term> (F-nn); check plan names the fix`);
  }
  const secondary = keywordOf(block.fields["Secondary keyword"]);
  return { items, pillar, plan: block.fields, primary: primary[1], secondary: secondary ? secondary[1] : null };
}
function linkFindings({ ref, pageId, pillar }, findings) {
  if (pageId === null || pillar.pageId === pageId)
    return;
  const message = pillar.pageId === null ? `${ref}'s deliverable links no page, but the post checked is page ${pageId}; set the deliverable's pageId to it` : `${ref}'s deliverable links page ${pillar.pageId}, not page ${pageId}, the post checked`;
  findings.push({ section: "metadata", id: ref, message });
}
var idsOf = (list, key) => new Set(list.filter(isObject).map((item) => item[key]));
function modelOf(input, target) {
  const meta = input.pageMeta.page;
  return {
    ...target,
    campaign: input.campaign,
    ref: target.pillar.id,
    body: readBody(input.page.markdown),
    claims: claimSources(input, input.page.markdown),
    meta,
    pageId: typeof meta.pageId === "string" && meta.pageId !== "" ? meta.pageId : null,
    postsType: input.pageTypes.find((type) => isObject(type) && type.pageTypeId === input.campaign.postsPageTypeId),
    labelIds: idsOf(input.labels, "labelId"),
    userIds: idsOf(input.users, "userId"),
    domain: publicDomain(input.company)
  };
}
function checkPost(input, { deliverable: value }) {
  const refused = unreadable2(input);
  if (refused)
    return refused;
  const target = targetOf(input, value);
  if (target.finding)
    return report([target.finding]);
  const model = modelOf(input, target);
  const findings = [];
  const warnings = [];
  linkFindings(model, findings);
  pageFindings(model, findings);
  metadataFindings(model, findings);
  detailFindings(model, findings, warnings);
  socialFindings2(model, findings, warnings);
  pageWarnings(model, warnings);
  return report(findings, warnings);
}

// ../../libs/data-types/src/campaignChecks/researchItems.ts
var ID = { run: idPattern("R"), source: idPattern("S"), finding: idPattern("F") };
var idOf2 = (item) => isObject(item) && typeof item.id === "string" && item.id !== "" ? item.id : null;
var labelOf = (item, noun) => idOf2(item) ?? `a ${noun}`;
var quoted = (value) => JSON.stringify(value) ?? "nothing";
var named2 = (value) => typeof value === "string" ? value : quoted(value);
function lengthIssue(label, field, value, min, max) {
  if (typeof value !== "string")
    return `${label} has no ${field}`;
  const length = value.trim().length;
  if (length >= min && length <= max)
    return null;
  return `${label}'s ${field} is ${length} characters; it must be ${min}–${max}`;
}
function quoteIssue(label, quote) {
  if (typeof quote !== "string")
    return `${label} has no quote`;
  const text = quote.trim();
  const words = quoteWords(text);
  if (words < 1 || words > BRIEF_LIMITS.quoteWords) {
    return `${label}'s quote is ${words} words; a quote is 1–${BRIEF_LIMITS.quoteWords} words of the page's own text`;
  }
  if (text.length > BRIEF_LIMITS.quoteChars) {
    return `${label}'s quote is ${text.length} characters; a quote is at most ${BRIEF_LIMITS.quoteChars}`;
  }
  return null;
}
function dateIssue(label, field, value, { from, since = "the day the run started", today }) {
  if (!isIsoDate(value))
    return `${label}'s ${field} is ${quoted(value)}, not a date written YYYY-MM-DD`;
  if (from && value < from)
    return `${label}'s ${field} ${value} is before ${from}, ${since}`;
  if (value > today)
    return `${label}'s ${field} ${value} is later than today, ${today}`;
  return null;
}
function runIssues(run, { today, seconds = true }) {
  const label = labelOf(run, "run");
  const issues = [];
  if (typeof run.id !== "string" || !ID.run.test(run.id)) {
    issues.push(`${label}'s id must be R- and two or three digits`);
  }
  if (!isOneOf(RESEARCH_MODES, run.mode)) {
    issues.push(`${label}'s mode is ${quoted(run.mode)}; it must be one of ${RESEARCH_MODES.join(", ")}`);
  }
  if (run.topic !== undefined) {
    const issue = lengthIssue(label, "topic", run.topic, 1, BRIEF_LIMITS.runTopic);
    if (issue)
      issues.push(issue);
  } else if (run.mode === "topic") {
    issues.push(`${label} is a topic run with no topic; a topic run needs its topic`);
  }
  if (!isIsoDateTime(run.ranAt, { seconds })) {
    const form = seconds ? "an ISO time with seconds and an offset" : "an ISO time with an offset";
    issues.push(`${label}'s ranAt is ${quoted(run.ranAt)}, not ${form}`);
  } else if ((utcDate(run.ranAt) ?? "") > today) {
    issues.push(`${label}'s ranAt ${run.ranAt} is later than today, ${today}`);
  }
  return issues;
}
function urlIssue(label, url, { fragment = false } = {}) {
  if (typeof url !== "string")
    return `${label} has no url`;
  if (url !== url.trim() || !/^https?:\/\//i.test(url))
    return `${label}'s url ${quoted(url)} is not an http(s) URL`;
  if (!canParseUrl(url))
    return `${label}'s url ${quoted(url)} does not parse as a URL`;
  if (url.length > BRIEF_LIMITS.sourceUrl) {
    return `${label}'s url is ${url.length} characters; it must be at most ${BRIEF_LIMITS.sourceUrl}`;
  }
  if (!fragment && url.includes("#")) {
    return `${label}'s url has a fragment; store the URL finally fetched, without its #fragment`;
  }
  return null;
}
function sourceIssues(source, { today, from, domains, pending = true }) {
  const label = labelOf(source, "source");
  const issues = [
    typeof source.id !== "string" || !ID.source.test(source.id) ? `${label}'s id must be S- and two or three digits` : null,
    urlIssue(label, source.url, { fragment: !pending }),
    lengthIssue(label, "title", source.title, pending ? 1 : 0, BRIEF_LIMITS.sourceTitle),
    dateIssue(label, "retrievedAt", source.retrievedAt, { from, today }),
    quoteIssue(label, source.quote)
  ];
  if (domains && typeof source.url === "string" && onDomains(source.url, domains)) {
    issues.push(`${label} is on the company's own site; read it through the CMS, never as a research source`);
  }
  return issues.filter(Boolean);
}
function citedSources(finding, sources) {
  return (Array.isArray(finding.sourceIds) ? finding.sourceIds : []).map((id) => sources.get(id)).filter((source) => isObject(source) && typeof source.url === "string");
}
function findingIssues(finding, { sources, keywords }) {
  const label = labelOf(finding, "finding");
  const issues = [];
  if (typeof finding.id !== "string" || !ID.finding.test(finding.id)) {
    issues.push(`${label}'s id must be F- and two or three digits`);
  }
  const claim = lengthIssue(label, "claim", finding.claim, 1, BRIEF_LIMITS.findingClaim);
  if (claim)
    issues.push(claim);
  const ids = Array.isArray(finding.sourceIds) ? finding.sourceIds : [];
  if (ids.length < 1 || ids.length > BRIEF_LIMITS.findingSources) {
    issues.push(`${label} cites ${ids.length} sources; a finding cites 1–${BRIEF_LIMITS.findingSources}`);
  }
  for (const id of ids.filter((id) => !sources.has(id))) {
    issues.push(`${label} cites ${named2(id)}, which is not a source on the brief or in this run`);
  }
  if (!isOneOf(RESEARCH_CONFIDENCES, finding.confidence)) {
    issues.push(`${label}'s confidence is ${quoted(finding.confidence)}; it must be one of low, medium, high`);
  }
  const cited = citedSources(finding, sources);
  const hosts = new Set(cited.map((source) => hostKey(source.url)).filter(Boolean));
  if (finding.confidence === "high" && hosts.size < 2) {
    issues.push(`${label} is high confidence with its sources on fewer than two hosts; high needs two`);
  }
  if (typeof finding.claim !== "string")
    return issues;
  for (const handle of new Set(handles(finding.claim))) {
    const shown = cited.some((source) => urlShowsHandle(source.url, handle) || quoteShowsHandle(String(source.quote), handle));
    if (!shown)
      issues.push(`${label} names @${handle}, which no cited source's URL or quote shows`);
  }
  if (keywords) {
    const given = new Set(cited.flatMap((source) => [...figures(String(source.quote))]));
    const unquoted = new Map;
    for (const { text, value } of claimNumbers(finding.claim)) {
      if (!given.has(value) && !unquoted.has(value))
        unquoted.set(value, text);
    }
    for (const text of unquoted.values()) {
      issues.push(`${label} states ${text}, which no cited source's quote gives; a keywords claim states a number only from ` + `a cited quote, the keyword term's and ISO dates aside, so drop it, and say "qualitative" for a volume`);
    }
  }
  return issues;
}
function refreshIssues(refresh, { stored, appended, today }) {
  const label = typeof refresh.sourceId === "string" && refresh.sourceId !== "" ? refresh.sourceId : "a refresh";
  const source = stored.get(refresh.sourceId);
  if (!isObject(source)) {
    return appended.has(refresh.sourceId) ? [`${label} is new in this run; a refresh re-dates a source already on the brief`] : [`${label} is not a source on the brief to refresh`];
  }
  const from = isIsoDate(source.retrievedAt) ? source.retrievedAt : undefined;
  const since = "the date it was last read";
  const issues = [dateIssue(label, "retrievedAt", refresh.retrievedAt, { from, since, today })];
  if (refresh.quote !== undefined)
    issues.push(quoteIssue(label, refresh.quote));
  return issues.filter(Boolean);
}

// ../../libs/data-types/src/campaignChecks/researchRules.ts
var KEYS2 = {
  appendResearch: ["run", "sources", "findings", "refresh"],
  run: ["id", "mode", "topic", "ranAt", "writtenBy"],
  sources: ["id", "url", "title", "retrievedAt", "quote", "writtenBy"],
  findings: ["id", "claim", "sourceIds", "confidence", "runId", "writtenBy", "stale"],
  refresh: ["sourceId", "retrievedAt", "quote"]
};
function shapeIssues(item, keys, label) {
  const issues = Object.keys(item).filter((key) => !keys.includes(key)).map((key) => `${label} has ${JSON.stringify(key)}, which the CMS does not take there`);
  if (keys.includes("writtenBy") && item.writtenBy !== undefined && !isOneOf(WRITTEN_BY, item.writtenBy)) {
    issues.push(`${label}'s writtenBy must be ${WRITTEN_BY.join(" or ")}`);
  }
  if (keys.includes("stale") && item.stale !== undefined && typeof item.stale !== "boolean") {
    issues.push(`${label}'s stale must be true or false`);
  }
  return issues;
}
var free = (id) => id ?? "a free number";
function objectsOf(items, section, flag) {
  return items.filter((item, index) => {
    if (!isObject(item))
      flag(section, null, `item ${index + 1} in ${section} is not an object`);
    return isObject(item);
  });
}
function checkRun(append, lists, { stored, today, next }, flag) {
  const section = "appendResearch.run";
  if (append.run === undefined) {
    if (lists.sources.length > 0 || lists.findings.length > 0) {
      flag(section, null, "new sources and findings need a run");
    } else if (lists.refresh.length === 0) {
      flag("appendResearch", null, "send a run, or refresh at least one source");
    }
    return null;
  }
  if (!isObject(append.run)) {
    flag(section, null, "the run is not an object");
    return null;
  }
  const run = append.run;
  const id = idOf2(run);
  const label = labelOf(run, "run");
  const issues = [...shapeIssues(run, KEYS2.run, label), ...runIssues(run, { today })];
  if (id && stored.runs.has(id))
    issues.push(`${id} is already a run on the brief; number this run ${free(next.run)}`);
  for (const issue of issues)
    flag(section, id, issue);
  return run;
}
function checkSources(sources, cited, { stored, today, from, domains, next }, flag) {
  const section = "appendResearch.sources";
  const ids = new Set;
  const urls = new Map;
  for (const source of sources) {
    const id = idOf2(source);
    const label = labelOf(source, "source");
    const issues = [...shapeIssues(source, KEYS2.sources, label), ...sourceIssues(source, { today, from, domains })];
    if (id && stored.sources.has(id)) {
      issues.push(`${id} is already a source on the brief; number new sources from ${free(next.source)}`);
    } else if (id && ids.has(id)) {
      issues.push(`${id} is used by more than one new source`);
    }
    if (typeof source.url === "string") {
      const key = sourceUrlKey(source.url);
      if (stored.urls.has(key)) {
        issues.push(`${label}'s URL is already on the brief as ${stored.urls.get(key)}; refresh that source instead`);
      } else if (urls.has(key)) {
        issues.push(`${label} has the same URL as ${urls.get(key)}; no two sources on a brief share a URL`);
      } else {
        urls.set(key, label);
      }
    }
    if (id && !cited.has(id))
      issues.push(`${id} is cited by no new finding; a run adds only the sources it cites`);
    if (id)
      ids.add(id);
    for (const issue of issues)
      flag(section, id, issue);
  }
}
function checkFindings(findings, { stored, sources, run, next }, flag) {
  const section = "appendResearch.findings";
  const keywords = run?.mode === "keywords";
  const runId = idOf2(run);
  const ids = new Set;
  for (const finding of findings) {
    const id = idOf2(finding);
    const label = labelOf(finding, "finding");
    const issues = [...shapeIssues(finding, KEYS2.findings, label), ...findingIssues(finding, { sources, keywords })];
    if (id && stored.findings.has(id)) {
      issues.push(`${id} is already a finding on the brief; number new findings from ${free(next.finding)}`);
    } else if (id && ids.has(id)) {
      issues.push(`${id} is used by more than one new finding`);
    }
    if (runId && finding.runId !== runId) {
      issues.push(`${label}'s runId is ${JSON.stringify(finding.runId) ?? "missing"}; a finding in this run has ${runId}`);
    }
    if (id)
      ids.add(id);
    for (const issue of issues)
      flag(section, id, issue);
  }
}
function checkRefresh(refresh, appended, { stored, today }, flag) {
  const section = "appendResearch.refresh";
  const ids = new Set;
  for (const item of refresh) {
    const id = typeof item.sourceId === "string" && item.sourceId !== "" ? item.sourceId : null;
    const issues = [
      ...shapeIssues(item, KEYS2.refresh, id ?? "a refresh"),
      ...refreshIssues(item, { stored: stored.sources, appended, today })
    ];
    if (id && ids.has(id))
      issues.push(`${id} is refreshed more than once in this write; send one refresh per source`);
    if (id)
      ids.add(id);
    for (const issue of issues)
      flag(section, id, issue);
  }
}
function storedIndex(research) {
  const sources = new Map(research.sources.filter(isObject).map((source) => [source.id, source]));
  const urls = new Map;
  for (const source of research.sources.filter((it) => isObject(it) && typeof it.url === "string")) {
    const key = sourceUrlKey(source.url);
    if (!urls.has(key))
      urls.set(key, source.id);
  }
  return {
    runs: new Set(research.runs.map(idOf2).filter(Boolean)),
    sources,
    findings: new Set(research.findings.map(idOf2).filter(Boolean)),
    urls
  };
}
function pendingFindings(append, sections, { today, domains, next, merged }) {
  const found = [];
  const flag = (section, id, message) => found.push({ section, id, message });
  if (!isObject(append)) {
    flag("appendResearch", null, "appendResearch is not an object; send { run, sources, findings, refresh }");
    return found;
  }
  for (const issue of shapeIssues(append, KEYS2.appendResearch, "appendResearch"))
    flag("appendResearch", null, issue);
  const lists = {};
  for (const name of ["sources", "findings", "refresh"]) {
    const section = `appendResearch.${name}`;
    const value = append[name];
    if (value !== undefined && !Array.isArray(value))
      flag(section, null, `${section} is not a list`);
    else if (value === undefined && name !== "refresh")
      flag(section, null, `${section} is required; send [] for none`);
    lists[name] = Array.isArray(value) ? value : [];
  }
  const stored = storedIndex(sections.research);
  const ctx = { stored, today, domains, next };
  const run = checkRun(append, lists, ctx, flag);
  const sources = objectsOf(lists.sources, "appendResearch.sources", flag);
  const findings = objectsOf(lists.findings, "appendResearch.findings", flag);
  const cited = new Set(findings.flatMap((finding) => Array.isArray(finding.sourceIds) ? finding.sourceIds : []));
  checkSources(sources, cited, { ...ctx, from: utcDate(run?.ranAt) ?? undefined }, flag);
  const all = new Map(merged.research.sources.filter(idOf2).map((source) => [source.id, source]));
  checkFindings(findings, { ...ctx, sources: all, run }, flag);
  const appended = new Set(sources.map(idOf2).filter(Boolean));
  checkRefresh(objectsOf(lists.refresh, "appendResearch.refresh", flag), appended, ctx, flag);
  return found;
}
function capUsage(counts) {
  return [
    { section: "research.runs", noun: "runs", count: counts.runs, cap: BRIEF_LIMITS.runs },
    { section: "research.sources", noun: "sources", count: counts.sources, cap: BRIEF_LIMITS.sources },
    { section: "research.findings", noun: "findings", count: counts.findings, cap: BRIEF_LIMITS.findings },
    { section: "brief", noun: "bytes", count: counts.bytes, cap: MAX_BRIEF_BYTES }
  ];
}

// ../../libs/data-types/src/campaignChecks/researchWarnings.ts
var claimKey = (claim) => typeof claim === "string" ? claim.toLowerCase().replace(/\s+/g, " ").trim().replace(/[.!?;:,]+$/, "") : null;
function staleWarnings(merged, today, warn) {
  for (const { finding, newest } of staleFindings(merged.research, today)) {
    warn("research.findings", finding.id ?? null, `${finding.id} is stale: every source it cites was read more than 90 days ago, the newest on ${newest}`);
  }
}
function uncitedWarnings(stored, merged, warn) {
  const cited = new Set(merged.research.findings.filter(isObject).flatMap((finding) => list(finding.sourceIds)));
  for (const source of stored.research.sources.filter(isObject)) {
    if (!cited.has(source.id))
      warn("research.sources", source.id, `no finding cites ${source.id}`);
  }
}
var pageKey = (url) => sourceUrlKey(url).replace(/^https?:\/\//, "");
function contextWarnings(campaign, merged, domains, warn) {
  const urls = isObject(campaign) && isObject(campaign.contextSources) ? list(campaign.contextSources.urls) : [];
  const keys = new Set(merged.research.sources.filter((s) => isObject(s) && typeof s.url === "string").map((s) => pageKey(s.url)));
  for (const url of urls.filter((it) => typeof it === "string")) {
    if (domains && onDomains(url, domains))
      continue;
    if (!keys.has(pageKey(url))) {
      warn("campaign.contextSources", null, `the campaign names ${url} as context, and no source on the brief has it`);
    }
  }
}
function schemeTwinWarnings(stored, append, warn) {
  if (!isObject(append))
    return;
  const pages = new Map;
  for (const source of stored.research.sources.filter((s) => isObject(s) && typeof s.url === "string")) {
    if (!pages.has(pageKey(source.url)))
      pages.set(pageKey(source.url), source);
  }
  for (const source of list(append.sources).filter((s) => isObject(s) && typeof s.url === "string")) {
    const twin = pages.get(pageKey(source.url));
    if (twin && sourceUrlKey(twin.url) !== sourceUrlKey(source.url)) {
      const label = source.id ?? "a new source";
      warn("appendResearch.sources", source.id ?? null, `${label}'s URL is ${twin.id}'s over another scheme; if it is the same page, refresh ${twin.id} instead`);
    }
  }
}
function runWarnings(stored, append, warn) {
  if (!isObject(append))
    return;
  const storedClaims = new Map;
  for (const finding of stored.research.findings.filter(isObject)) {
    const key = claimKey(finding.claim);
    if (key && !storedClaims.has(key))
      storedClaims.set(key, finding.id);
  }
  const findings = list(append.findings).filter(isObject);
  for (const finding of findings) {
    const repeated = storedClaims.get(claimKey(finding.claim));
    if (repeated) {
      warn("appendResearch.findings", finding.id ?? null, `${finding.id} repeats ${repeated}'s claim; refresh ${repeated}'s sources instead of adding the claim again`);
    }
  }
  const run = isObject(append.run) ? append.run : null;
  if (run && findings.length === 0 && list(append.sources).length === 0) {
    warn("appendResearch.run", run.id ?? null, `${run.id} adds no sources or findings, yet spends one of the ${BRIEF_LIMITS.runs} runs; a refresh needs no run`);
  }
  if (run && findings.length > 0 && findings.every((finding) => finding.confidence === "low")) {
    warn("appendResearch.run", run.id ?? null, `every finding in ${run.id} is low confidence`);
  }
}
function capWarnings(counts, warn) {
  for (const { section, noun, count, cap } of capUsage(counts)) {
    if (count >= cap * 0.9 && count <= cap) {
      warn(section, null, `the brief would hold ${count} of its ${cap} ${noun}, 90% or more of the cap`);
    }
  }
}
function storedRuleWarnings(merged, stored, { today, domains }, warn) {
  const runs = new Map(merged.research.runs.filter(isObject).map((run) => [run.id, run]));
  const sources = new Map(merged.research.sources.filter(isObject).map((source) => [source.id, source]));
  for (const run of stored.research.runs.filter(isObject)) {
    for (const issue of runIssues(run, { today, seconds: false }))
      warn("research.runs", run.id ?? null, issue);
  }
  for (const source of merged.research.sources.slice(0, stored.research.sources.length).filter(isObject)) {
    for (const issue of sourceIssues(source, { today, domains, pending: false })) {
      warn("research.sources", source.id ?? null, issue);
    }
  }
  for (const finding of stored.research.findings.filter(isObject)) {
    const keywords = runs.get(finding.runId)?.mode === "keywords";
    const issues = findingIssues(finding, { sources, keywords });
    if (!runs.has(finding.runId))
      issues.push(`${finding.id}'s run ${finding.runId} is not on the brief`);
    for (const issue of issues)
      warn("research.findings", finding.id ?? null, issue);
  }
}
function researchWarnings({ stored, merged, append, campaign, domains, counts, today }) {
  const warnings = [];
  const warn = (section, id, message) => warnings.push({ section, id, message });
  staleWarnings(merged, today, warn);
  uncitedWarnings(stored, merged, warn);
  contextWarnings(campaign, merged, domains, warn);
  schemeTwinWarnings(stored, append, warn);
  runWarnings(stored, append, warn);
  capWarnings(counts, warn);
  storedRuleWarnings(merged, stored, { today, domains }, warn);
  if (domains === null && isObject(append) && list(append.sources).length > 0) {
    warn("company", null, "the input has no company, so the new sources were not checked against the company's own domains; " + "add get_company_overview's result as company");
  }
  return warnings;
}

// ../../libs/data-types/src/campaignChecks/checkResearch.ts
function parseToday(value) {
  if (value === undefined)
    return new Date().toISOString().slice(0, 10);
  if (!isIsoDate(value))
    throw new CheckUsageError(`--today must be a date written YYYY-MM-DD, not ${value}`);
  return value;
}
function missingSections2(brief) {
  const missing = brief.narrative === undefined ? ["narrative"] : [];
  missing.push(...["messages", "questions", "research"].filter((section) => brief[section] == null));
  if (isObject(brief.research)) {
    for (const name of ["runs", "sources", "findings"]) {
      if (brief.research[name] == null)
        missing.push(`research.${name}`);
    }
  }
  return missing;
}
function shapeFindings(brief) {
  const findings = [];
  const flag = (section, message) => findings.push({ section, id: null, message });
  if (brief.narrative !== null && typeof brief.narrative !== "string") {
    flag("narrative", "narrative is not text or null");
  }
  for (const section of ["messages", "questions"]) {
    if (!Array.isArray(brief[section]))
      flag(section, `${section} is not a list`);
  }
  if (!isObject(brief.research))
    flag("research", "research is not an object");
  else {
    for (const name of ["runs", "sources", "findings"]) {
      if (!Array.isArray(brief.research[name]))
        flag(`research.${name}`, `research.${name} is not a list`);
    }
  }
  return findings;
}
function companyDomains(company) {
  if (!isObject(company))
    return null;
  return [company.public, company.preview].map((site) => isObject(site) ? site.domain : null).filter((domain) => typeof domain === "string" && domain.trim() !== "");
}
function checkResearch(input, flags = {}) {
  const today = parseToday(flags.today);
  const { brief, campaign } = input;
  if (!isObject(brief))
    return report([{ section: "brief", id: null, message: "the brief is not an object" }]);
  const missing = missingSections2(brief);
  if (missing.length > 0) {
    return refusal("brief", `the brief has no ${missing.join(", ")}; ` + "check research needs the whole brief, read with get_campaign_brief and no sections");
  }
  const shape = shapeFindings(brief);
  if (shape.length > 0)
    return report(shape);
  const stored = storedSections(brief);
  const { runs, sources, findings: storedFindings } = stored.research;
  const next = {
    run: nextId("R", runs.map(idOf2)),
    source: nextId("S", sources.map(idOf2)),
    finding: nextId("F", storedFindings.map(idOf2))
  };
  const domains = companyDomains(input.company);
  const pending = input.appendResearch !== undefined;
  const append = pending ? input.appendResearch : null;
  const merged = pending ? applyAppend(stored, append) : stored;
  const findings = pending ? pendingFindings(append, stored, { today, domains, next, merged }) : [];
  const counts = researchCounts(merged, today);
  if (pending)
    findings.push(...briefCapFindings(merged));
  const warnings = researchWarnings({ stored, merged, append, campaign, domains, counts, today });
  const { document, code } = report(findings, warnings);
  return { document: { ...document, next, research: counts }, code };
}

// ../../libs/data-types/src/campaignChecks/modelFamilies.ts
var claude = (family) => ({ family, vendor: "anthropic", pattern: new RegExp(family) });
var openai = (family, pattern) => ({ family, vendor: "openai", pattern });
var KNOWN_FAMILIES = Object.freeze([
  claude("opus"),
  claude("sonnet"),
  claude("haiku"),
  claude("fable"),
  openai("gpt-5", /^gpt-5(?:[.-]|$)/),
  openai("gpt-4.5", /^gpt-4\.5(?:-|$)/),
  openai("gpt-4.1", /^gpt-4\.1(?:-|$)/),
  openai("gpt-4o", /^(?:chat)?gpt-4o(?:-|$)/),
  openai("gpt-4", /^gpt-4(?:-|$)/),
  openai("gpt-3.5", /^gpt-3\.5(?:-|$)/),
  openai("o1", /^o1(?:-|$)/),
  openai("o3", /^o3(?:-|$)/),
  openai("o4", /^o4(?:-|$)/)
]);
var CLAUDE_FAMILIES = Object.freeze(KNOWN_FAMILIES.filter((row) => row.vendor === "anthropic").map((row) => row.family));
var ALIAS = new RegExp(`^(?:${CLAUDE_FAMILIES.join("|")})(?:\\[[^\\]]*\\])?$`);
var SNAPSHOT_SUFFIX = /(?:-\d{4}-\d{2}-\d{2}|-\d{8}|@.*)$/;
function knownFamily(id) {
  if (typeof id !== "string")
    return null;
  const lower = id.trim().toLowerCase();
  if (lower === "" || lower === "unknown" || ALIAS.test(lower))
    return null;
  const stripped = lower.replace(SNAPSHOT_SUFFIX, "");
  return KNOWN_FAMILIES.find((row) => row.pattern.test(stripped)) ?? null;
}
function independenceOf(drafterModel, criticModel) {
  const drafter = knownFamily(drafterModel);
  const critic = knownFamily(criticModel);
  const families = { drafterFamily: drafter?.family ?? null, criticFamily: critic?.family ?? null };
  if (!drafter || !critic)
    return { independent: false, basis: "unknown", ...families };
  if (drafter.family === critic.family)
    return { independent: false, basis: "same-family", ...families };
  const basis = drafter.vendor === critic.vendor ? "cross-family" : "cross-vendor";
  return { independent: true, basis, ...families };
}

// ../../libs/data-types/src/campaignChecks/review.ts
var SCORE_FLOOR = 3;
var COVERAGE_FLOOR = 80;
var UNTRACED_ALLOWED = 0;
var PASSING_VERDICT = "advance";
function prepare(input, flags) {
  checkFlags(flags);
  const { findings, target } = resolveTarget(input, flags);
  if (!target)
    return { findings };
  const content = contentOf(input, target);
  if (content.refusal)
    return { refusal: content.refusal };
  if (content.findings.length > 0)
    return { findings: content.findings, target };
  const packed = buildPacket(input, target, content.content);
  return { findings: packed.findings, target, content: content.content, packet: packed.packet };
}
var failedRound2 = (review) => review.round === 2 && review.pass === false;
var accepted = (review) => review.override != null;
function needsHuman(stored) {
  if (!stored)
    return null;
  if (accepted(stored))
    return "was accepted on the Plan calendar";
  if (failedRound2(stored))
    return "failed round 2";
  return null;
}
function reviewPack(input, flags) {
  const prepared = prepare(input, flags);
  if (prepared.refusal)
    return prepared.refusal;
  const warnings = [];
  const { target } = prepared;
  const why = target && !flags.rerun ? needsHuman(target.stored) : null;
  if (why) {
    warnings.push({
      section: "review",
      id: target.id,
      message: `${target.label}'s stored review ${why}, so it needs a human: review it again only when the user names it, with --rerun`
    });
  }
  if (target?.deliverable?.approvalStatus === "rejected") {
    warnings.push({
      section: "approvalStatus",
      id: target.id,
      message: `${target.label} was rejected: storing a review returns it to draft and clears the rejection, so store one only after the user says yes`
    });
  }
  const { document, code } = report(prepared.findings, warnings);
  return { document: { ...document, packet: prepared.packet ?? null }, code };
}
function checkRound(result, target, flags) {
  const stored = target.stored;
  const flag = (message) => [{ section: "round", id: target.id, message: `${target.label}: ${message}` }];
  const before = target.deliverable ? "the stored review" : "previous, the round 1 passed in,";
  if (result.round === 2) {
    if (!stored)
      return flag(`round 2 needs a failed round 1 before it, and there is none (${before} is missing)`);
    if (stored.round !== 1 || stored.pass !== false || accepted(stored)) {
      const was = accepted(stored) ? "was accepted" : `is round ${stored.round} with pass ${stored.pass}`;
      return flag(`round 2 needs a failed round 1 before it, and ${before} ${was}`);
    }
  }
  const why = needsHuman(stored);
  if (result.round === 1 && why && !flags.rerun) {
    return flag(`round 1 over a stored review that ${why} needs --rerun: it needs a human, and runs again only when the user names it`);
  }
  return [];
}
function gates(result, sources) {
  const scores = isObject(result.scores) ? result.scores : {};
  const meets = (value) => Number.isInteger(value) && value >= SCORE_FLOOR && value <= SCORE_RANGE.max;
  const below = RUBRIC_DIMENSIONS.filter((name) => !meets(scores[name]));
  const coverage = coverageOf(result.questions);
  const held = holdings(sources);
  const claims = Array.isArray(result.claims) ? result.claims : [];
  const untraced = claims.map((claim, index) => ({
    index,
    text: isObject(claim) ? claim.text : undefined,
    key: isObject(claim) ? refKey(claim.source) : null
  })).filter((claim) => claim.key === null || !held.has(claim.key)).map(({ index, text }) => ({ index, text: typeof text === "string" ? text : null }));
  const { independent, basis, drafterFamily, criticFamily } = independenceOf(result.drafterModel, result.criticModel);
  return {
    verdict: { met: result.verdict === PASSING_VERDICT, value: result.verdict ?? null },
    scores: { met: below.length === 0, below, floor: SCORE_FLOOR },
    coverage: {
      met: coverage !== null && coverage.pct >= COVERAGE_FLOOR,
      value: coverage?.pct ?? null,
      floor: COVERAGE_FLOOR
    },
    claims: { met: untraced.length <= UNTRACED_ALLOWED, untraced },
    independent: { met: result.independent === true && independent, basis, drafterFamily, criticFamily }
  };
}
function checkStated(result, thresholds, target) {
  const findings = [];
  const flag = (section, message) => findings.push({ section, id: target.id, message });
  const coverage = coverageOf(result.questions);
  if (coverage && Number.isInteger(result.coveragePct) && result.coveragePct !== coverage.pct) {
    flag("coveragePct", `coveragePct is ${result.coveragePct}, but ${coverage.full} full and ${coverage.partial} partial of ${coverage.count} questions is ${coverage.pct}`);
  }
  const { basis, drafterFamily, criticFamily } = thresholds.independent;
  if (result.independent === true && (drafterFamily === null || criticFamily === null)) {
    const unknown = drafterFamily === null ? `drafterModel ${result.drafterModel}` : `criticModel ${result.criticModel}`;
    flag("independent", `independent is true, but ${unknown} has no model family, so independence cannot be shown`);
  } else if (result.independent === true && drafterFamily === criticFamily) {
    flag("independent", `independent is true, but the drafter and the critic are both ${drafterFamily}`);
  }
  if (result.independenceBasis !== undefined && result.independenceBasis !== basis) {
    flag("independenceBasis", `independenceBasis is ${JSON.stringify(result.independenceBasis)}, but drafterModel ${result.drafterModel} and criticModel ${result.criticModel} make it ${basis}`);
  }
  const unmet = Object.entries(thresholds).filter(([, gate]) => !gate.met).map(([name]) => name);
  if (typeof result.pass === "boolean" && result.pass !== (unmet.length === 0)) {
    const why = unmet.length === 0 ? "every gate is met" : `${unmet.join(", ")} ${unmet.length === 1 ? "is" : "are"} not met`;
    flag("pass", `pass is ${result.pass}, but ${why}`);
  }
  return findings;
}
function reviewCheck(input, flags) {
  const prepared = prepare(input, flags);
  if (prepared.refusal)
    return prepared.refusal;
  const { target, content, packet } = prepared;
  const result = input.result;
  const findings = [...prepared.findings, ...checkShape(result)];
  if (!target || !content || !isObject(result)) {
    const { document, code } = report(findings);
    return { document: { ...document, thresholds: null }, code };
  }
  findings.push(...checkQuestionIds(result, target.questionIds));
  const thresholds = gates(result, packet?.sources ?? sourcesOf(input, content));
  findings.push(...checkStated(result, thresholds, target), ...checkRound(result, target, flags));
  const { document, code } = report(findings);
  return { document: { ...document, thresholds }, code };
}

// src/campaignChecker/commands.ts
var REVIEW_FLAGS = ["deliverable", "page", "persona", "journey", "rerun"];
var REVIEW_NEEDS = ["campaign", "audience", "brief", "deliverables", "personas", "journeys"];
var text3 = (flags, name) => typeof flags[name] === "string" ? flags[name] : undefined;
var reviewOptions = (flags) => ({ ...flags, rerun: flags.rerun === true });
var CHECKS = {
  "calendar materialize": {
    needs: [],
    flags: ["day0", "tz"],
    run: (input, flags) => calendarMaterialize(input, { day0: text3(flags, "day0"), tz: text3(flags, "tz") })
  },
  chars: {
    needs: [],
    flags: ["deliverable"],
    word: { name: "channel", values: SOCIAL_CHANNELS },
    run: (input, flags, word) => checkChars(input, { deliverable: text3(flags, "deliverable") }, String(word))
  },
  "check brief": { needs: ["brief", "audience"], run: (input) => checkBrief(input) },
  "check plan": {
    needs: ["campaign", "audience", "brief", "deliverables"],
    flags: ["now"],
    run: (input, flags) => checkPlan(input, { now: text3(flags, "now") })
  },
  "check post": {
    needs: ["campaign", "audience", "brief", "deliverables", "page", "pageMeta", "pageTypes", "labels", "users"],
    flags: ["deliverable"],
    run: (input, flags) => checkPost(input, { deliverable: required(flags, "deliverable") })
  },
  "check research": {
    needs: ["brief"],
    flags: ["today"],
    run: (input, flags) => checkResearch(input, { today: text3(flags, "today") })
  },
  "review check": {
    needs: [...REVIEW_NEEDS, "result"],
    flags: REVIEW_FLAGS,
    booleans: ["rerun"],
    run: (input, flags) => reviewCheck(input, reviewOptions(flags))
  },
  "review pack": {
    needs: REVIEW_NEEDS,
    flags: REVIEW_FLAGS,
    booleans: ["rerun"],
    run: (input, flags) => reviewPack(input, reviewOptions(flags))
  }
};

// src/campaignChecker/main.ts
var commandNames = () => Object.entries(CHECKS).map(([name, entry]) => entry.word ? `${name} <${entry.word.name}>` : name);
var anyOf = (values) => `${values.slice(0, -1).join(", ")} or ${values.at(-1)}`;
function lookup(words) {
  const whole = words.join(" ");
  const [first = "", ...rest] = words;
  const command = Object.hasOwn(CHECKS, whole) ? whole : Object.hasOwn(CHECKS, first) ? first : undefined;
  const entry = command === undefined ? undefined : CHECKS[command];
  if (command === undefined || !entry || command !== whole && !entry.word) {
    throw new CheckUsageError(`the command must be one of: ${commandNames().join(", ")}`);
  }
  if (!entry.word)
    return { command, entry, word: undefined };
  const { name, values } = entry.word;
  if (command === whole || rest.length !== 1 || !values.includes(rest[0])) {
    const given = command === whole ? "" : `, not ${rest.join(" ")}`;
    throw new CheckUsageError(`${command} needs a ${name}: ${anyOf(values)}${given}`);
  }
  return { command, entry, word: rest[0] };
}
function run(argv) {
  const firstFlag = argv.findIndex((arg) => arg.startsWith("--"));
  const { command, entry, word } = lookup(firstFlag < 0 ? argv : argv.slice(0, firstFlag));
  const flags = parseFlags(firstFlag < 0 ? [] : argv.slice(firstFlag), entry.booleans ?? []);
  onlyFlags(flags, ["from", ...entry.flags ?? []]);
  const input = normalizeInput(readInput(required(flags, "from")));
  const missing = entry.needs.find((part) => input[part] == null);
  if (missing) {
    const source = INPUT_SOURCES[missing] ? ` (the result of ${INPUT_SOURCES[missing]})` : "";
    return refusal(missing, `${command} needs ${missing}${source} in the --from input`);
  }
  return entry.run(input, flags, word);
}
function isEntryPoint() {
  if (!process.argv[1])
    return false;
  try {
    return import.meta.url === pathToFileURL(fs2.realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}
if (isEntryPoint()) {
  try {
    const { document, code } = run(process.argv.slice(2));
    finish(document, code);
  } catch (error) {
    fail(error);
  }
}
export {
  run
};
