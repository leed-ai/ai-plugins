# Approval: the preview, the list, the yes, the refusals, and moving dates

**Approval is the scheduling act.** Approving a `new-page` or `republish` deliverable schedules its page to publish at exactly the deliverable's `scheduledDate`, with page scheduling's own checks. A docs page is approved without being scheduled, because the release pipeline schedules it. A `social` cut is only approved: a person posts it by hand on its date, then marks it done on the Plan calendar. Approving a deliverable of a draft campaign moves the campaign to scheduled. The user can approve on the Plan calendar instead, which does exactly the same.

## Check

Preparation changed pages and copy, so read them again first: the deliverables with `list_campaign_deliverables`, and each pillar's page with `get_page` and `get_page_body`. Run `check post` on each pillar set with a deliverable to approve. Its findings show on the rows of the approval list, by the `id` each names. A check that checked nothing, a finding whose `id` is null or a usage error, is run again on fixed input before the list is shown.

**Then the dates.** `check post` checks no date, and the approve route refuses `date_in_past` only for a page deliverable: for a social cut it checks no date at all. So run `check plan` once on the whole plan as it now stands, with `--now` the current time, and show its findings on the rows too. A deliverable offered for approval is held back, like a refusal, when it has:

- a `dates` finding that it has no `scheduledDate`, or that it is a draft dated at or before now;
- for a cut, a `spacing` finding that it is before its pillar, which happens when a person moved a draft pillar later on the Plan calendar, past its cuts.

Approved as it stands, such a cut would be ready to post on a date that has gone, or before its page publishes, with its short link resolving to the site's root until then. Its fix is a move, as "Moving dates" says, after which its row is checked and previewed again. A pillar held back holds back its cuts, as a refused pillar does. Any other `check plan` finding, a LinkedIn spacing finding say, is shown on its row and holds nothing back.

## Preview

Call `approve_campaign_deliverable` with the campaign as `id` and the deliverable as `itemId`, and no `confirm`, once for each deliverable `SKILL.md`'s section 1 offers for approval: a cut only once its copy holds its own link's `shortcodeUrl`, and no `{{link}}`. The approve route never reads a cut's copy, so this check is the skill's own. The preview changes nothing. It returns:

- `deliverable`: its title, date and target;
- `campaign`: its `status`, and the `nextStatus` approving gives it;
- `page`: the page's status and slot, the planned `action` and the slot it goes `to`, or the release pipeline's `note` for a docs page;
- for an unmanaged page, `page: null` and the deliverable's `sitePath` and `note`: approving it schedules nothing, and it ships with the site (`SKILL.md`'s section 13);
- `wouldApprove`, and every refusal in `refusals`.

## The approval list

One row per deliverable, in date order:

- its ref, type, channel and account;
- its date and time in the campaign's timezone;
- its page, with its editor link, `<CMS origin>/pages/<pageId>`, and its status;
- its review: passed, or accepted by a person (`review.override`);
- its short link, for a cut;
- its open comments, from `openCommentCount`, naming `/leed:review <page>` when there are any;
- what approving does: "schedules the page for <date>", "Scheduled by the release pipeline" for a docs page, or "ready to post by hand" for a social cut;
- each refusal, with its code and reason, and each `check post` finding on it.

## One yes

Ask "Approve and schedule these?" for that list. **The yes for preparation is not one**, and nothing is approved without a yes for this list. A row with a refusal is not approved: show its fix instead (the table below).

## Approve

Call `approve_campaign_deliverable` again with `confirm: true`, one deliverable at a time: each pillar first, then its cuts, and never a row a date finding holds back (Check, above). **When a pillar is refused or held back, its cuts are not approved in this run**, so no social post is ever ready to go out for a page that is not scheduled. A pillar fixed during the run (Refusals, below) is the exception: it is previewed again with its cuts, and once it is approved on the yes for those rows, its cuts are approved after it. A cut whose pillar was approved before this run, with its `pageSync.state` `scheduled`, `published` or `docs`, is approved on its own; one whose approved pillar's `pageSync` is a `mismatch` waits, and is listed with it. Each approval answers with the deliverable, the campaign and the page as they now stand.

## Refusals

A refused deliverable stays `draft`, and nothing about it changed. Show each refusal with its code and reason.

**A row fixed during the run is previewed again.** After a revision, a new date or a fresh read, it is approved only once its new preview shows no refusal, and on a yes for that row: the yes for the list covered the row as it was. A fixed pillar's rows include its cuts, which its refusal held back, each previewed again with it.

| Refusal | What it means | The fix |
|---|---|---|
| `409 deliverable_schedule_refused`, `code` `page_publish_required` | The user lacks `page:publish` on this page; it can differ page by page | Someone with it approves, on the Plan calendar or in chat |
| `code` `internal_page_not_publishable` | The page is an internal page, which is never published | The user retargets the deliverable on the Plan calendar |
| `code` `missing_required_fields` | The page lacks the fields its type requires, listed in `missingFields`: `featureImage`, `summary`, `keywords` or `formId` | A feature image as `references/images.md` sets out; a summary or keywords with `/leed:campaign-draft <id> <ref> edit`; a form by the user, in the editor |
| `code` `page_not_schedulable` | The page's status cannot be scheduled. A PUBLISHED page needs a revision first | For a PUBLISHED page, ask, then call `update_page_metadata` with `status: "IN_REVISION"` and preview again. Otherwise the user fixes it in the editor |
| `code` `private_page` | The page is private | The user fixes it in the editor |
| `code` `page_deleted` | The page has been deleted | The user retargets the deliverable on the Plan calendar |
| `code` `date_in_past` | The deliverable's date has passed | Ask for a new date, and move it as "Moving dates" says |
| `409 deliverable_page_taken` | Another approved page deliverable, in any campaign, already schedules the page; `existing` names it | The user rejects or retargets that one on the Plan calendar |
| `409 deliverable_target_required` | The deliverable does not link the page or copy its type needs | `/leed:campaign-draft <id> <ref>`, or the Plan calendar |
| `409 deliverable_changed` | The deliverable changed while this ran | Read it again, preview again, and ask again if its row changed |
| `deliverable_already_approved`, `deliverable_not_draft` | Someone approved or rejected it since the list was read | Show it, and leave it alone |

