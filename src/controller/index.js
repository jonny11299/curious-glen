import { fetchArticles } from '../retrieval/fetcher.js';
import { loadHeuristics, scoreArticle } from '../heuristic/heuristic.js';
import { readMemories } from '../knowledge/memory-writer.js';
import { getDayRecord, updateDayRecord } from '../thinking/tracker.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../out');
const TODAY = new Date().toISOString().split('T')[0];

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
  const sessionPath = join(__dirname, '../thinking', `session-${TODAY}.json`);
  writeFileSync(sessionPath, JSON.stringify(scored, null, 2));
  console.log(`[curious glen] session saved → ${sessionPath}`);

  // update tracker
  updateDayRecord(TODAY, { articles_read: articles.length });
  console.log(`[curious glen] ${articles.length} articles fetched and scored`);
  console.log('[curious glen] ready for glen evaluation — run report() when memories are written');
}

export async function report() {
  const memories = readMemories(TODAY);
  const record = getDayRecord(TODAY);

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const reportData = {
    date: TODAY,
    articles_read: record.articles_read,
    memories_written: memories.length,
    tokens_spent: record.tokens_spent,
    memories,
    wish: record.wish || null
  };

  const outPath = join(OUT_DIR, `${TODAY}.json`);
  writeFileSync(outPath, JSON.stringify(reportData, null, 2));
  console.log(`[curious glen] report written → ${outPath}`);
  return reportData;
}

run().catch(console.error);
