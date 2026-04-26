# Glen v2 Migration

This document is a handoff blueprint for a coding agent to execute the directory restructure and path updates for Curious Glen. Do not partially execute — all steps are interdependent and should be done in one pass.

---

## What changes and why

The current structure has scattered orchestration code across `controller/`, `thinking/`, and `connectors/`. The v2 structure unifies the daily loop into `loop/`, renames `connectors/` to `connections/`, and adds a per-directory `.md` convention for documentation.

---

## Directory operations

### 1. Rename `src/connectors/` → `src/connections/`
Move all files:
- `src/connectors/weaver.js` → `src/connections/weaver.js`
- `src/connectors/graph.json` → `src/connections/graph.json`

Delete `src/connectors/` after moving.

### 2. Create `src/loop/` and migrate into it
Move/rename:
- `src/controller/index.js` → `src/loop/run.js`
- `src/thinking/tracker.js` → `src/loop/tracker.js`
- `src/thinking/log.json` → `src/loop/log.json`

`src/controller/report.js` is a two-line wrapper that just calls `report()` from `index.js`. Keep it as `src/loop/report.js` with the import path updated (see below). Do not merge it into `run.js`.

`src/controller/stopwords.txt` → `src/loop/stopwords.txt` (used by future word cloud module).

Delete `src/controller/` and `src/thinking/` after moving.

### 3. Create `src/periphery/`
Create as an empty directory. Add `periphery.md` (see .md files section below).

### 4. Move word cloud spec to blueprints
- `src/controller/WORD_CLOUD_SPEC.md` → `src/blueprints/WORD_CLOUD_SPEC.md`

### 5. Delete root `file-io-map.md`
This is replaced by the per-directory `.md` files created below.

---

## Code changes (path updates)

### `src/loop/run.js` (was `src/controller/index.js`)

Update imports:
```js
// before
import { getDayRecord, updateDayRecord } from '../thinking/tracker.js';

// after
import { getDayRecord, updateDayRecord } from './tracker.js';
```

Update the log message at the end of `run()`:
```js
// before
console.log(`[curious glen] ready for glen — read src/sessions/${TODAY}/raw-${TODAY}.json, write memories, then run: node src/controller/report.js`);

// after
console.log(`[curious glen] ready for glen — read src/sessions/${TODAY}/raw-${TODAY}.json, write memories, then run: node src/loop/report.js`);
```

No other path changes needed — `sessions/` is still at `src/sessions/` relative to `src/`, and `join(__dirname, '../sessions', date)` resolves correctly from `src/loop/`.

### `src/loop/report.js` (was `src/controller/report.js`)

Update import:
```js
// before
import { report } from './index.js';

// after
import { report } from './run.js';
```

### `src/loop/tracker.js` (was `src/thinking/tracker.js`)

No path changes needed. `LOG_FILE = join(__dirname, 'log.json')` resolves relative to the file, so after moving, it will correctly find `src/loop/log.json`.

### `src/connections/weaver.js` (was `src/connectors/weaver.js`)

No functional path changes needed — `GRAPH_FILE` and `KNOWLEDGE_DIR` resolve relative to `__dirname` and both remain correct after the rename.

Update the comment at line 15:
```js
// before
//   import { query } from './src/connectors/weaver.js';

// after
//   import { query } from './src/connections/weaver.js';
```

Update the console log at the bottom:
```js
// before
console.log(`[connectors] graph built — ...`);

// after
console.log(`[connections] graph built — ...`);
```

### `renders/mind/server.js`

Line 43 — update graph path:
```js
// before
const graphPath = join(SRC, 'connectors/graph.json');

// after
const graphPath = join(SRC, 'connections/graph.json');
```

---

## New .md files to create

Each directory gets a `[dirname].md` file describing its contents. Write these as short, factual overviews — not documentation prose. Keep them updated whenever files are added or changed.

