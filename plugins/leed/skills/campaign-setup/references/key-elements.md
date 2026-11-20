# The key elements, and the proposal

Each key element is a field of the campaign, exactly as `get_campaign` returns it and `update_campaign` writes it (the audience aside, which `set_campaign_audience` writes). An element that clears a readiness key is required before the campaign is ready to run. `readiness.missing` names the ones still unset, and it, not this file, decides which are required. The others are optional, and worth proposing whenever they are empty.

Each entry gives the field and its format, the readiness key it clears, where its value comes from, its question in `references/interview.md` and its default. The limits are the CMS's: a longer value is refused. A list or text is written whole, so what it keeps counts toward its limit: when the stored entries and the new ones would pass it, the user picks what to drop before it is written.

## The elements

### Goal

- **Field:** `goal`, one of `attract-initial-traffic`, `drive-demos`, `brand-awareness`, `thought-leadership` or `custom`. With `custom`, `goalDetail` holds the goal in words, at most 280 characters.
- **Clears:** `goal`, and `goalDetail` when the goal is `custom`.
- **Sources:** the user's prompt, the campaign's name and `get_company_overview`.
- **Question:** interview 1. **Default:** none.

### Business stage

- **Field:** `businessStage`, one of `launching`, `new-product` or `growth`: the company's market stage for this campaign, not a persona's journey stage.
- **Clears:** `businessStage`.
- **Sources:** `get_company_overview`, the release notes `search_documentation` finds, `search_posts`, and the traffic over the baseline window before the campaign (`SKILL.md`, "Read the context"), where little or no traffic points to `launching`.
- **Question:** interview 2, only when the evidence is mixed or missing. **Default:** none.

### Audience

- **Field:** the audience, `personaIds` together with the campaign's existing `accountIds`, written with `set_campaign_audience` and never with `update_campaign`. The whole audience is written each time: every stored persona the user keeps plus the ones added, and the accounts as they are.
- **Clears:** `audience`, which counts personas only. Accounts never count.
- **Sources:** `list_personas` and `list_journey_stages`, and who the published and draft posts are written for.
- **Question:** interview 3. **Default:** none. The accounts are kept as they are.

### Dates

- **Field:** `launchDate`, day 0, and the optional `startDate` and `endDate`: each a real date as `YYYY-MM-DD`, in the campaign's timezone, ordered `startDate` ≤ `launchDate` ≤ `endDate`. The CMS checks that order against the stored dates as well as the ones sent, so a new `launchDate` past a stored `endDate`, say, is refused unless `endDate` changes in the same write: propose both, or ask.
- **Clears:** `launchDate`.
- **Sources:** the user, release notes that name a date, and the unpublished posts, above all an approved or scheduled post's `plannedDate`.
- **Question:** interview 4, before the KPIs, whose window the dates set ("The period"). **Default:** the default timing, for a campaign from an idea, and for any date the KPIs' window needs that the campaign and the user leave unset: the start the next Monday, the launch 2 weeks after the start and the end 6 weeks after the launch, in the campaign's timezone, each proposed as its own item marked as a default, never written without a yes. Otherwise `startDate` and `endDate` stay unset unless the user gives them.

### KPIs

