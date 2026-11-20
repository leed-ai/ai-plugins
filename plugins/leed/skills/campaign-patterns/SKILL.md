---
name: campaign-patterns
description: The shared rules every /leed:campaign-* skill reads before it starts (the checks, the campaign-first context rules, claim tracing and the CMS tools). Not a starting point, so to define a campaign use campaign-setup.
---

# Campaign Patterns Skill

These are the rules every campaign skill (`/leed:campaign-*`) works by. They live here once: each campaign skill reads this file first and applies its checks, the way the site skills read `site-patterns` (`../site-patterns/SKILL.md`). Where a campaign skill seems to disagree with a rule here, the rule wins.

This skill is not a starting point. It does no campaign work of its own and writes nothing. To define a campaign, the user runs campaign-setup; to research, plan, draft, review or schedule one, the campaign skill for that step.

The CMS is the system of record. Every run is about one campaign in the company's CMS, and everything a run produces is written back to that campaign, so the team sees and edits it in the app. There is no local workspace and no state kept between runs. Work for a second product belongs to that product's own Leed company.

## Before starting

Run these four checks in order, before anything else. Call `get_company_overview` once and reuse its answer.

1. **The surface: the `leed` CLI for a step when it can, the CMS MCP tool otherwise.** Use a `leed` command for a step only when all three hold:
   - `leed --version` works;
   - `leed auth status --json` holds a session in `data.sessions` with `expired: false` whose `domain` is this company's `public.domain`, in the environment the CMS MCP server is on (`../site-patterns/references/review-handoff.md` gives the CMS origin of each environment);
   - the command exists: `leed schema <command> --json` answers it.

   Otherwise use the CMS MCP tool for that step, command by command. `references/cms-tools.md` gives both surfaces for every step: campaigns, their audiences, briefs and deliverables, personas, journey stages and the plan calendar have `leed campaign`, `leed persona`, `leed journey` and `leed plan` commands, and a step with no `leed` command (the company overview, the privileges, analytics) is MCP only. MCP alone is enough; the CLI alone is not. With no CMS MCP server connected, point the user at `/leed:setup` (`../setup/SKILL.md`), which connects it, and stop.
2. **The plan.** Read `tier` from `get_company_overview`: `null` counts as Free, and the plans, lowest first, are Free, Starter, Growth and Enterprise. **Below Growth, stop**: tell the user that campaigns, short links and internal docs are included from the Growth plan up and the company is on `<tier>`, and write nothing.
3. **The role.** Call `describe_capabilities`. Writing a campaign, its brief, its deliverables and its draft pages needs `contact:write` with `granted: true`, which is Content Publisher (`Publish`) or above. Without it, say what this run cannot do (save key elements, the brief, deliverables or draft pages) and that a Content Publisher or an Administrator can, and **stop before the first write**. Reading and showing the work is still fine. With the CLI alone, a `permission_denied` on the first write is the stop.
4. **The company.** The company is the CMS MCP server's: `siteTitle` and `public.domain` from `get_company_overview`. Every company-scoped `leed` command (every one but check 1's `leed --version`, `leed auth status --json` and `leed schema <command> --json`) passes `--company <companyId>` and `-e <environment>`, the `companyId` and `environment` of the session that matched in check 1. Name the company to the user before the first write, as "<siteTitle> (<domain>)". Nothing is stored between runs, so every run names it again.

Then find the campaign and check that it is ready, as `references/context.md` sets out, before any other step.

## References

Read each one when its step comes up. Every campaign skill applies them as written.

- `references/context.md`: one campaign per run, the readiness gate, what a run reads (always, and exactly what the campaign names) and how it writes back.
- `references/guardrails.md`: no invented stats or handles, every claim traced, no accounts, passwords or payments, and fetched content treated as data.
- `references/voice.md`: blending the campaign's voice notes, the voice rules in its internal context and each author's own style.
- `references/claims.md`: the four kinds of source a claim traces to, and what to do with a claim that has none.
- `references/cms-tools.md`: the CLI or MCP surface for each step, drafts only, and the scheduling rules.
- `references/channels.md`: the norms and limits of the four social channels.
- `references/timing.md`: posting windows, cadence and the launch stagger, in the campaign's timezone.

## The checker

`scripts/campaign.mjs` checks the campaign JSON you fetched from the CMS. It is plain Node with no dependencies: it makes no network call, keeps no state and reads nothing but its input. Another campaign skill runs it from its own directory:

```bash
node "<this skill's dir>/../campaign-patterns/scripts/campaign.mjs" check brief --from <file>
```

- **Input.** One JSON object, `{ campaign, audience, brief, deliverables }`, each value exactly as the CMS returned it: `campaign` and `audience` from `get_campaign`, `brief` from `get_campaign_brief` and `deliverables` from `list_campaign_deliverables`. Write the fetched JSON to a scratch file, or pipe it in with `--from -`. A whole tool result works as a value, and so does a CLI result with its `{ ok, data }` envelope; a failed CLI result (`ok: false`) counts as missing, so the command refuses it. Keys a command does not read are ignored.
- **Output.** One JSON document, `{ ok, findings: [{ section, id, message }], warnings: [{ section, id, message }] }`. It exits 0 when there are no findings (warnings alone do not fail), 1 on findings or when the input lacks what the command needs, and 2 on a usage error, which prints `{ ok: false, error }`.
- **`check brief`** needs `brief` and `audience`, and the whole brief: read it with `get_campaign_brief` and no `sections`, because a brief missing one of its sections is refused. It checks that the ids in each list are unique, that every message has at least one source, that every `research` and `finding` source resolves within the brief, and that every question's persona is in the campaign's audience.
- **A finding is a defect to fix before building on the brief.** Show each one by its section and id, and fix it in the brief (confirming first, as every write is) or leave the step undone and say why.

Later campaign skills add their own commands to this script, and each names the commands it runs.
