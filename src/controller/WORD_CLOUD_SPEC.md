# Phrase Cloud Module — Implementation Spec
`src/controller/word_cloud.js`

This document is a complete handoff spec. An implementing agent should be able to build
`word_cloud.js` by reading this document alone, without needing any prior context.

---

## Purpose

Build a weighted phrase cloud from Glen's existing knowledge base, then use it to score
incoming Wikipedia articles. The cloud reflects Glen's accumulated vocabulary — what it
has been thinking about, from both Wikipedia and conversation with Jonny. Depending on
configuration, incoming articles can be scored for similarity to (or difference from)
Glen's existing conceptual territory.

---

## File Locations

| File | Purpose |
|------|---------|
| `src/controller/word_cloud.js` | Main module (to be created) |
| `src/controller/stopwords.txt` | One stopword per line, lowercase (to be created) |
| `src/knowledge/phrase_cloud.json` | Working output — overwritten each session; read by heuristic |
| `src/sessions/{date}/phrase_cloud-{date}.json` | Daily snapshot — written once, never overwritten; for the user to observe Glen's vocabulary evolving over time |
| `src/neurochemistry/constants.js` | Add new constants here |
| `src/heuristic/weights.json` | Add `phrase_resonance` dimension here |
| `src/heuristic/heuristic.js` | Call `scorePhraseCloud` inside `scoreArticle` here |
| `src/controller/index.js` | Call `buildPhraseCloud(date)` here after memory writing |

---

## New Constants

Add the following to `src/neurochemistry/constants.js`:

```js
// Phrase cloud biases — all are continuous dials, not binary switches.

export const OBSCURITY_BIAS = 0;
// -1 = prefer Glen's rarest terms (hunt for niche concepts)
//  0 = no obscurity adjustment
//  1 = prefer Glen's most common terms (reinforce central themes)

export const HUMAN_TO_INTERNET_BIAS = 0.4;
//  0 = weight human/ knowledge exclusively
//  1 = weight internet/ knowledge exclusively
// Default 0.4: human knowledge is denser signal, so it gets slightly more weight.

export const TOWARDS_OR_AWAY_BIAS = 0.5;
// -1 = actively seek articles unlike Glen's existing vocabulary (exploration)
//  0 = phrase cloud has no effect on scoring
//  1 = seek articles that match Glen's existing vocabulary (deepening)

export const RECENCY_BIAS = 0.5;
// -1 = oldest memories weighted most heavily
//  0 = all memories weighted equally regardless of age
//  1 = most recent memories weighted most heavily
```

---

## FIELD_WEIGHTS Config

Hardcode this at the top of `word_cloud.js`. Do not move it to a separate file.

```js
const FIELD_WEIGHTS = {
  fields: {
    topic:           3.0,  // the concept name itself — highest signal
    connects_to:     2.5,  // array of loose associations — pure concept vocabulary
    why_interesting: 2.0,  // Glen's own voice — high signal
    uncertainty:     1.5,  // questions Glen is carrying
    connections:     1.5,  // structured links — extract "concept" strings only
    what:            1.0,  // factual description — noisier, lower weight
    // Excluded fields: source_url, date, source, slug, path
  },
  ngrams: {
    1: 1.0,   // single words
    2: 1.8,   // two-word phrases
    3: 2.8,   // three-word phrases
    4: 4.0,   // four-word phrases — rarest, most specific, strongest signal
  },
  prune_threshold: 0.01,  // drop phrases with final_score below this after Step 9
};
```

The `ngrams` weights compensate for the natural scarcity of longer phrases. A 4-gram
appearing 3 times is stronger signal than a 1-gram appearing 8 times.

`prune_threshold` controls how aggressively the output is trimmed. Lower values keep more
of the long tail; higher values produce a leaner, higher-confidence cloud. Tune this if
`phrase_cloud.json` becomes unwieldy or too sparse.

---

## Stopwords

Create `src/controller/stopwords.txt` with one word per line, lowercase.
Seed it with at minimum the following common English stopwords:

```
a, an, the, and, but, or, nor, for, yet, so, if, as, at, by, for, in, of, on, to,
up, via, be, is, are, was, were, been, being, have, has, had, do, does, did, will,
would, could, should, may, might, shall, can, also, just, very, then, than, that,
this, these, those, with, from, into, onto, upon, over, under, about, between, through,
during, before, after, it, its, he, she, they, we, you, i, me, him, her, us, them, my,
his, her, our, your, their, one, two, three, who, what, which, when, where, how, why,
not, no, nor, only, both, all, any, each, few, more, most, other, same, such, own
```

Additional stopwords can be appended over time as needed.

Do NOT apply a character-length filter. Short tokens like "IO" (Jupiter's moon, Roman
mythology) or "Ib" (the game) may be rare, specific, and meaningful — blanket length
filtering would silently erase them. Rely on the stopword list alone for noise removal.
Single letters ("a", "i") are already covered by the stopword list.

