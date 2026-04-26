import { readMemories } from '../knowledge/memory-writer.js';
import { getDayRecord } from './tracker.js';
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

async function report() {
  const memories = readMemories(TODAY);
  const record = getDayRecord(TODAY);

  const reportData = {
    date: TODAY,
    articles_read: record.articles_read,
    memories_written: memories.length,
    tokens_spent: record.tokens_spent,
    memories,
    wish: record.wish || null
  };

  const outPath = join(sessionDir(TODAY), `report-${TODAY}.json`);
  writeFileSync(outPath, JSON.stringify(reportData, null, 2));
  console.log(`[curious glen] report written → ${outPath}`);

  // rebuild graph to incorporate today's new memories
  const graph = buildGraph();
  console.log(`[curious glen] graph rebuilt — ${Object.keys(graph.nodes).length} nodes, ${graph.edges.length} edges`);

  return reportData;
}

report().catch(console.error);
