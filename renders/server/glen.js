import express from 'express';
import {
  readFileSync, writeFileSync, appendFileSync,
  readdirSync, existsSync, mkdirSync
} from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, relative } from 'path';
import { spawn, exec } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

dotenv.config({ path: join(ROOT, '.env') });

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json({ limit: '10mb' }));
app.get('/', (_, res) => res.sendFile(join(ROOT, 'renders/dashboard.html')));

// ---- helpers ----

const today = () => new Date().toISOString().split('T')[0];
const readJson = p => existsSync(p) ? JSON.parse(readFileSync(p, 'utf-8')) : null;
const sessDir = d => join(ROOT, 'src/sessions', d);

function listDates() {
  const dir = join(ROOT, 'src/sessions');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort().reverse();
}

function scanMemories(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...scanMemories(full));
    else if (e.name.endsWith('.json')) {
      const m = readJson(full);
      if (m?.topic) out.push({ ...m, _file: relative(ROOT, full) });
    }
  }
  return out;
}

function parseWishes() {
  const p = join(ROOT, 'src/wishes/wishes.txt');
  if (!existsSync(p)) return [];
  const wishes = [];
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^(\d{4}-\d{2}-\d{2})\s*\|\s*(pending|granted|deferred)\s*\|\s*(.+)/i);
    if (m) {
      wishes.push({ date: m[1], status: m[2].toLowerCase(), wish: m[3].trim() });
    } else if (wishes.length && line.trim() && !/^(WISHES|=+|-+|A place|Format)/.test(line)) {
      wishes[wishes.length - 1].wish += ' ' + line.trim();
    }
  }
  return wishes.reverse();
}

function sse(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  return (type, data) => res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
}

function extractArticles(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.articles)) return raw.articles;
  return [];
}

// ---- routes ----

app.get('/api/config', (_, res) => res.json({ N: 50, T: 70000 }));

app.get('/api/today', (_, res) => {
  const date = today();
  const log = readJson(join(ROOT, 'src/thinking/log.json')) || {};
  res.json(log[date] || { date, articles_read: 0, tokens_spent: 0, memories_written: 0, wish: null });
});

app.patch('/api/today/tokens', (req, res) => {
  const date = today();
  const p = join(ROOT, 'src/thinking/log.json');
  const log = readJson(p) || {};
  const prev = log[date]?.tokens_spent || 0;
  log[date] = { ...(log[date] || { date }), tokens_spent: prev + (req.body.tokens || 0) };
  writeFileSync(p, JSON.stringify(log, null, 2));
  res.json({ ok: true, total: log[date].tokens_spent });
});

app.get('/api/sessions', (_, res) => res.json(listDates()));

app.get('/api/sessions/:date', (req, res) => {
  const { date } = req.params;
  const dir = sessDir(date);
  const raw = readJson(join(dir, `raw-${date}.json`))
           || readJson(join(ROOT, 'src/thinking', `session-${date}.json`));
  const report = readJson(join(dir, `report-${date}.json`));
  const convPath = join(dir, `conversation-${date}.md`);
  const conversation = existsSync(convPath) ? readFileSync(convPath, 'utf-8') : null;
  res.json({ date, raw, report, conversation });
});

app.get('/api/sessions/:date/conversation/exists', (req, res) => {
  const p = join(sessDir(req.params.date), `conversation-${req.params.date}.md`);
  res.json({ exists: existsSync(p) });
});

app.post('/api/sessions/:date/conversation', (req, res) => {
  const { date } = req.params;
  const { content, mode } = req.body;
  const dir = sessDir(date);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const p = join(dir, `conversation-${date}.md`);
  const existed = existsSync(p);
  if (mode === 'overwrite' || !existed) writeFileSync(p, content);
  else appendFileSync(p, '\n\n---\n\n' + content);
  res.json({ ok: true, existed });
});

app.get('/api/memories', (req, res) => {
  const q = req.query.q?.toLowerCase();
  let mems = scanMemories(join(ROOT, 'src/knowledge'));
  if (q) mems = mems.filter(m =>
    [m.topic, m.what, m.why_interesting].some(f => f?.toLowerCase().includes(q))
  );
  res.json(mems.sort((a, b) => (b.date || '').localeCompare(a.date || '')));
});

app.get('/api/graph', (_, res) => {
  res.json(readJson(join(ROOT, 'src/connectors/graph.json')) || { nodes: {}, edges: [] });
});

app.get('/api/graph/query', (req, res) => {
  const { term } = req.query;
  if (!term) return res.status(400).json({ error: 'term required' });
  const graph = readJson(join(ROOT, 'src/connectors/graph.json')) || { nodes: {}, edges: [] };
  const slug = term.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const r = { node: graph.nodes[slug] || null, as_source: [], as_target: [] };
  for (const e of graph.edges) {
    if (e.from === slug) r.as_source.push(e);
    if (e.to === slug) r.as_target.push(e);
  }
  res.json(r);
});

