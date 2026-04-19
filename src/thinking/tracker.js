/* todo: 

put sessions in a "sessions" folder
automatically open the viewer that shows you the latest session
lets you talk to it


*/

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_FILE = join(__dirname, 'log.json');

function load() {
  if (!existsSync(LOG_FILE)) return {};
  return JSON.parse(readFileSync(LOG_FILE, 'utf-8'));
}

function save(log) {
  writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

export function getDayRecord(date) {
  const log = load();
  return log[date] || { date, articles_read: 0, tokens_spent: 0, memories_written: 0, wish: null };
}

export function updateDayRecord(date, updates) {
  const log = load();
  log[date] = { ...(log[date] || { date }), ...updates };
  save(log);
  return log[date];
}