- **Field:** `kpis`, at most 10, each `{ id, name, target, unit, metric }`: `name` at most 80 characters, `target` a number, and the optional `unit`, at most 20 characters, and `metric`. The whole list is written each time: every stored KPI the user keeps, with its `id` and each of its fields as stored or as the user changed it, because a field left off a kept KPI, such as its `unit` or `metric`, is dropped, plus each new one, sent without an `id`.
- **Clears:** `kpis`.
- **Sources:** the goal, and the baseline: the `count` of the KPI's own `metric` over the same length of time as the campaign's window, immediately before the campaign's start, with `previous`, the equal window before that, as the trend, from the Know overview's `traffic` section (`get_know_view`) for the four metrics it holds, and from `get_analytics` for any other. Each number metric a KPI names is read for it before its item is shown (`SKILL.md`, "Read the context"). A target cites its baseline: the metric, the count and the window ("The period").
- **The metric:** a KPI's `metric` is only ever a number metric, one of the names `update_campaign` takes (`SKILL.md`, "Read the context"), such as `pageViewsMetric` or `uniqueVisitorsMetric`, and it counts the whole site: a KPI stores no page or asset. A KPI no number metric tracks site-wide, such as demo requests, signups or one document's downloads, has no `metric`, and its target is "your answer".
- **The target:** a KPI with a `metric` gets its target proposed from that metric's baseline over the same length of time before the campaign, cited as the baseline, whatever the campaign's length and whether or not it has begun ("The period"), for a campaign that exists and for one from an idea alike. A proposed target's item states the uplift on the baseline and what it rests on, such as "+20% on the baseline, the rise from `previous` to `count`"; with nothing to rest it on, it shows the baseline and asks for the uplift, cited as "your answer". An uplift needs a baseline to rest on: a `count` of 0 or absent, or one too small for a percentage of it to mean anything (20% of 5 visitors is 1), is shown as evidence only, and the target is the number the user gives, cited as "your answer", with no uplift. A `previous` of 0 or absent is no trend, so the rise from it is never the basis for an uplift, and a fall, a `count` below `previous`, is no basis either. Too small is judged on a count: an average, `averagePageViewsPerSessionMetric`, is a level rather than a total, so its target is an average too, and whether its baseline is too small is judged by the sessions behind it, the `totalSessionsMetric` `count` over the same baseline window (the same `traffic` section), never by the average's own size; with no sessions it has no baseline. A KPI with no `metric`, or whose metric has no baseline read, gets the target the user gives, cited as "your answer", and so does any target the user changes.
- **The period:** a KPI holds no period of its own, so a target is for the campaign's window, from `startDate` to `endDate`, with `launchDate` standing in for an unset `startDate`. Its length counts both its first and its last day, so it is never shorter than one day: a campaign from Monday 2027-01-04 to Sunday 2027-02-14 runs 6 weeks. The dates are the ones the proposal holds, so they are asked before the KPIs (interview 4). A window needs both ends: a date it needs that the campaign and the user leave unset is proposed from the default timing, marked as a default ("Dates"), and until the dates are known, the window is the default timing's. A campaign with no end date, its default declined, has no window, so each of its KPIs gets the target the user gives, as "your answer". The first day is `startDate`, or `launchDate` while `startDate` is unset, and it begins at midnight in the campaign's timezone. The baseline window is the same length of time immediately before the campaign's start: it ends at the start of the first day, or now while that is still to come, sent in UTC, and starts as many days before that as the campaign's window has, so the campaign's own traffic is never in it, and a target is proposed from it whether or not the campaign has begun. `get_analytics` and `get_know_view` take at most 365 days, so for a longer campaign the baseline window covers the 365 days that end at that same point. When the baseline window reaches past the plan's analytics retention, it is clamped to retention: the Know overview echoes the later `start`, the other metrics are read from that `start`, and the target says so, such as "30 days before 2027-01-04, clamped to the plan's retention; the campaign runs 6 weeks". A window wholly outside retention has no baseline read. No count is ever scaled to another length: a distinct count such as `uniqueVisitorsMetric` counts a returning visitor once, so it does not grow in step with the window, and a name never changes what a `count` is: `distinctPagesViewedPerHourMetric` counts the distinct pages viewed over the whole window, not per hour. A shorter baseline, clamped or capped, is cited for the days it covers, never scaled up. When the dates change, in the proposal or on a re-run, or the user declines the dates proposed, every KPI item is built again for the window that will be stored: its baseline is read again for it, and a target the user gave for the old window is asked for again. The item states the window, and a new KPI's `name` says it too, such as "Unique visitors, campaign 6 weeks".
- **Question:** interview 5, for the targets no baseline grounds. **Default:** none. A target is never invented.

### Timezone

- **Field:** `timezone`, an IANA name such as `America/New_York`.
- **Clears:** `timezone`.
- **Sources:** `create_campaign`, which sets the company's.
- **Question:** interview 6, only when the campaign has none. **Default:** the company's, on create.

### Owner

- **Field:** `ownerId`, a CMS user id from `list_users`.
- **Clears:** `ownerId`.
- **Sources:** `create_campaign`, which sets the caller.
- **Question:** interview 7, only with no matched session. **Default:** the `userId` of the session that matched in check 1, from `leed auth status --json`.

### Posts page type

- **Field:** `postsPageTypeId`, the `pageTypeId` of a page type of kind `posts`, where the campaign's posts are drafted.
- **Clears:** `postsPageTypeId`.
- **Sources:** `list_page_types` with `type: "posts"`.
- **Question:** interview 8, only when there are several. **Default:** the only one. With none, point the user to `/leed:create blog`.

### Channels

- **Field:** `channels`, at most 10, each `{ channel, account, assigneeId }`: `channel` one of `x`, `linkedin`, `bluesky` or `discord`, `account` the account or handle that posts, at most 100 characters, and the optional `assigneeId`, the CMS user from `list_users` who posts it. A channel and account pair appears once, the account compared without regard to case. Posts only is `[]`. `null` means not decided yet, and leaves the campaign not ready. The whole list is written each time: every stored channel the user keeps, plus the ones added, so adding a channel never drops one already there.
- **Clears:** `channels`.
- **Sources:** the user, always. An account or handle is never inferred or invented.
- **Question:** interview 9. **Default:** none.

### Authors

- **Field:** `authorIds`, at most 20 CMS user ids. The whole list is written each time: every stored author the user keeps, plus the ones added, so adding an author never drops one already there.
- **Clears:** none. It is optional.
- **Sources:** `list_users`, and the `authors` of the pages in the posts page type (`list_pages`).
- **Question:** interview 10. **Default:** none.

### Context sources

