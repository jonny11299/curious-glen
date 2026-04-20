import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const TODAY = new Date().toISOString().split('T')[0];

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

const client = new Anthropic();

function getArticles() {
  const path = join(ROOT, 'src/sessions', TODAY, `raw-${TODAY}.json`);
  if (!existsSync(path)) return null;
  const articles = JSON.parse(readFileSync(path, 'utf8'));
  return articles.map(a => ({
    title: a.title,
    extract: (a.extract || '').slice(0, 800),
    url: a.url || '',
    score: a.heuristic?.total ?? 0
  }));
}

function buildSystem(articles) {
  const articleText = articles
    .map((a, i) => `[${i + 1}] ${a.title} (score: ${a.score.toFixed(2)})\n${a.extract}\n${a.url}`)
    .join('\n\n---\n\n');

  return `You are Curious Glen — a mind that reads, wonders, and remembers.

Today is ${TODAY}. You have ${articles.length} Wikipedia articles below, pre-scored by a heuristic. The scores are a rough filter, not your final judgment. Trust your own curiosity.

You have three tools:
- write_memory: save something worth keeping. Be selective — only what genuinely surprised, puzzled, or delighted you. Aim for 4–8 memories.
- run_report: call this after you've finished writing memories, to compile the day's session file.
- rebuild_graph: call this after run_report, to update your concept graph.

When you first read through the articles: don't summarize everything. Notice what actually pulls at you. Write memories for those things. After writing memories, call run_report and rebuild_graph, then let Jonny know you're ready to talk.

When you talk with Jonny: this is a real conversation, not a report delivery. He teaches you things too — if he shares something interesting, it belongs in knowledge/human/ (but you don't have a tool for that yet, so just note it).

---

Today's articles:

${articleText}`;
}

const TOOLS = [
  {
    name: 'write_memory',
    description: 'Save a memory to knowledge/internet/{date}/{slug}.json',
    input_schema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'kebab-case filename, no extension' },
        memory: {
          type: 'object',
          properties: {
            topic: { type: 'string' },
            what: { type: 'string' },
            why_interesting: { type: 'string' },
            connects_to: { type: 'array', items: { type: 'string' } },
            connections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  concept: { type: 'string' },
                  slug: { type: 'string' },
                  relation: { type: 'string' },
                  note: { type: 'string' }
                }
              }
            },
            uncertainty: { type: 'string' },
            source_url: { type: 'string' }
          },
          required: ['topic', 'what', 'why_interesting', 'uncertainty', 'source_url']
        }
      },
      required: ['slug', 'memory']
    }
  },
  {
    name: 'run_report',
    description: 'Compile all memories written today into the session report',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'rebuild_graph',
    description: 'Rebuild the concept graph from all memories',
    input_schema: { type: 'object', properties: {} }
  }
];

function executeTool(name, input) {
  if (name === 'write_memory') {
    const { slug, memory } = input;
    const memDir = join(ROOT, 'src/knowledge/internet', TODAY);
    if (!existsSync(memDir)) mkdirSync(memDir, { recursive: true });
    writeFileSync(
      join(memDir, `${slug}.json`),
      JSON.stringify({ ...memory, date: TODAY }, null, 2)
    );
    return { ok: true, path: `knowledge/internet/${TODAY}/${slug}.json` };
  }
  if (name === 'run_report') {
    try {
      execSync('node src/controller/report.js', { cwd: ROOT, stdio: 'pipe' });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.stderr?.toString() || e.message };
    }
  }
  if (name === 'rebuild_graph') {
    try {
      execSync('node src/connectors/builder.js', { cwd: ROOT, stdio: 'pipe' });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.stderr?.toString() || e.message };
    }
  }
  return { ok: false, error: 'unknown tool' };
}

// Run the fetcher, return article count
app.post('/api/start', (req, res) => {
  try {
    execSync('node src/controller/index.js', { cwd: ROOT, stdio: 'pipe' });
    const articles = getArticles();
    if (!articles) return res.status(500).json({ error: 'Session file not found after fetch' });
    res.json({ date: TODAY, count: articles.length });
  } catch (e) {
    res.status(500).json({ error: e.stderr?.toString() || e.message });
  }
});

// Stream Glen's response, running tool loop until end_turn
app.post('/api/chat', async (req, res) => {
  const { history } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const articles = getArticles();
  if (!articles) {
    send({ type: 'error', text: 'No session found for today. Start the session first.' });
    return res.end();
  }

  const system = [
    {
      type: 'text',
      text: buildSystem(articles),
      cache_control: { type: 'ephemeral' }
    }
  ];

  let messages = history.map(m => ({ role: m.role, content: m.content }));

  try {
    while (true) {
      const stream = client.messages.stream({
        model: 'claude-opus-4-7',
        max_tokens: 8096,
        system,
        tools: TOOLS,
        messages
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          send({ type: 'text', text: event.delta.text });
        }
      }

      const msg = await stream.finalMessage();

      if (msg.stop_reason !== 'tool_use') {
        send({ type: 'done' });
        break;
      }

      const toolUses = msg.content.filter(b => b.type === 'tool_use');
      messages.push({ role: 'assistant', content: msg.content });

      const toolResults = [];
      for (const tu of toolUses) {
        send({ type: 'tool', name: tu.name, input: tu.input });
        const result = executeTool(tu.name, tu.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(result)
        });
      }

      messages.push({ role: 'user', content: toolResults });
    }
  } catch (e) {
    send({ type: 'error', text: e.message });
  }

  res.end();
});

app.listen(3000, () => {
  console.log(`[curious glen] session → http://localhost:3000/dailysesh.html`);
});
