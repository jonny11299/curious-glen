import express from 'express';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '../../src');

const app = express();

app.get('/api/memories', (req, res) => {
  const memories = [];

  const internetDir = join(SRC, 'knowledge/internet');
  if (existsSync(internetDir)) {
    for (const date of readdirSync(internetDir)) {
      const dateDir = join(internetDir, date);
      try {
        for (const file of readdirSync(dateDir)) {
          if (!file.endsWith('.json')) continue;
          const content = JSON.parse(readFileSync(join(dateDir, file), 'utf8'));
          memories.push({ ...content, _source: 'internet', _file: file });
        }
      } catch {}
    }
  }

  const humanDir = join(SRC, 'knowledge/human');
  if (existsSync(humanDir)) {
    for (const file of readdirSync(humanDir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = JSON.parse(readFileSync(join(humanDir, file), 'utf8'));
        memories.push({ ...content, _source: 'human', _file: file });
      } catch {}
    }
  }

  res.json(memories);
});

app.get('/api/graph', (req, res) => {
  const graphPath = join(SRC, 'connections/graph.json');
  if (!existsSync(graphPath)) return res.json({ nodes: {}, edges: [] });
  res.json(JSON.parse(readFileSync(graphPath, 'utf8')));
});

app.get('/api/sessions', (req, res) => {
  const sessionsDir = join(SRC, 'sessions');
  if (!existsSync(sessionsDir)) return res.json([]);
  const dates = readdirSync(sessionsDir)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();
  res.json(dates);
});

app.get('/api/sessions/:date', (req, res) => {
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'invalid date' });

  const dir = join(SRC, 'sessions', date);
  if (!existsSync(dir)) return res.status(404).json({ error: 'not found' });

  const result = { date };

  const rawPath = join(dir, `raw-${date}.json`);
  if (existsSync(rawPath)) result.raw = JSON.parse(readFileSync(rawPath, 'utf8'));

  const reportPath = join(dir, `report-${date}.json`);
  if (existsSync(reportPath)) result.report = JSON.parse(readFileSync(reportPath, 'utf8'));

  const convPath = join(dir, `conversation-${date}.md`);
  if (existsSync(convPath)) result.conversation = readFileSync(convPath, 'utf8');

  res.json(result);
});

app.get('/api/suppositions', (req, res) => {
  const p = join(SRC, 'suppositions/self.md');
  if (!existsSync(p)) return res.json({ content: '' });
  res.json({ content: readFileSync(p, 'utf8') });
});

app.get('/api/wishes', (req, res) => {
  const p = join(SRC, 'wishes/wishes.txt');
  if (!existsSync(p)) return res.json({ content: '' });
  res.json({ content: readFileSync(p, 'utf8') });
});

app.listen(3131, () => console.log('glen mind server → http://localhost:3131'));
