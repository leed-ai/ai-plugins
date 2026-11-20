# The rubric: the scores, coverage, claims and the pass gates

These are fixed: no campaign, persona or user changes them. `review check` (`../campaign-patterns/scripts/campaign.mjs`) recomputes every number below from the input and holds a result to it, and a test holds the numbers in this file to the checker's own.

## The five scores

The critic scores each dimension as the persona at the journey stage, each a whole number from 1 to 5. The critic's prompt carries this table (`references/critic-prompt.md`).

| Score | 1 | 3 | 5 |
|---|---|---|---|
| `clarity` | I cannot tell what it is saying, or to whom. | I get the point, after some rereading. | I get the point in the first lines, in words I use. |
| `stageRelevance` | It answers a question I am not asking yet, or one I asked long ago. | Some of it is for where I am now. | It is exactly what I need at this stage. |
| `comprehensiveness` | It leaves my real questions unanswered. | It answers the main question and leaves the rest. | It answers what I would ask next before I ask it. |
| `differentiation` | It could be from anyone selling anything. | It says something specific, but nothing I could not find elsewhere. | It says something only this company could say, and backs it. |
| `funnelAdvance` | There is nothing for me to do next. | There is a next step, but it does not fit where I am. | The next step is clear, and right for where I am. |

## Coverage

Each question is `full` (the piece answers it), `partial` (it answers part of it) or `none`. The questions are the brief's for the asset, in its `questionIds` order; when the asset names none, the critic writes 5 to 8 of its own, numbered `G-01` onward.

`coveragePct` is `round(100 × (full + 0.5 × partial) / questions)`, a whole number from 0 to 100, rounded half up: one `full` and one `partial` of two questions is 75.

## Untraced claims

A claim is anything a reader could check (`../campaign-patterns/references/claims.md`). It is **untraced** when its `source` is `null`, or names a source the packet does not hold. The packet holds:

- a research source or finding on the brief;
- a page that is a message's source, is in the campaign's `contextSources.pageIds`, or is linked as `pageid:` in the content;
- a `user` note that is a message's source, matched word for word.

## The pass gates

`pass` is true only when every gate is met:

| Gate | Met when |
|---|---|
| `verdict` | the verdict is `advance` |
| `scores` | every score is at least 3 |
| `coverage` | `coveragePct` is at least 80 |
| `claims` | there are 0 untraced claims |
| `independent` | `independent` is true: the drafter and the critic are of different families in the known-families table, Anthropic's `opus`, `sonnet`, `haiku` and `fable` or OpenAI's `gpt-5`, `gpt-4.5`, `gpt-4.1`, `gpt-4o`, `gpt-4`, `gpt-3.5`, `o1`, `o3` and `o4`, so `independenceBasis` is `cross-vendor` or `cross-family`. Two versions of one family (`same-family`) and a model the table does not know (`unknown`) are not independent |

A result that misses only `independent` met every gate on its content, so it gets no fix pass: a person accepts it on the Plan calendar.

## Rounds

At most 2 rounds per asset per run, with at most one fix pass between them. A result that fails round 2 needs a human.
