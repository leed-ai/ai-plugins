# Mode: keywords

The terms the audience searches, with the intent behind each one. campaign-plan reads the findings this mode writes, so each one follows the claim form below.

## Candidates

- The personas' keywords, pains and objections, from `list_personas`.
- Competitors' page titles, from a `competitors` run already on the brief or read in this run.
- The search results for the seed terms (WebSearch), and the related terms on the pages fetched.

Store the seed queries in the run's `topic`, joined with "; " and cut to 200 characters.

## For each keyword

- **Its intent**: informational, commercial, navigational or transactional, as the search results show it.
- **How it fits a journey stage**: which of the company's journey stages (`list_journey_stages`) a searcher using it is at, from the intent and the pages that win.

## The claim form

Each keyword finding is one claim in exactly this form:

```text
Keyword "<term>": <intent> intent; <evidence>
```

When the evidence names the term again, it writes the term exactly as the claim form does, and it writes a date as `YYYY-MM-DD`. For example:

- `Keyword "docs as code": informational intent; appeared in web search results for docs as code on 2026-10-25, led by vendor guides and how-to posts; volume qualitative.`
- `Keyword "docs as code": informational intent; about 12,000 searches a month.` (only when a cited quote gives 12,000)

## The volume rule

A keywords claim carries no figure except one its cited quote gives. A search volume appears only when a cited source's quote gives the figure. Otherwise the claim says "qualitative", and its confidence is at most `medium`. Never estimate a volume, never take one from memory or a search snippet, and never spell one out in words.

`check research` holds every number written in digits in a `keywords` claim to the quotes of the sources the finding cites, whatever words are around it: a volume, a count, a share, a price, a year, and the digits in a name or an id alike. It leaves out only two things: the keyword term, wherever the claim repeats it whole, in any letter case, and a date written `YYYY-MM-DD`. It reads 12,000, 12K and 12 thousand as one figure. So a count, a share or a year goes in a keywords claim only when a cited quote gives it; otherwise leave it out.
