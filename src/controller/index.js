import { fetchArticles } from '../retrieval/fetcher.js';
import { loadHeuristics, scoreArticle } from '../heuristic/heuristic.js';
import { readMemories } from '../knowledge/memory-writer.js';
import { getDayRecord, updateDayRecord } from '../thinking/tracker.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TODAY = new Date().toISOString().split('T')[0];
const SESS_DIR = join(__dirname, '../sessions', TODAY);

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

  // save session file
  if (!existsSync(SESS_DIR)) mkdirSync(SESS_DIR, { recursive: true });
  const sessionPath = join(SESS_DIR, `raw-${TODAY}.json`);
  writeFileSync(sessionPath, JSON.stringify({ type: 'session-raw', date: TODAY, articles: scored }, null, 2));
  console.log(`[curious glen] session saved → ${sessionPath}`);

  // update tracker
  updateDayRecord(TODAY, { articles_read: articles.length });
  console.log(`[curious glen] ${articles.length} articles fetched and scored`);
  console.log('[curious glen] ready for glen evaluation — run report() when memories are written');
}

export async function report() {
  const memories = readMemories(TODAY);
  const record = getDayRecord(TODAY);

  if (!existsSync(SESS_DIR)) mkdirSync(SESS_DIR, { recursive: true });

  const reportData = {
    type: 'session-report',
    date: TODAY,
    articles_read: record.articles_read,
    memories_written: memories.length,
    tokens_spent: record.tokens_spent,
    memories,
    wish: record.wish || null
  };

  const outPath = join(SESS_DIR, `report-${TODAY}.json`);
  writeFileSync(outPath, JSON.stringify(reportData, null, 2));
  console.log(`[curious glen] report written → ${outPath}`);
  return reportData;
}

run().catch(console.error);
