import { fetchArticles } from '../retrieval/fetcher.js';
import { deepDive } from '../retrieval/deep_dive.js';
import { loadHeuristics, scoreArticle } from '../heuristic/heuristic.js';
import { updateDayRecord } from './tracker.js';
import { buildGraph } from '../connections/weaver.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { DD, I } from '../neurochemistry/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TODAY = new Date().toISOString().split('T')[0];

function sessionDir(date) {
  const dir = join(__dirname, '../sessions', date);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

async function run() {
  console.log(`[curious glen] ${TODAY} — beginning daily session`);

  // fetch and shallow-score all N articles
  console.log('[curious glen] fetching articles...');
  const articles = await fetchArticles();
  const heuristics = loadHeuristics();

  const shallowScored = articles
    .map(a => ({ ...a, heuristic: scoreArticle(a, heuristics) }))
    .sort((a, b) => b.heuristic.total - a.heuristic.total);

  // deep dive top DD articles and re-score with full text
  console.log(`[curious glen] deep diving top ${DD} articles...`);
  const deepDived = await Promise.all(
    shallowScored.slice(0, DD).map(async a => {
      const fullText = await deepDive(a.pageId);
      const withFull = { ...a, extract: fullText };
      return { ...withFull, heuristic: scoreArticle(withFull, heuristics) };
    })
  );

  // merge: deep-dived articles replace their shallow counterparts, then re-sort
  const deepIds = new Set(deepDived.map(a => a.pageId));
  const merged = [
    ...deepDived,
    ...shallowScored.filter(a => !deepIds.has(a.pageId))
  ].sort((a, b) => b.heuristic.total - a.heuristic.total);

  // raw — full sorted list (DD articles carry full text)
  const rawPath = join(sessionDir(TODAY), `raw-${TODAY}.json`);
  writeFileSync(rawPath, JSON.stringify(merged, null, 2));
  console.log(`[curious glen] raw session saved → ${rawPath}`);

  // filtered — top I articles with depth marker; this is what Glen reads
  const filtered = merged.slice(0, I).map(a => ({
    ...a,
    depth: deepIds.has(a.pageId) ? 'full' : 'extract'
  }));
  const filteredPath = join(sessionDir(TODAY), `filtered-${TODAY}.json`);
  writeFileSync(filteredPath, JSON.stringify(filtered, null, 2));
  console.log(`[curious glen] filtered session saved → ${filteredPath}`);

  // update tracker
  updateDayRecord(TODAY, { articles_read: articles.length });
  console.log(`[curious glen] ${articles.length} fetched, ${DD} deep-dived, top ${I} filtered for Glen`);

  // rebuild graph so current connections are fresh for the session
  const graph = buildGraph();
  console.log(`[curious glen] graph rebuilt — ${Object.keys(graph.nodes).length} nodes, ${graph.edges.length} edges`);

  console.log(`[curious glen] ready — read src/sessions/${TODAY}/filtered-${TODAY}.json, then: node src/loop/report.js`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) run().catch(console.error);