Programmatically remove only: pure integers (`/^\d+$/`).

---

## Processing Pipeline

### Step 1 — Load Memory Files

Scan all `.json` files under:
- `src/knowledge/human/` (depth 1 — files directly in human/, not subfolders)
- `src/knowledge/internet/{date}/` (depth 2 — files inside dated subfolders)

For each file, record:
- Parsed JSON object
- Source: `"human"` or `"internet"`
- Date: read from the JSON's `date` field (format `"YYYY-MM-DD"`)

Skip any file that fails to parse or lacks a `date` field.

---

### Step 2 — Compute Source Weight

Apply `HUMAN_TO_INTERNET_BIAS` to each file:

```
human file:    source_weight = 1 - HUMAN_TO_INTERNET_BIAS
internet file: source_weight = HUMAN_TO_INTERNET_BIAS
```

At default 0.4: human = 0.6, internet = 0.4.

---

### Step 3 — Compute Recency Weight

For each file, compute a recency multiplier based on `RECENCY_BIAS`:

```
days_ago = (today - file.date) in days
k = Math.abs(RECENCY_BIAS) * 0.1    // decay steepness constant

if RECENCY_BIAS > 0:
  recency_weight = Math.exp(-k * days_ago)     // recent preferred; decays with age
if RECENCY_BIAS < 0:
  recency_weight = 1 - Math.exp(-k * days_ago) // old preferred; inverted curve
if RECENCY_BIAS === 0:
  recency_weight = 1                            // flat; all dates equal
```

At `RECENCY_BIAS = 0.5`, k = 0.05: a memory from 7 days ago has multiplier ≈ 0.70;
a memory from 30 days ago ≈ 0.22.

---

### Step 4 — Extract Weighted Text Per Field

For each memory file, extract text from fields defined in `FIELD_WEIGHTS.fields`:

| Field type | Extraction method |
|------------|------------------|
| String field | Use value directly |
| `connects_to` (array of strings) | Join items with a space |
| `connections` (array of objects) | Extract the `"concept"` string from each object; join with spaces |
| Any field not in FIELD_WEIGHTS.fields | Skip entirely |

Tokenize each field's text: lowercase, split on whitespace and punctuation, strip stopwords
and short/numeric tokens (per Step 5 below — stopword filtering applies here).

For each token extracted from a given field, add to a running accumulator:
```
accumulator[token] += field_weight × source_weight × recency_weight
```

This accumulator is the weighted token frequency map for the whole knowledge base.

---

### Step 5 — Stopword Filtering

Load `src/controller/stopwords.txt` into a Set at startup.
During tokenization (Step 4), skip any token that:
- Appears in the stopword Set
- Is shorter than 3 characters after stripping punctuation
- Is a pure integer (`/^\d+$/`)

---

### Step 6 — N-gram Extraction

After building the weighted single-token accumulator, make a second pass to extract
multi-word phrases (n = 2, 3, 4) from each field's token sequence (pre-stopword-filtering,
so that stopwords don't break phrase boundaries).

For each field in each memory file, in order:
1. Tokenize to a sequence (lowercase, strip punctuation — but do NOT remove stopwords yet)
2. Slide a window of size n across the sequence
3. Remove any n-gram where ALL tokens are stopwords (e.g. "and the", "of a") — these are
   pure noise. Do NOT remove n-grams that merely contain a stopword internally. Internal
   stopwords are often part of the phrase's identity: "cease and desist", "right of way",
   "highway to hell" should all survive intact.
4. Add the surviving n-gram to its n-gram accumulator with the same weight:
   ```
   ngram_accumulator[n][phrase] += field_weight × source_weight × recency_weight
   ```

This produces four accumulators: `acc_1`, `acc_2`, `acc_3`, `acc_4`.

---

### Step 7 — Normalize Within Each N Level

For each n, find the maximum accumulated weight across all phrases at that level.
Divide every phrase's weight by that maximum to produce a normalized score in [0, 1].

```
normalized(phrase, n) = acc_n[phrase] / max(acc_n)
```

This ensures a 4-gram appearing 3 times isn't unfairly penalized relative to a 1-gram
appearing 20 times.

---

### Step 8 — Apply N-gram Importance Multipliers

Multiply each phrase's normalized score by its n-gram weight from `FIELD_WEIGHTS.ngrams`:

```
weighted_score(phrase, n) = normalized(phrase, n) × FIELD_WEIGHTS.ngrams[n]
```

Merge all four n-gram maps into a single `phrases` map.
If a phrase appears at multiple n levels (unlikely but possible), keep the higher score.

---

### Step 9 — Apply Obscurity Bias

After all phrases have `weighted_score` values, apply `OBSCURITY_BIAS`:

Compute a global frequency rank for each phrase: sort all phrases by weighted_score
descending, assign rank from 0 (highest score) to 1 (lowest score).

