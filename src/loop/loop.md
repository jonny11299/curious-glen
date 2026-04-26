# loop

Orchestrates the daily session. Run with: node src/loop/run.js

One run of "run.js" should be sufficient to prepare for a daily session. It should not be necessary for the user to run multiple files to prepare for a Curious Glen session.

- run.js        Fetches articles, scores them, writes raw session file, updates tracker.
                Also exports report() to compile the day's report.
- report.js     Entry point to trigger report() from run.js.
- tracker.js    Reads and writes log.json — tracks articles read, tokens spent, wishes.
- log.json      Persistent log of all session records, keyed by date.
- stopwords.txt Common words excluded from phrase/word analysis.
