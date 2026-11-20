# The CMS tools: the CLI first, otherwise MCP

## The surface, step by step

Choose the surface for each step as `SKILL.md`'s first check says: the `leed` command in the CLI column when it exists and a signed-in session matches the company, otherwise the CMS MCP tool. A step with an empty CLI cell has no `leed` command, so it is MCP only. A campaign skill that sets one surface for its writes, as campaign-draft and campaign-schedule do, keeps to it.

A write the MCP tool previews and then confirms (`confirm: true`) is previewed on the CLI with `--dry-run`, shown to the user, and run again without `--dry-run` after their yes. A command whose schema lists `-y, --yes` refuses under `--json` without it, so pass `--yes` on that second run only, never on the preview. Pass `--json` to every `leed` command and read the envelope: `ok`, then `data`, or `error.code`, `error.message` and `error.hint`.

| Step | CLI | MCP |
|---|---|---|
| The company, its plan and its domain | | `get_company_overview` |
| The user's privileges | | `describe_capabilities` |
| The signed-in sessions | `leed auth status --json` | |
| Find a campaign | `leed campaign list --json` | `list_campaigns` |
| Read a campaign, its audience and its readiness | `leed campaign get <campaignId> --json` | `get_campaign` |
| Create a draft campaign, after a yes | `leed campaign create --name <name> --json` | `create_campaign` |
| Save confirmed key elements | `leed campaign set <campaignId> --from-file <file> --json` | `update_campaign` |
| Set a campaign's audience, previewed and then confirmed | `leed campaign audience set <campaignId> --persona-id <personaId> --dry-run --json`, then again without `--dry-run` | `set_campaign_audience`, then again with `confirm: true` |
| Read and write the brief | `leed campaign brief get <campaignId> --json`, `leed campaign brief set <campaignId> --file <file> --base-revision <n> --written-by agent --json` | `get_campaign_brief`, `update_campaign_brief` |
| Read the deliverables | `leed campaign deliverable list <campaignId> --json` | `list_campaign_deliverables` |
| Create and edit deliverables, a pillar's `pageId` and `detail` and a cut's `copy` included | `leed campaign deliverable create <campaignId> --from-file <file> --written-by agent --json`, `leed campaign deliverable set <campaignId> <itemId> --from-file <file> --written-by agent --json` | `create_campaign_deliverable`, `update_campaign_deliverable` |
| Reject a deliverable the plan drops, previewed and then confirmed | `leed campaign deliverable reject <campaignId> <itemId> --reason <text> --dry-run --json`, then again with `--yes` | `reject_campaign_deliverable`, then again with `confirm: true` |
| Personas and journey stages | `leed persona list --json`, `leed journey list --json` | `list_personas`, `list_journey_stages` |
| Create or update a persona, after a yes | `leed persona create --from-file <file> --json`, `leed persona set <personaId> --from-file <file> --json` | `create_persona`, `update_persona` |
| The company's users (owners, authors, who posts) | `leed settings user list --json` | `list_users` |
| Labels and page types | `leed settings label list --json`, `leed settings pagetype list --json` | `list_labels`, `list_page_types` |
| The internal docs the campaign names | `leed page search <query> --section internal --page-type-id <pageTypeId> --json`, always with `--page-type-id` | `search_internal`, always with `pageTypeIds` |
| Published posts, docs and release notes | `leed page search <query> --section site --json`, `leed page search <query> --section documentation --json` | `search_posts`, `search_documentation`, `list_pages` |
| Find a page by its live path, or by a URL on the company's own site (pass the URL's path) | `leed settings path resolve <path> --json` | `resolve_path` |
| Read a page | `leed page get <pageId> --json`, `leed page meta get <pageId> --json` | `get_page`, `get_page_body` |
| Create a DRAFT page | `leed page create --page-type-id <pageTypeId> --file <file> --json`, with `--slug`, `--label` and `--planned-date` from the plan when there is one | `create_page_from_markdown`, with the plan's `slug`, its `labels` and its `plannedDate` when there is a plan |
| Set a draft page's summary, keywords, authors, journey stage and canonical URL, and an adopted draft's title, labels and planned date, never its slug | `leed page meta set <pageId> --from-file <file> --json` | `update_page_metadata` |
| Fill a page whose body is empty | `leed page update <pageId> --file <file> --json`, only while the body is empty | `set_page_body` |
| Suggest a change to a page that has comments | `leed page update <pageId> --block <dataId> --suggest` | `update_page_body` with `mode: "suggest"` |
| Edit the body of a DRAFT page that has no comments | `leed page update <pageId> --block <dataId>` | `update_page_body` with `mode: "direct"` |
| Create an internal set, previewed and then confirmed | `leed settings pagetype create --type internal --from-file <file> --dry-run --json`, then again without `--dry-run` | `create_page_type` with `type: "internal"`, then again with `confirm: true` |
| Analytics | | `get_know_view`, `get_analytics` |
| The publishing calendar | `leed plan calendar --from <date> --to <date> --json` | `get_plan_calendar` |
| A page type's required fields, which `list_page_types` does not return | `leed settings pagetype get <pageTypeId> --json` | `get_page_type` |
| Find an image in the asset manager | `leed asset list --type image --q <text> --json` | `list_assets` with `type: "image"` and `q` |
| Set a page's feature image, and move a PUBLISHED page to IN_REVISION, each after a yes | `leed page meta set <pageId> --feature-image <json> --json`, or with `--status IN_REVISION` | `update_page_metadata` with `featureImage: { assetId, alt }`, or with `status: "IN_REVISION"` |
| A campaign's short links, and each link's short URL | `leed settings shortcode get <code> --json` for one link | `list_shortcodes` with `campaignId`, `get_shortcode` |
| Create a tracked short link, previewed and then confirmed | `leed settings shortcode create --page-id <pageId> --campaign-id <campaignId> --dry-run --json`, then again without `--dry-run` | `create_shortcode`, then again with `confirm: true` |
| Approve a deliverable, which schedules its page, previewed and then confirmed | `leed campaign deliverable approve <campaignId> <itemId> --dry-run --json`, then again with `--yes` | `approve_campaign_deliverable`, then again with `confirm: true` |
| Move a deliverable's date, and an approved one's page with it, previewed and then confirmed | `leed campaign deliverable reschedule <campaignId> <itemId> --scheduled-date <date> --dry-run --json`, then again with `--yes` | `reschedule_campaign_deliverable`, then again with `confirm: true` |
| Publish a page now, previewed and then confirmed, only when the user asks | `leed page publish <pageId> --dry-run --json`, then again without `--dry-run` | `publish_page_now`, then again with `confirm: true` |
| Find the site's unmanaged pages (`context.md`) | `src/**/*.hbs` in the site checkout, each page's front matter; without one, `leed page search <query> --section site --json` or `--section documentation`, once production has indexed it | `search_posts`, `search_documentation`, `resolve_path` |
| Read an unmanaged page | the `.hbs` file in the site checkout; without one, WebFetch on its live URL and `<page URL>index.md` | |
| Plan or link an unmanaged page deliverable: `sitePath`, its front matter `pageId`, and `nav` | `leed campaign deliverable create <campaignId> --from-file <file> --written-by agent --json`, `leed campaign deliverable set <campaignId> <itemId> --from-file <file> --written-by agent --json`, with `sitePath`, `pageId` and `nav` in the file | `create_campaign_deliverable`, `update_campaign_deliverable` with `sitePath`, `pageId` and `nav` |
| Build or change an unmanaged page's `.hbs` file | `../site-builder/SKILL.md`, in the site checkout | |
| Push an unmanaged page to staging, check it there, and promote it after the user's yes | `../site-publish/SKILL.md`: `leed site validate`, `leed site commit`, `leed site push --json`, then `leed deployments promote` | `promote_staging_to_production`, previewed and then confirmed, after site-publish's staging verification |
| The staging deployment a push started, and the promotion | `leed deployments status --json` | `list_deployments` |
| Link an approved unmanaged page deliverable to its staging deployment, which keeps it approved | `leed campaign deliverable set <campaignId> <itemId> --deployment-id <id> --json` | `update_campaign_deliverable` with `deploymentId` |
| The menus, and one menu's items with its `revision` | `leed settings menu list --json`, `leed settings menu get <menuId> --json` | `list_menus`, `get_menu` |
| Add a page's menu item, linked as `pageid:<pageId>` | `leed settings menu add <menuId> --base-revision <rev> --parent <menuItemId> --name <label> --href pageid:<pageId> --json`, or `--top-level` | `add_menu_item` with `item: { name, href: "pageid:<pageId>" }` |
| Publish a menu change, previewed with what is pending, after the user's yes | `leed settings pending --json`, then `leed settings publish <pendingId> --json` | `list_pending_changes`, then `publish_pending_changes` with only that menu's change |

