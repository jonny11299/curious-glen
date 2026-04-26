import { fetchArticles } from '../retrieval/fetcher.js';
import { loadHeuristics, scoreArticle } from '../heuristic/heuristic.js';
import { updateDayRecord } from './tracker.js';
import { buildGraph } from '../connections/weaver.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TODAY = new Date().toISOString().split('T')[0];

function sessionDir(date) {
  const dir = join(__dirname, '../sessions', date);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

async function run() {
  console.log(`[curious glen] ${TODAY} — beginning daily session`);

  // fetch
  console.log('[curious glen] fetching articles...');
  const articles = await fetchArticles();
  const heuristics = loadHeuristics();

  // score
  const scored = articles
    .map(a => ({ ...a, heuristic: scoreArticle(a, heuristics) }))
    .sort((a, b) => b.heuristic.total - a.heuristic.total);

  // save session file for glen to read
  const sessionPath = join(sessionDir(TODAY), `raw-${TODAY}.json`);
  writeFileSync(sessionPath, JSON.stringify(scored, null, 2));
  console.log(`[curious glen] session saved → ${sessionPath}`);

  // update tracker
  updateDayRecord(TODAY, { articles_read: articles.length });
  console.log(`[curious glen] ${articles.length} articles fetched and scored`);

  // rebuild graph so current connections are fresh for the session
  const graph = buildGraph();
  console.log(`[curious glen] graph rebuilt — ${Object.keys(graph.nodes).length} nodes, ${graph.edges.length} edges`);

  console.log(`[curious glen] ready — read src/sessions/${TODAY}/raw-${TODAY}.json, then: node src/loop/report.js`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) run().catch(console.error);
