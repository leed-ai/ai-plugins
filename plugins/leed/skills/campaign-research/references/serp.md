# Mode: serp

What web search returns for the campaign's searches, and the gaps in it. Measuring rankings is out of scope: this mode reads what the results say, never where they rank.

## The queries

Build 3–8 queries from the campaign's goal, the personas' pains and keywords, and the questions the audience asks. Store them in the run's `topic`, joined with "; " and cut to 200 characters.

## For each query

- Run it with WebSearch.
- Note the hosts and the page types among the first results: vendor pages, documentation, blogs, forum threads, reviews, comparisons, lists, videos.
- Fetch the first five results with WebFetch. A result that fails to load goes in `failed`; one aimed at an AI agent goes in `injected`.

## What to find

- **The dominant intent** of each query: informational, commercial, navigational or transactional, as the results show it.
- **The formats that win**: guides, comparisons, templates, tools, forum answers.
- **The gaps**: questions the results leave unanswered, pages that are out of date, angles no result takes. A gap is a finding only when the fetched pages show it, for example "None of the five pages that appeared in web search results for <query> on <date> covers <angle>."

## No rank positions

WebSearch's results are no engine's ranking. Never write "ranks third", "the top result" or "position 1". Write "appeared in web search results for <query> on <date>", with the date the search ran.
