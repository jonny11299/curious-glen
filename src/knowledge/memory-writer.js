import { writeFileSync, readFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INTERNET_DIR = join(__dirname, 'internet');

export function writeMemory(memory) {
  // memory shape: { topic, what, why_interesting, connects_to, uncertainty, source_url, date }
  const date = memory.date || new Date().toISOString().split('T')[0];
  const dir = join(INTERNET_DIR, date);

  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const slug = memory.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const filepath = join(dir, `${slug}.json`);
  writeFileSync(filepath, JSON.stringify(memory, null, 2));
  return filepath;
}

export function readMemories(date) {
  const dir = join(INTERNET_DIR, date);
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(readFileSync(join(dir, f), 'utf-8')));
}
