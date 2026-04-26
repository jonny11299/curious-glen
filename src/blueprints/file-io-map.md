# File I/O Map

## `src/neurochemistry/constants.js`
- **Reads:** nothing
- **Writes:** nothing
- **Purpose:** exports constants `N` (50) and `T` (70000)

---

## `src/retrieval/fetcher.js`
- **Reads:** `constants.js` (for N), Wikipedia API over network (`/w/api.php`)
- **Writes:** nothing
- **Outputs:** array of article objects `{ title, pageId, extract, url }` returned in memory

---

## `src/heuristic/heuristic.js`
- **Reads:** `src/heuristic/weights.json` (keyword dimensions + weights)
- **Writes:** nothing
- **Outputs:** scored article objects with `heuristic: { scores, total }` returned in memory

---

## `src/knowledge/memory-writer.js`
- **Reads:** `src/knowledge/internet/{date}/*.json` (via `readMemories`)
- **Writes:** `src/knowledge/internet/{date}/{slug}.json` (via `writeMemory`)
- **Outputs:** array of memory objects returned in memory

---

## `src/thinking/tracker.js`
- **Reads:** `src/thinking/log.json`
- **Writes:** `src/thinking/log.json`
- **Outputs:** day record objects returned in memory

---

## `src/controller/index.js`
- **Reads:** Wikipedia API (via fetcher), `weights.json` (via heuristic), `knowledge/internet/{date}/*.json` (via memory-writer), `thinking/log.json` (via tracker)
- **Writes:** `src/sessions/{date}/raw-{date}.json`, `src/thinking/log.json`
- **Also exports:** `report()` function which reads memories and writes `src/sessions/{date}/report-{date}.json`

---

## `src/controller/report.js`
- **Reads:** (delegates entirely to `index.js`'s `report()`)
- **Writes:** `src/sessions/{date}/report-{date}.json` (via `index.js`)
- **Purpose:** thin entry point to trigger the report function

---

## `src/connectors/weaver.js`
- **Reads:** all `*.json` files under `src/knowledge/internet/` and `src/knowledge/human/`, reads `src/connectors/graph.json` (if it exists, for `loadGraph`)
- **Writes:** `src/connectors/graph.json`
- **Outputs:** graph object `{ built, nodes, edges }` returned in memory; `query(term)` returns matching edges/nodes

---

## `renders/mind/server.js`
- **Reads:** `src/knowledge/internet/**/*.json`, `src/knowledge/human/*.json`, `src/connectors/graph.json`, `src/sessions/{date}/raw-*.json`, `src/sessions/{date}/report-*.json`, `src/sessions/{date}/conversation-*.md`, `src/suppositions/self.md`, `src/wishes/wishes.txt`
- **Writes:** nothing
- **Outputs:** serves all of the above as JSON/text over HTTP on port 3131

---

## `renders/mind/src/lib/api.js`
- **Reads:** HTTP endpoints on the local server (`/api/memories`, `/api/graph`, `/api/sessions`, `/api/suppositions`, `/api/wishes`)
- **Writes:** nothing
- **Outputs:** fetched data returned as promises to the Svelte frontend

---

## `renders/mind/src/stores.js`
- **Reads:** nothing
- **Writes:** nothing
- **Purpose:** holds two Svelte writable stores: `currentView` (default `'memories'`) and `keypress`

---

## `renders/mind/src/main.js`
- **Reads:** nothing
- **Writes:** nothing
- **Purpose:** mounts the Svelte `App` component to `#app` in the DOM

---

## Data flow summary

```
Wikipedia API
    ↓
fetcher.js → controller/index.js → sessions/{date}/raw-{date}.json
                    ↓ (also writes)
              thinking/log.json

[Glen reads raw file, writes memories manually]
    ↓
knowledge/internet/{date}/*.json

controller/report.js → sessions/{date}/report-{date}.json

weaver.js (reads all knowledge/) → connectors/graph.json

server.js (reads everything) → HTTP API → api.js → Svelte frontend
```