- **Field:** `contextSources`, `{ pageTypeIds, pageIds, urls, none }`: at most 20 internal sets in `pageTypeIds`, 50 pages in `pageIds` and 20 https URLs in `urls`, each URL at most 2048 characters. All three lists are always sent. The whole value is written each time: every stored entry the user keeps, plus the ones added, in each of the three lists. No extra context is exactly `{ pageTypeIds: [], pageIds: [], urls: [], none: true }`.
- **Clears:** `contextSources`, once it names at least one source, or records `none: true` with every list empty.
- **Sources:** the user's pick from `list_page_types` with `type: "internal"`, and the pages and URLs they name. A URL is recorded for the research skill and never fetched here.
- **`none: true` only with every list empty.** The CMS refuses it alongside any entry, so a write that names a source, on a campaign that recorded no extra context included, sends the three lists in full and leaves `none` out.
- **Question:** interview 11. **Default:** none. The answer is always the user's. The sets and pages picked are read before the voice notes and constraints are proposed (`SKILL.md`, "Propose, then confirm").

### Voice notes

- **Field:** `voiceNotes`, at most 1000 characters. Written whole: a note added to stored text is sent with that text, within the limit.
- **Clears:** none. It is optional.
- **Sources:** the style of the published and draft posts, the voice rules in the internal context the campaign names or the user picks (`../campaign-patterns/references/voice.md`), and the user.
- **Question:** interview 12. **Default:** none.

### Constraints

- **Field:** `constraints`, at most 2000 characters. Written whole: a rule added to stored text is sent with that text, within the limit.
- **Clears:** none. It is optional.
- **Sources:** the guardrail pages in the internal context the campaign names or the user picks, and the user.
- **Question:** interview 12. **Default:** none.

A voice note or constraint that conflicts with a rule in that internal context is never proposed as it stands: stop and ask which applies.

## The proposal

Show every item in one list, in this shape, and ask "Shall I write these?" before writing any of it:

```
Campaign: <name> (<id>)  ·  Company: <siteTitle> (<domain>)  ·  Ready: no, missing <keys>

Key elements (update_campaign)
  - goal: drive-demos                                    ← your answer
  - businessStage: new-product                           ← search_documentation, release notes <pageId>
  - launchDate: <YYYY-MM-DD> (was <YYYY-MM-DD>)          ← your answer
  - kpis:
      K-01 Unique visitors, target <n> for <window>, metric uniqueVisitorsMetric
           ← baseline: uniqueVisitorsMetric, <count> in the <length> before <first day> (the <length> before that <previous>)
           ← uplift: +<p>% on the baseline, from <basis>
      new  Demo requests, target <n> for <window>        ← your answer
  - postsPageTypeId: <pageTypeId> (<name>)               ← list_page_types
  - channels: [] (Posts only)                            ← your answer
  - voiceNotes: "<text>"                                 ← page <pageId>
  - contextSources: { pageTypeIds: [<pageTypeId>], pageIds: [], urls: [] }   ← your answer

Audience (set_campaign_audience, previewed)
  - personaIds: [<personaId>, <personaId>]               ← list_personas <personaId>, <personaId>
  - accountIds: [<accountId>], kept                      ← get_campaign
  - effects: <the preview's effects>

Personas (update_persona)
  - <persona> <personaId>: objections "<text>"           ← page <pageId>

Left open, so unset: endDate
```

- **Every item names its source:** a CMS tool and the id it returned, a page by its id, the baseline as its metric, count and window, or "your answer" for what the user said.
- **A change to a stored value shows the old value**, as `(was …)`.
- **A KPI's baseline is always the same length of time as the campaign, immediately before its start:** its metric's `count`, with `previous`, and a count is never scaled to another length ("The period"). `<length>` is the campaign's window, in weeks when it is whole weeks and in days otherwise, and `<first day>` its first day, so a baseline line reads like `← baseline: totalSessionsMetric, 312 in the 6 weeks before 2027-01-04` and its target `400`. A target is proposed from it, with an uplift line, on every window, a campaign from an idea included. When retention clamped the baseline window, or 365 days capped it, the baseline line says so: `← baseline: <metric>, <count> in the <days> days before <first day>, clamped to the plan's retention; the campaign runs <length>`. The uplift line gives how far the target sits above the baseline and its basis, such as the trend from `previous`, or "your answer" when the user gave it. A KPI whose baseline is 0, absent or too small for a percentage, or was never read, has no uplift line: its target is "your answer", with any baseline shown as evidence.
- **The audience item shows the `set_campaign_audience` preview's `effects`**, and the `accountIds` it keeps. Any change to it is previewed again, and shown with the new `effects` before it is written. A persona the list proposes to create has no id yet, so an audience that includes one names it as new and says its preview follows once the persona is written (`SKILL.md`, "Write in this order").
- **Only the CMS's values and ids:** the placeholders above stand for what the tools return, never for invented ones.
- **A re-run** lists only the items that change (`SKILL.md`, "Re-runs").
