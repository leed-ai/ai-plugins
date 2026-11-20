# The interview

What to ask when the CMS, the campaign and its context hold no evidence for a key element. Each answer becomes a proposal item whose source is "your answer", in the shape `references/key-elements.md` gives.

## How to ask

- **Only elements with no evidence.** Never ask for what the CMS, the campaign or its context already holds: propose it with its source instead, and let the user change it there.
- **A few at a time.** Use AskUserQuestion when it is available, with at most four questions per call, each offering the values the CMS holds as its options. Otherwise ask in plain text, a few at a time. AskUserQuestion takes at most four options per question, so when the CMS holds more, such as a company's personas, users or internal sets, ask that question in plain text and list every value.
- **An answer another question depends on comes first, in an earlier call.** The KPIs are asked only once the goal and the dates are answered, because their metrics, window and targets follow from them; the authors only once the posts page type is answered, because its posts' authors are offered first; and the voice notes and constraints only once the context sources are answered and read. Never put a question in the same call as one it depends on.
- **In plain words**, with no field names unless the user uses them.
- **An element the user leaves open stays unset.** Never fill it with a guess: readiness keeps naming it, and the finish lists it as missing.

## Questions

Ask them in this order, skipping any the evidence or an earlier answer already settles.

1. **The goal.** What is the campaign for: attracting initial traffic, driving demos, brand awareness, thought leadership, or something else? For something else (`custom`), ask for the goal in words, at most 280 characters.
2. **The business stage**, only when the evidence is mixed or missing. Is the company launching, bringing out a new product, or growing?
3. **The audience.** Which personas is the campaign for? Offer the names `list_personas` returns. With none, or with personas missing their goals, pains, triggers or objections, propose those too (`SKILL.md`, "Personas").
4. **The dates.** When does the campaign launch? Then, if the user wants them, its first and last days. Offer the default timing as the suggested answer (`references/key-elements.md`, "Dates"), and say it is a default. Ask them before the KPIs: each KPI's target is for the window the dates set, from the start to the end, and its baseline is the same length of time before the start (`references/key-elements.md`, "The period"), so a KPI asked first would be for a window the campaign may not have.
5. **The KPIs.** What should the campaign achieve, and by how much? A KPI a number metric tracks is proposed with a target from its baseline over the same length of time before the window question 4 set, cited as the baseline, by the rules in `references/key-elements.md`, "The target", whatever that window's length. So ask for a target only where no number metric tracks the KPI, such as demo requests, where the campaign has no window, or where its metric's baseline could not be read or is one "The target" shows as evidence only: then ask for the target itself, as a number, never for an uplift on it, with any baseline shown beside the question. Where nothing grounds how far above its baseline a target should sit, ask for that uplift. The user keeps or changes each proposed target, and a target they give or change is "your answer". A target is never invented.
6. **The timezone**, only when the campaign has none. Which timezone are the dates in?
7. **The owner**, only when no session matched in check 1. Who owns the campaign? Offer the people `list_users` returns.
8. **The posts page type**, only when `list_page_types` with `type: "posts"` lists several. Which one do the campaign's posts go in? With none, point the user to `/leed:create blog`, and leave it open.
9. **The channels.** Where will the social copy be posted, and from which account on each? Always offer "Posts only". Each account comes from the user and is never inferred from a name, and who posts on each channel is offered from `list_users`.
10. **The authors.** Who writes the campaign's posts? Offer the people `list_users` returns, the authors of the existing posts in the campaign's posts page type first.
11. **The context sources.** Which internal sets, if any, should inform the campaign? List the sets `list_page_types` returns with `type: "internal"`. Offer specific pages and https URLs too, and "no extra context", which is recorded as an answer. Read the sets and pages the user picks before question 12, as `SKILL.md` ("Propose, then confirm") says.
12. **Voice notes and constraints.** Anything about the voice, or any rule the content must follow, beyond what the internal context already says?

## From answers to the proposal

Each answer becomes one item in the list `references/key-elements.md` shows, with "your answer" as its source. An answer that changes a stored value shows the old one. Nothing is written until the user says yes to the list, or to the items they accept.