Every company-scoped `leed` command passes `--company <companyId>` and `-e <environment>` from the session that matched, as `SKILL.md`'s fourth check says. Each later campaign skill adds a row here for every tool it calls that the table does not list yet.

## Writes

- **Every page a campaign skill creates is a DRAFT.** The team reads and edits it in the Leed editor before anything is published.
- **Approval is scheduling.** Approving a page's deliverable schedules the page for its date. Approve (`approve_campaign_deliverable`, or `leed campaign deliverable approve`) only on the user's yes, in chat or on the Plan calendar, and never without it.
- **An unmanaged page is the exception: approving it schedules nothing.** It ships with the site, through `../site-publish/SKILL.md`: pushed to staging, checked there, and promoted to production only after the user's yes, since promotion publishes the whole of staging to the live site and cannot be undone from here. Its `siteSync` says where it stands; `on-staging` is not live.
- **A menu publish goes straight to the live site.** Preview what it changes (`list_pending_changes`), and publish only that menu's change after the user's yes. Publishing a menu before its page is live is safe: an item whose page is unpublished does not render. An unmanaged page's item links its `pageid:<pageId>`, never a typed path.
- **Never call `schedule_pages_by_source_id`**, and never schedule a docs page: the release pipeline schedules docs pages with the release that ships the code they describe.
- **Never call `schedule_pages_by_id` either, and never run `leed page schedule`.** A campaign's page is scheduled only by approving its deliverable.
- **`publish_page_now` runs only when the user asks** to publish that page now, and so does `leed page publish`. Never schedule or publish a page any other way.
- **Social copy is posted by a person, by hand.** It is a `social` deliverable on the page it promotes: its channel, who posts it, its text and its tracked link.

## If a request is blocked

Every campaign skill that writes to the CMS carries the "If Cloudflare blocks a request" section in its own `SKILL.md`, word for word as `../site-publish/SKILL.md` has it, and joins the list of skills in `blockedRequestContent.test.ts`. That test reads only `SKILL.md` files, so the section is never copied into this file.
