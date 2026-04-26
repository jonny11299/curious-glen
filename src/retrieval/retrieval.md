# retrieval

Responsible for fetching raw information. How Glen gets information from the outside world.

- fetcher.js    Fetches N random Wikipedia articles via the API. Returns { title, pageId, extract, url }[].
- deep_dive.js  Fetches DD of the above N wikipedia articles that ranked the highest, except in-full, not just a snippet. returns { title, pageId, extract, url }[].
