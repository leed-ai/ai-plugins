# The brief: narrative, messages, question map and ids

The brief is the campaign's story and the buyer questions it answers, written to the campaign in Leed, where the team reads it on the campaign page. campaign-plan writes three of its sections: the narrative, the messages and the questions. The fourth, the research, belongs to campaign-research, and this skill only reads it.

## The write

One `update_campaign_brief` call carries all three sections:

```json
{
  "id": 42,
  "baseRevision": 3,
  "writtenBy": "agent",
  "narrative": "Docs drift because they are written after the code ships. Acme Docs publishes each docs change with the release that ships the code it describes, so the docs are right on release day.",
  "messages": [
    {
      "id": "CM-01",
      "text": "Most teams update their docs after the release, so docs are wrong on release day.",
      "sources": [{ "kind": "finding", "findingId": "F-01" }]
    },
    {
      "id": "CM-02",
      "text": "Acme Docs publishes a docs change with the release that ships the code it describes.",
      "sources": [{ "kind": "page", "pageId": "page-release-docs" }]
    }
  ],
  "questions": [
    { "id": "Q-01", "personaId": 11, "journeyId": "awareness", "text": "Why are our docs always behind the product?" }
  ]
}
```

- `baseRevision` is the `revision` `get_campaign_brief` returned. A brief changed since is a `409 concurrent_update`.
- `writtenBy: "agent"` stamps each new or changed item as agent-written. An item sent unchanged keeps its stamp.
- Never send `research` or `appendResearch`.
- `update_campaign_brief` returns only `{ revision, updatedAt, status }`, so re-read the brief before any later write.

| Section | Limit |
|---|---|
| `narrative` | At most 2,000 characters |
| `messages` | At most 30, each 1–500 characters with 1–10 sources |
| A `user` source's `note` | 1–280 characters |
| `questions` | At most 200, each 1–300 characters |

## The narrative

The campaign's one story, in a few sentences: the problem the audience has, why it happens, and what changes with the product. It follows the campaign's `goal`, `voiceNotes` and `constraints`, and says nothing a message cannot source.

## Messages

A message is one thing the campaign says, short enough to quote. Every message has at least one source, and **no message is written without one**: a message that has none is left out, or the user is asked for its source. `check brief` names a message with no source by its id.

| Source | Written | When |
|---|---|---|
| A page | `{ kind: "page", pageId }` | A live page the user can read: a published post or doc, or a page in the campaign's `contextSources` |
| A research source | `{ kind: "research", sourceId }` | A source on the brief whose quote says it |
| A finding | `{ kind: "finding", findingId }` | A finding on the brief that states it |
| The user | `{ kind: "user", note }` | What the user said in this conversation, as a note of 1–280 characters |

A message traces to its sources the way `../campaign-patterns/references/claims.md` sets out for a claim. A message that rests on a stale finding is shown with that finding's date.

## The question map

For each persona in the campaign's audience, at each journey stage from `list_journey_stages`, in the company's stage order, write the questions that persona needs answered to move to the next stage:

- in the buyer's words, from the persona's `goals`, `pains`, `triggers` and `objections`;
- each `{ id, personaId, journeyId, text }`, where `personaId` is the persona's integer id and `journeyId` the stage's id as `list_journey_stages` gives it;
- only questions the campaign's posts can answer. A stage the campaign does not reach can have none, and `check plan` warns on each persona and stage with no question, so the user sees the gap.

Every question on the brief is answered by at least one active deliverable, which lists its id in `questionIds`. `check plan` fails a question no active deliverable lists, and a rejected deliverable does not count.

## Ids

- **Kept items keep their ids.** Each section sent replaces the stored one, so every item that stays is sent again, with its id.
- **New items get explicit ids,** never a server-assigned one, because the checks run on the plan before it is written. Number them from one past the highest `CM-` or `Q-` number on the brief and in any deliverable's `questionIds`, a rejected deliverable's included, so an old id is never reused. Ids have two digits, and three past 99, up to `CM-999` and `Q-999`.

  With `Q-01` to `Q-04` on the brief and a rejected deliverable still listing `Q-05`, the next question is `Q-06`.
- **Items a person wrote** (`writtenBy: "person"`) are sent unchanged, unless the user agrees to change them.

## Removing a question

The brief refuses to remove a question an active deliverable lists (`409 brief_question_in_use`). So:

1. Drop the question's id from every draft and approved deliverable that lists it, with `update_campaign_deliverable`. Changing only `questionIds` keeps an approved deliverable approved.
2. Write the brief without the question.

A rejected deliverable is never edited and keeps the old id. The brief lists it in `status.danglingQuestionIds`.

A deliverable a person planned by hand has no `ref`, and campaign-plan leaves it alone. A question it lists stays on the brief, and is listed for a person to change on the campaign page. If the brief write still returns `409 brief_question_in_use`, re-read the deliverables, show which ones list the question, and stop before writing the deliverables.

## When the write fails

- **`409 concurrent_update`:** someone changed the brief since it was read. Re-read it with `get_campaign_brief`, re-plan against what is there now, and show the change again before writing. Never overwrite it. A second 409 stops, with the pending brief shown in chat.
- **A 400** names the section and the item that broke a rule. Fix that item, and send again.