```
if OBSCURITY_BIAS > 0:
  final_score(phrase) = weighted_score × Math.pow(1 - rank, OBSCURITY_BIAS)
  // boosts phrases that are already common in Glen's vocabulary

if OBSCURITY_BIAS < 0:
  final_score(phrase) = weighted_score × Math.pow(rank, Math.abs(OBSCURITY_BIAS))
  // boosts phrases that are rare in Glen's vocabulary

if OBSCURITY_BIAS === 0:
  final_score(phrase) = weighted_score
  // no adjustment
```

---

### Step 10 — Prune and Sort

Drop any phrase with `final_score < FIELD_WEIGHTS.prune_threshold`.
Sort remaining phrases by `final_score` descending.

---

### Step 11 — Write Output

Write to `src/knowledge/phrase_cloud.json`:

```json
{
  "generated": "2026-04-24",
  "constants_snapshot": {
    "obscurity_bias": 0,
    "human_to_internet_bias": 0.4,
    "towards_or_away_bias": 0.5,
    "recency_bias": 0.5
  },
  "phrase_count": 4821,
  "phrases": {
    "consciousness": 14.3,
    "highway hypnosis": 8.7,
    "predictive processing": 6.2
  }
}
```

Include `constants_snapshot` so future readers know which biases shaped the cloud.

---

## Exported Functions

### `buildPhraseCloud(date)`

Runs the full pipeline (Steps 1–11). Returns the `phrases` object.
Writes the output to two locations:

1. `src/knowledge/phrase_cloud.json` — the working file, overwritten each session.
   This is what the heuristic scorer loads at runtime. Always reflects the current state
   of Glen's knowledge.

2. `src/sessions/{date}/phrase_cloud-{date}.json` — a dated snapshot, written once and
   never overwritten. This is for the user to observe how Glen's vocabulary evolves over
   time. Both files are identical in content.

`date` should be passed in as a `"YYYY-MM-DD"` string matching today's session folder.
Call this once per session, after memories are written, before the connectors graph rebuild.

---

### `scorePhraseCloud(article, phraseCloud)`

Scores a single incoming Wikipedia article against a pre-built phrase cloud.
`phraseCloud` is the parsed `phrase_cloud.json` object (pass it in — do not reload from disk per article).

**Algorithm:**

1. Extract 1–4 grams from `(article.title + " " + article.extract)`, lowercase,
   stopwords removed, same tokenization rules as Step 4.

2. For each extracted phrase, look up its score in `phraseCloud.phrases`.
   Unrecognized phrases score 0.

3. Compute:
   ```
   total_cloud_weight = sum of all values in phraseCloud.phrases
   match_weight = sum of phraseCloud.phrases[phrase] for each matched phrase
   match_score = match_weight / total_cloud_weight
   ```

4. Apply `TOWARDS_OR_AWAY_BIAS`:
   ```
   if TOWARDS_OR_AWAY_BIAS >= 0:
     return match_score × TOWARDS_OR_AWAY_BIAS

   if TOWARDS_OR_AWAY_BIAS < 0:
     return (1 - match_score) × Math.abs(TOWARDS_OR_AWAY_BIAS)
   ```

5. Return a float in [0, 1].

---

## Integration Instructions

### `src/heuristic/weights.json`
Add a new dimension:
```json
"phrase_resonance": {
  "weight": 1.3
}
```
Note: this dimension has no `keywords` array — it is computed differently from the
existing keyword dimensions. The implementing agent will need to handle it as a special
case in `scoreArticle`.

### `src/heuristic/heuristic.js`
- Import `scorePhraseCloud` from `../controller/word_cloud.js`
- Load `phrase_cloud.json` once at startup (not per-article)
- Inside `scoreArticle`, add:
  ```js
  scores['phrase_resonance'] =
    scorePhraseCloud(article, phraseCloud) * heuristics.dimensions.phrase_resonance.weight;
  ```
- Handle the case where `phrase_cloud.json` does not yet exist (first run): skip the
  `phrase_resonance` dimension gracefully rather than crashing.

### `src/controller/index.js`
- Import `buildPhraseCloud` from `./word_cloud.js`
- Call `buildPhraseCloud()` after memory writing is complete and before the connectors
  graph rebuild (`node src/connectors/builder.js`)

### `src/neurochemistry/constants.js`
- Add the four new constants defined above alongside the existing `N` and `T`

---

## Interaction Between Biases — Reference Table

| TOWARDS_OR_AWAY | OBSCURITY_BIAS | Effect |
|-----------------|----------------|--------|
| 1 (toward) | 1 (common) | Deepens Glen's broadest central themes |
| 1 (toward) | -1 (rare) | Seeks articles touching Glen's most niche concepts |
| -1 (away) | 1 (common) | Avoids Glen's central themes — moderate novelty |
| -1 (away) | -1 (rare) | Maximum novelty — articles that miss Glen's vocabulary entirely |
| 0 | any | Phrase cloud has no effect on scoring |

---

*Spec written 2026-04-24. Implement in `src/controller/word_cloud.js` using ES module syntax (import/export) consistent with the rest of the codebase.*
