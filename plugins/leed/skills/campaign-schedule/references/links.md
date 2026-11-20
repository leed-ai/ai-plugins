# Tracked links: one short link per social cut

Each ready `social` cut gets exactly one short link: a tracked link to its pillar's page, tagged to the campaign, which takes the place of the `{{link}}` placeholder campaign-draft left in its `copy`. The campaign page's Short links facet lists every link tagged to the campaign, with its clicks.

**Posts get none.** A pillar post is shared at its own URL, and a `new-page` deliverable has no `copy` to put a link in.

## The UTM convention, and why

| Parameter | Value | Why |
|---|---|---|
| `utm_source` | The cut's `channel`: `x`, `linkedin`, `bluesky` or `discord` | Inbound attribution groups visits by `utm_source`, so each network's clicks count apart |
| `utm_medium` | `social` | Every cut is a social post |
| `utm_campaign` | The campaign's name as a slug: lowercase, each run of anything but `a-z` and `0-9` turned into one hyphen, with no hyphen at either end | Groups the campaign's clicks. **Never `leed`**: Leed's own Bluesky autopost links use it, and the two would count as one campaign. A name whose slug is `leed` takes its id, as `leed-<id>`. **Never empty**: a name with no letter or digit in `a-z` and `0-9`, one written in another script say, has an empty slug, which the CMS would store as it is, so it takes `campaign-<id>` |
| `utm_content` | The cut's ref, such as `P1-li-1` | Ties each link to its cut, so a re-run finds it instead of making a second |

The CMS stores each value trimmed and lowercased, with each run of spaces turned into a hyphen, so `P1-li-1` is stored as `p1-li-1`. The recorded campaign "Acme Docs continuous documentation launch" has `utm_campaign` `acme-docs-continuous-documentation-launch`.

**One `utm_campaign` for the whole campaign.** When the cuts' links found first (below) already carry one `utm_campaign`, a new link takes that value, so a campaign renamed since its first links were made still counts as one campaign. Only a link whose `utm_content` is a cut's ref counts, never one a person made by hand under the campaign, and only a value that keeps the rules above: one that is `leed` or empty is reported, never carried. Links that carry more than one are reported, and a new link takes the slug.

## Find first

Read the campaign's links with `list_shortcodes`, passing the campaign's id as `campaignId`. A link whose `params.utm_content` equals a cut's ref, compared case-insensitively, is that cut's link: use it, and create none. So a re-run, or a run picking up where an interrupted one stopped, creates no second link. Read each found link's short URL with `get_shortcode`, as for a created one (below): `list_shortcodes` does not return `shortcodeUrl`, and the cut's copy is checked against it.

- **A mismatch:** a found link whose `pageId` is not the cut's `pageId`, or whose `params.utm_source` is not the cut's `channel`, no longer fits its cut, because the plan changed after it was made. Report it, and never replace it or create a second. A person can delete a link that has never been clicked under Engage ▸ Shortcodes; the next run then creates the right one. The campaign page's Short links facet shows the clicks.
- **Two links for one cut:** report both, and leave the cut alone.

## Create

`create_shortcode`, once for each ready cut that has no link yet:

- `pageId`: the cut's `pageId`, which is its pillar's page. Never `url`. The link resolves at each click: to the page once it is published, and to the site's root before that.
- `campaignId`: the campaign's id. It is set on creation, or never.
- `params`: `utm_source`, `utm_medium`, `utm_campaign` and `utm_content`, as the table above gives them.
- **No `vanity`.** A vanity code is permanent, and `chars` counts `{{link}}` as a generated 8-character code, so a longer vanity code would break the count the copy passed.

**Preview first.** The first call, with no `confirm`, creates nothing: it returns the `destination`, the `params` as they will be stored, and the `campaign` the link is tagged to. Show every preview in the preparation list (`SKILL.md`'s section 6), and call again with `confirm: true` only after the yes for that list. **A short link cannot be changed once it is created:** not its page, its parameters or its campaign.

## Read back

The created link comes back as `{ shortcode }`, with its `code` and its stored `params`, and no URL. Read the short URL with `get_shortcode`, passing the `code`: its `shortcodeUrl` is `https://<public.domain>/s/<code>`. Show the stored `params`, as the CMS normalized them. A link whose `get_shortcode` gives no `shortcodeUrl` is reported, and its cut is listed and left alone: its copy is never written with anything else in place of `{{link}}`.

## Into the copy

- **Start from a fresh read.** The write replaces the whole `copy`, so read the cut again with `list_campaign_deliverables` just before the write, and build the new copy from that read: an edit made on the Plan calendar meanwhile is kept, and a cut whose copy no longer holds `{{link}}` exactly once is left alone.
- **Replace the `{{link}}`** the cut's `copy` holds exactly once with the link's `shortcodeUrl`, and nothing else in the copy.
- **Check before the write.** Run `chars <channel>` on the new copy, with `company` in its input, and write only when it passes. Then `check post` on the pillar set must report no finding whose `id` is the cut's ref: it accepts `https://<public.domain>/s/<code>` in place of `{{link}}`.
- **Write** the new `copy` with `update_campaign_deliverable`, passing the campaign as `id` and the cut as `itemId`. Send only `copy`: the cut stays a draft, and its review, and any acceptance of it, stay as they are.
- **A cut whose `copy` already holds its link's `shortcodeUrl`** is left alone.
- **A cut with no `{{link}}` and no short link, or with `{{link}}` more than once,** is listed with its reason and left alone: no link is created for it. Name `/leed:campaign-draft <id> <ref> edit` to fix its copy.
- **Approval waits for the link.** A cut is offered for approval only once its copy holds its own link's `shortcodeUrl` exactly once, and no `{{link}}` (`SKILL.md`'s section 1). Each cut left alone here, or whose link was a mismatch or was not created, is listed, not approved.
