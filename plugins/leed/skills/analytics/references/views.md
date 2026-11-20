# Know views: from a question to a view

Every view is read with `get_know_view` (`view`, `start`, `end`, then its filters and parameters as top-level arguments) or `leed know show <view>`. The names below are the registry's; `get_know_view` with no `view`, or `leed know views --json`, lists each view with its `filters`, `sections`, `flag`, `personSections` and `gatedSections`, and is the source of truth when this table and the CMS disagree.

## Which view answers the question

| The question | View | Parameters | Plan flag |
|---|---|---|---|
| How is the site doing overall? What needs attention? | `overview` | | none (the `latestRelease` section needs `releaseAnalytics`, `agentQuestions` needs `agentAnalytics`) |
| Did a release land? Who read what shipped? | `release` | `release` (required, a release name such as `v2.4.0`) | `releaseAnalytics` (`reach` needs `accountAnalytics`) |
| How do releases compare? What was published outside a release? | `releases` | | `releaseAnalytics` |
| Who reads, how often, from where? | `people` | | none |
| What has one person read? | `person` | `contactId` (required) | none, but needs the reader identity feature and contact access |
| What do agents ask, and what do they fail to find? | `agents` (the query log is its `queryLog` and `queryLogQuestion` sections) | | `agentAnalytics` |
| Which accounts are reading, going quiet, or not reached by a release? | `accounts` | | `accountAnalytics` |
| Who at one account is reading? | `account` | `accountId` (required) | `accountAnalytics` |
| Which pages perform, rise, decay? | `pages` | | none (`media` needs `mediaEngagementAnalytics`) |
| How does one page do, by revision? | `page` | `pageId` (required) | none (`accounts` needs `accountAnalytics`; provenance's release name and publish type need `releaseAnalytics`) |
| What should we write next? What do readers search for? | `searchGaps` | | none |
| What converts? | `conversions` | | none |
| How did email and short links do? | `emailSocial` | | none (`shortLinks` needs `shortUrlTracking`; `templates` needs the reader identity feature and contact access) |
| How did a campaign do? | `campaigns` | | `campaignPlanner` |
| Is the knowledge base healthy (review backlog, suggestion acceptance, broken links, provenance)? | `knowledgeHealth` | | `knowledgeHealth` (provenance's release name and publish type need `releaseAnalytics`) |
| Which agent calls were made, and what did they read after? | `agentCalls` | | `knowledgeHealth` |
| What did agents do in the CMS (tools, people, struggles, suggestions)? | `agentWork` | | `agentAnalytics` |

## Sections

| View | Sections | Sections naming people |
|---|---|---|
| `overview` | headline, insights, traffic, readsChart, needsAttention, engagedMinutes, referrers, recentlyChanged, latestRelease, agentQuestions, topPages, readingDepth, engagedChannels | recentlyChanged |
| `release` | runs, rail, header, tiles, shipped, readsByWindow, adoption, told, reach | runs, header |
| `releases` | firstRead, table, process | |
| `people` | kpis, newVsReturning, engagedDepth, returnVisits, visitTimes, deviceMix, geography, newAccounts, readers, channels, referrers | readers |
| `person` | profile, firstTouch, topPages, readingDepth, agentActivity, sessions | all of them |
| `agents` | agentReads, questionsAsked, askedNeverRead, coverage, deniedAttempts, agentTraffic, queryLogSummary, toolMix, rewordedGaveUp, whoAgentsReadFor, agentsVsHumans, deniedDemand, queryLog, queryLogQuestion | deniedDemand, queryLogQuestion |
| `accounts` | kpis, table, sparklines, notReached, journeyStages, readers | |
| `account` | header, kpis, timeline, adoption, whoReads, score | timeline, whoReads |
| `pages` | kpis, table, groups, movers, lengthVsReading, decaying, downloads, autolinks, publishing, byPageType, media, entryExit, pagesPerHour, activeTime | groups |
| `page` | header, kpis, readsByRevision, depth, clicks, navigation, questions, provenance, revisions, reviews, accounts | provenance, revisions, accounts |
| `searchGaps` | kpis, writeNext, terms, rising | |
| `conversions` | kpis, funnel, paths, forms, pages, ctas | |
| `emailSocial` | kpis, emails, shortLinks, bestTime, listHealth, templates, filterOptions | |
| `campaigns` | list, header, did, deliverables, funnel, leadPaths | did |
| `knowledgeHealth` | kpis, nextRelease, repeatCorrections, reviewBacklog, suggestionAcceptance, brokenLinks, linkHistory, provenance | nextRelease, suggestionAcceptance, provenance |
| `agentCalls` | calls, selectedCall | calls, selectedCall |
| `agentWork` | kpis, byTool, byPerson, struggles, suggestions | byPerson |

On the CLI the sections naming people go to the `--out` file. Over MCP they come back in the response; name people from them only when the user asked about people.

## Shared filters

Each view takes only the filters it declares. MCP argument, then CLI flag:

| Filter | CLI | Values and default | Declared by |
|---|---|---|---|
| `start`, `end` | `--start`, `--end` | ISO-8601, at most 365 days; CLI default the last 30 days ending now (`campaigns`: the campaign's first to last deliverable day) | every view; required over MCP |
| `compare` | `--compare` / `--no-compare` | prior equal-length period, default true | overview, people, agents, accounts, pages, searchGaps, conversions, emailSocial, agentWork, account |
| `pageTypeId` | `--page-type` | one page type (`list_page_types`); knowledgeHealth defaults to the documentation page types | every view but emailSocial, campaigns, agentWork |
| `readers` | `--readers` | `everyone` (default), `people`, `agents` | overview, release, releases, people, accounts, pages, searchGaps, conversions, page |
| `agentIdentity` | `--agent-identity` | `any` (default), `signedIn` (`signed-in` on the CLI), `anonymous`; nothing finer exists | overview, release, releases, agents, accounts, pages, searchGaps, page, agentCalls |
| `account` | `--account` | `any` (default), `customers` (accounts marked current customer), or an account id | overview, release, releases, people, agents, accounts, pages, searchGaps, conversions, emailSocial, campaigns, page |
| `country` | `--country` | ISO 3166-1 alpha-2 | overview, people, pages, conversions, emailSocial, campaigns |
| `referrerHost` | `--referrer` | a host; people's figures only on overview and pages | same as country |
| `channel` | `--channel` | a traffic channel; people's figures only on overview and pages | same as country |
| `journeyStage` | `--journey-stage` | a journeyId (`list_journey_stages`) or `none` | people |
| `signedInAgents` | `--signed-in-agents` | contacts who also read through a signed-in agent | people |
| `excludeBounces`, `minimumActiveTime` | `--filter` | conversions only | conversions |
| `campaignId` | `--filter campaignId=` | a campaign id (`list_campaigns`) | campaigns, emailSocial |
| `ownerId` | `--filter ownerId=` | a user id (`list_users`) | knowledgeHealth |
| `personaId` | `--filter personaId=` | a persona id (`list_personas`) | accounts, account |

Combinations that are refused: `agentIdentity` other than `any` with `readers: "people"`, and an `account` filter with anonymous agents only.

## Each view's own filters

Over MCP they are top-level arguments; on the CLI each is `--filter key=value`.

| View | Own filters (default) |
|---|---|
| `release` | `compareWith` (an earlier release name; default the previous release), `readsWindow` (`24h`, `7d`, `30d`; default `7d`), `tab` (`all`, `unread`, `agentsOnly`) |
| `releases` | `scope` (`all`, `releases`, `outside`), `readsWindow`, `cursor` (the table's `nextCursor`) |
| `people` | `q` (search name, email, account, or an exact visitor ID), `offset` (steps of 10) |
| `agents` | `logSource` (`all`, `agents`, `mcp`, `agent`, `site`), `outcome` (`any`, `read`, `noRead`), `q`, `sort` (`top`, `rising`, `new`, `lowestRead`), `page` (from 1), `question` (fills `queryLogQuestion`), `quick` (`all`, `agentsOnly`, `humansOnly`, `inRevision`), `summarySort` (`top`, `rising`, `new`), `pageId` |
| `accounts` | `group` (`all`, `customers`, `prospects`, `goingQuiet`, `wantsAccess`, `notReached`), `q`, `sort` (`name`, `type`, `band`, `activePeople`, `agentCalls`, `browserReads`, `lastActivity`), `dir` (`asc`, `desc`), `page` (from 0), `releaseId`, `pageId` |
| `account` | `activity` (`all`, `agents`, `browser`, `email`, `forms`), `contactId` |
| `pages` | `groupBy` (`page`, `label`, `author`, `pageType`, `journey`), `q`, `flag` (`bestConverter`, `decaying`, `rising`, `noAgentReads`), `sort` (`reads`, `agentReads`, `readToEnd`, `conversions`, `title`, `changed`), `dir`, `offset` |
| `emailSocial` | `source` (`all`, `email`, `shortLinks`), `campaignId`, `releaseId` |
| `campaigns` | `listPeriod` (`1m`, `3m`, `6m`, `12m`, `all`; default `3m`) |
| `knowledgeHealth` | `pageId` (fills `provenance`) |
| `agentCalls` | `q`, `pageId`, `offset` (steps of 50), `callId` (fills `selectedCall`) |
| `agentWork` | `surface` (`all`, `mcp`, `assistant`), `userId` |

The Campaigns screen defaults its window to the selected campaign's dates, which `get_know_view` does not: pass the campaign's `firstDate` and `lastDate` (from its `list` or `header` section) as `start` and `end` to get the screen's numbers.

## Following a link between views

Ids flow from one view to the next: a `contactId` from `people`'s `readers` into `person`; an `accountId` from `accounts`' `table` into `account`; a `pageId` from `pages`' `table` into `page`, `agents` or `accounts`; a release name from `release`'s `runs` or `emailSocial`'s `filterOptions` into `release`. Carry the same window and shared filters across.

## Saved views and single metrics

- `run_saved_view` with no `id` lists the saved views; with `id` it runs one and reports `savedView` (name, date mode, window, filters that no longer apply). CLI: `leed know run <id|exact name>`. Saved views cover overview, people, pages, searchGaps, emailSocial, campaigns, knowledgeHealth, releases, conversions, agentWork, accounts, agents and agentCalls. `save_view` saves one, on `rolling`, `sinceLatestRelease` or `fixed` dates.
- `get_analytics` reads one metric (`metric`, `start`, `end`, optional `pageId`, `assetId`, `type`, `formId`, `limit`, `offset`); `list_analytics_metrics` lists the names. Its headline engagement metric is `readingDepth`.
- `get_contact_activity` reads one contact's sessions, ten at a time, when the user asks about one person in detail.
