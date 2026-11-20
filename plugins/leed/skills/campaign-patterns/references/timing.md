# Timing: posting windows, cadence and the launch stagger

Every date and time is in the campaign's `timezone`. `launchDate` is Day 0. When `startDate` and `endDate` are set, nothing is planned before the first or after the second.

These are defaults to start from, not measured facts: the company's own analytics (`get_analytics`), the team's experience and the user's word override them, and they are never presented as data.

## Posting windows

| Channel | Days | Window |
|---|---|---|
| Posts (the page itself) | Tuesday to Thursday | Early morning, so the social copy can link to a live page |
| `linkedin` | Tuesday to Thursday | 8 to 11 in the morning, or around noon |
| `x` | Tuesday to Thursday | Late morning to early afternoon |
| `bluesky` | Weekdays | Morning to early afternoon |
| `discord` | When the community is active | Ask the user; the server's own rhythm decides |

When a person's account and the company's both post about one page, post them at different times, never in the same slot.

## Cadence

- **Posts:** two to four a month for a small team, or what the plan sets. A page publishes before any social copy that links to it.
- **A person's LinkedIn account:** two or three posts a week, never two in one day.
- **A company account:** up to one post a day per channel.
- **Follow-ups:** each page's later posts spread over the next one to two weeks, one distinct angle per post (a finding, a quote, a how-to, an objection answered), never all at once.

## The launch stagger

| When | What |
|---|---|
| Day −7 to Day −1 | The problem, without the product: posts that name what the audience struggles with, with no hard call to action |
| Day 0 | The launch page publishes in the morning. Then each channel's launch post, staggered through the day so no two land in the same hour |
| Day +1 to Day +3 | A second angle on each channel, and answers to the questions the launch raised |
| Day +4 to `endDate` | The rest of the plan, at the cadence above |

Without a `launchDate` there is no Day 0, and the campaign is not ready (`references/context.md`). Turning a local time into the instant the CMS stores uses `timezone`; never write a UTC time as if it were local.