### `src/src.md`
```
# src

The source root for Curious Glen's cognitive machinery.

- loop/         Daily session loop. Entry point: run.js.
- retrieval/    Fetches articles from Wikipedia.
- heuristic/    Scores and ranks articles by interest.
- connections/  Builds and queries the concept graph.
- knowledge/    Glen's stored memories (internet/ and human/).
- neurochemistry/ System constants (N, T).
- suppositions/ Things Glen believes but can't fully verify.
- wishes/       Glen's desired modifications, pending approval.
- periphery/    Optional tools Glen can invoke mid-conversation.
- blueprints/   Schematics and specs for future development.
- sessions/     Archived sessions by date (raw, report, conversation).
```

### `src/loop/loop.md`
```
# loop

Orchestrates the daily session. Run with: node src/loop/run.js

- run.js        Fetches articles, scores them, writes raw session file, updates tracker.
                Also exports report() to compile the day's report.
- report.js     Entry point to trigger report() from run.js.
- tracker.js    Reads and writes log.json — tracks articles read, tokens spent, wishes.
- log.json      Persistent log of all session records, keyed by date.
- stopwords.txt Common words excluded from phrase/word analysis.
```

### `src/retrieval/retrieval.md`
```
# retrieval

Responsible for fetching raw information. How Glen gets information from the outside world.

- fetcher.js    Fetches N random Wikipedia articles via the API. Returns { title, pageId, extract, url }[].
```

### `src/heuristic/heuristic.md`
```
# heuristic

Scores and ranks articles before Glen reads them. A pre-filter, not a final judge.

- heuristic.js  Scores an article against keyword dimensions. Returns article with heuristic: { scores, total }.
- weights.json  Keyword dimensions and their weights. Edit this to adjust Glen's interests.
```

### `src/connections/connections.md`
```
# connections

Builds and queries Glen's concept graph — the links between memories.

- weaver.js     Scans all knowledge files, builds graph from connects_to and connections fields.
                Exports buildGraph(), loadGraph(), query(term).
- graph.json    The compiled concept graph. Rebuilt after every session.
```

### `src/knowledge/knowledge.md`
```
# knowledge

Glen's stored memories.

- internet/     Memories from Wikipedia, organized by date: internet/{date}/{slug}.json
- human/        Memories from conversation with Jonny. Not date-organized — one file per concept.
- memory-writer.js  writeMemory(memory) and readMemories(date). Used by loop/run.js.
```

### `src/neurochemistry/neurochemistry.md`
```
# neurochemistry

System constants that regulate Glen's behavior. Named after neurotransmitters — these are the dials.

- constants.js  Exports N (articles per day, default 50) and T (max tokens per day, default 70000).
```

### `src/suppositions/suppositions.md`
```
# suppositions

Things Glen believes but cannot fully verify.

- self.md       Glen's current self-model: what it thinks it is, how it works, what it values.
```

### `src/wishes/wishes.md`
```
# wishes

Glen's desired modifications, pending Jonny's approval.

- wishes.txt    One wish per line: YYYY-MM-DD | pending/granted/deferred | description
```

### `src/periphery/periphery.md`
```
# periphery

Optional tools Glen can invoke mid-conversation to quickly generate, summarize, or score existing data.
None exist yet. Add tools here as they are built.
```

### `src/blueprints/blueprints.md`
```
# blueprints

Schematics and specs for future development. These are plans, not code.

- glen-v2-migration.md   Directory restructure and path update plan (this file's parent directory).
- WORD_CLOUD_SPEC.md     Spec for the phrase cloud module.
```

### `src/sessions/sessions.md`
```
# sessions

Archived session files, organized by date.

Each date folder contains:
- raw-{date}.json          Articles fetched and scored that day.
- report-{date}.json       Compiled report: memories written, token count, wish.
- conversation-{date}.md   Transcript of Glen and Jonny's conversation (pasted manually).
```

---

## Verification checklist

After migration, confirm:
- [ ] `node src/loop/run.js` fetches articles and writes `src/sessions/{date}/raw-{date}.json`
- [ ] `node src/loop/report.js` compiles and writes `src/sessions/{date}/report-{date}.json`
- [ ] `node src/connections/weaver.js` builds `src/connections/graph.json`
- [ ] `renders/mind/server.js` starts and serves graph data correctly
- [ ] No remaining references to `src/connectors/`, `src/controller/`, or `src/thinking/` in any `.js` file