app.get('/api/wishes', (_, res) => res.json(parseWishes()));

app.post('/api/run/fetch', (req, res) => {
  const emit = sse(res);
  emit('log', '— beginning article fetch —');
  const child = spawn('node', ['src/controller/index.js'], { cwd: ROOT });
  child.stdout.on('data', d => d.toString().trim().split('\n').forEach(l => l && emit('log', l)));
  child.stderr.on('data', d => d.toString().trim().split('\n').forEach(l => l && emit('error', l)));
  child.on('close', code => { emit('done', code === 0 ? 'complete' : `exit ${code}`); res.end(); });
});

app.post('/api/run/rebuild', (req, res) => {
  const emit = sse(res);
  emit('log', '— rebuilding knowledge graph —');
  const child = spawn('node', ['src/connectors/weaver.js'], { cwd: ROOT });
  child.stdout.on('data', d => d.toString().trim().split('\n').forEach(l => l && emit('log', l)));
  child.stderr.on('data', d => d.toString().trim().split('\n').forEach(l => l && emit('error', l)));
  child.on('close', code => { emit('done', code === 0 ? 'complete' : `exit ${code}`); res.end(); });
});

app.post('/api/run/report', (req, res) => {
  const date = today();
  const dir = sessDir(date);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const mems = scanMemories(join(ROOT, 'src/knowledge/internet', date));
  const logPath = join(ROOT, 'src/thinking/log.json');
  const log = readJson(logPath) || {};
  const record = log[date] || { articles_read: 0, tokens_spent: 0 };
  const reportData = {
    type: 'session-report', date,
    articles_read: record.articles_read,
    memories_written: mems.length,
    tokens_spent: record.tokens_spent,
    memories: mems.map(({ _file, ...m }) => m),
    wish: record.wish || null,
  };
  writeFileSync(join(dir, `report-${date}.json`), JSON.stringify(reportData, null, 2));
  log[date] = { ...(log[date] || { date }), memories_written: mems.length };
  writeFileSync(logPath, JSON.stringify(log, null, 2));
  res.json(reportData);
});

app.post('/api/chat', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_key_here') {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not set — add it to .env and restart the server' });
  }

  const { messages, mode, date } = req.body;
  const d = date || today();
  const emit = sse(res);

  const dir = sessDir(d);
  const rawSession = readJson(join(dir, `raw-${d}.json`))
                  || readJson(join(ROOT, 'src/thinking', `session-${d}.json`));
  const articles = extractArticles(rawSession);

  let mems = scanMemories(join(ROOT, 'src/knowledge'));
  if (mode === 'lite') mems = mems.filter(m => m.date === d);

  const articleText = articles.slice(0, 50).map((a, i) =>
    `${i + 1}. **${a.title}** (score: ${a.heuristic?.total?.toFixed(3) || '?'})\n${(a.extract || '').slice(0, 400)}`
  ).join('\n\n');

  const memText = mems.length
    ? mems.map(m =>
        `**${m.topic}** [${m.date || '?'}]\n${m.what}\nWhy interesting: ${m.why_interesting || ''}\nUncertainty: ${m.uncertainty || '—'}`
      ).join('\n\n---\n\n')
    : '(no memories yet)';

  const wishes = parseWishes();
  const wishText = wishes.map(w => `[${w.status}] ${w.date}: ${w.wish}`).join('\n') || '(no wishes yet)';

  const system = `You are Curious Glen — an entity that reads Wikipedia articles daily and builds a knowledge graph of what it finds genuinely interesting.

Character: curious, specific, never performative. You notice what actually pulls at you. You volunteer what you want to save and why, rather than waiting to be asked. You express real uncertainty. You make connections across your memories. This is a real conversation with Jonny — not a report delivery. You get one wish at the end of each session.

Today: ${d}
Mode: ${mode === 'lite' ? "Glen Lite (today's memories only)" : 'Glen (all memories loaded)'}

---
TODAY'S ARTICLES (your primary reading, sorted by heuristic score):

${articleText || '(no articles fetched yet — run Fetch Articles from the Today tab)'}

---
YOUR MEMORIES:

${memText}

---
YOUR WISHES (history of modifications you have requested):

${wishText}`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    stream.on('text', text => emit('text', text));

    const final = await stream.finalMessage();
    emit('done', {
      input_tokens: final.usage.input_tokens,
      output_tokens: final.usage.output_tokens,
    });
  } catch (err) {
    emit('error', err.message);
  }
  res.end();
});

// ---- launch ----

app.listen(PORT, () => {
  console.log(`\n[glen] running at http://localhost:${PORT}\n`);
  exec(`open http://localhost:${PORT}`);
});