## After approving

Read the deliverables again with `list_campaign_deliverables`. Each approved page deliverable's `pageSync.state` is `scheduled`, or `docs` for a docs page. Report any other value, with its `reason`. An approved unmanaged page carries `siteSync` instead: `awaiting-push` until it is pushed, `on-staging` once its staging build succeeds, and `live` only after the promotion. Never report `on-staging` as published.

## Already approved

An approved deliverable is never prepared, edited or approved again. Show its `pageSync.state`. A `mismatch` means the page changed outside the campaign since it was approved: report it with its `reason` (`rescheduled`, `unscheduled` or `deleted`), and leave it alone. Outside changes are shown, never overwritten.

An approved cut, approved in an earlier run or on the Plan calendar, is checked as `SKILL.md`'s section 1 checks a draft one before approval. When its `copy` still holds `{{link}}`, or not its own link's `shortcodeUrl`, report it: it would be posted without its tracked link. Putting the link in is a copy edit, which returns it to draft, so that is a person's call, and the next run then prepares it and offers it again.

## Moving dates

- **An approved deliverable** moves with `reschedule_campaign_deliverable`, passing `id`, `itemId` and the new `scheduledDate`. First call it with no `confirm`: the preview gives the date it moves `from` and `to`, `returnsToDraft`, its page's new slot and any refusal. Then call it again with `confirm: true`, after a yes. Its page moves with it. `update_campaign_deliverable` never changes an approved deliverable's date: an approved page deliverable's move comes back `409 confirm_required` and changes nothing.
- **A draft deliverable** moves with `update_campaign_deliverable`'s `scheduledDate`, after a yes.
- **Dates** are ms-epoch instants for local times in the campaign's timezone, from `calendar materialize`. Never work out an instant by hand.
- **A pillar moved later than its cuts** moves them too, so none goes out before its post, and `check plan` must pass on the new dates for the deliverables that move, before any move is written. Run it twice for every move, with the same `--now`, the current time: once on the plan as it stands, and once with every deliverable at the date it would then have.
- **Passing is about what the move brings.** `check plan` checks every active deliverable, so a plan can carry findings the move has nothing to do with: another set's draft dated in the past, which is `date_in_past` at its own preview, or a coverage, ref, social, persona or spacing finding the plan carried before the move, a deliverable a person planned by hand among them. Some are filed on the moved set itself: with one of its cuts rejected on the Plan calendar, a pillar has no active cut on that channel, before the move and after it. So a finding holds the move back only when the run on the new dates has it and the run on the plan as it stands did not (the same `section`, `id` and `message`), and its `id` is a deliverable that moves or its message names one. A spacing finding names two or more deliverables under the `id` of one of them, so a moved cut that lands on the same day as an unmoved one, from the same LinkedIn account, is caught by its message. A finding whose `id` is null, in either run, refuses the input or the plan as a whole: fix it, and run both again. List every finding the first run also had as already there, with its reason, and move the set: requiring a clean plan, or a clean moved set, would leave a campaign that slipped, or lost a cut, with a set it could never move.
- **The moves are written in an order that keeps every cut on or after its pillar,** because each is its own write and any of them can be refused. A set moving later moves its cuts first and then its pillar; a set moving earlier moves its pillar first and then its cuts. When one is refused, stop that set's remaining moves, read the deliverables again, and report where each one stands, with the refusal and its fix.
- **A pillar's page keeps its planned date in step.** A move never changes the page's `plannedDate`, and `check post` flags a pillar whose page's `plannedDate` is not its `scheduledDate`'s local date. So a pillar's move also sends `plannedDate`, the new local date as `YYYY-MM-DD`, with `update_page_metadata`, under the same yes, **and only after the move itself succeeded**: the `reschedule_campaign_deliverable` call that confirms an approved pillar's move, or the `update_campaign_deliverable` write of a draft pillar's date. A refused move leaves `plannedDate` as it is, because a page dated apart from its deliverable fails `check post` just the same. That write leaves a DRAFT, IN_REVISION or SCHEDULED page's status as it is. A PUBLISHED page is not written: report its `plannedDate` instead.

## Never

- **Never schedule a page any other way.** Approval schedules it, so never call `schedule_pages_by_id` or `schedule_pages_by_source_id`.
- **Never schedule a docs page.** The release pipeline owns docs pages.
- **Call `publish_page_now` only when the user asks** to publish a page now, and preview it first.
- **Never post to a social network.** Approved social copy is posted by hand on its date, then marked done on the Plan calendar.
- **Never write `review.override`.** Only a person sets it, with Accept review on the Plan calendar.
