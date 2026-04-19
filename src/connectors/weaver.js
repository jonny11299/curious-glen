/*
  connectors/weaver.js
  ---------------------
  Builds and queries a concept graph from all of Glen's memory files.

  WHEN TO RUN
    After every session, once memories have been written:
      node src/connectors/builder.js
    This scans knowledge/internet/ and knowledge/human/ and writes
    the full graph to connectors/graph.json.

  QUERYING GLEN'S KNOWLEDGE
    Import query() to find how concepts are connected:

      import { query } from './src/connectors/weaver.js';

      query('juggling')
      // → what memories mention it, what it connects to

      query('desegregation')
      // → every memory that links to this concept, and from where

    This is a good way to test what Glen knows and how ideas are networked.
    Ask: "what does Glen know about X?" — query() answers it from the graph.

  MEMORY FORMAT
    Each memory file can contain:
      connects_to: ["concept", "another concept"]   ← loose associations
      connections: [{ concept, slug, relation, note }]  ← named, structured links

    weaver.js reads both and merges them into a single edge list.

  OUTPUT: connectors/graph.json
    {
      built: <ISO timestamp>,
      nodes: { slug: { label, file, date } },
      edges: [{ from, to, to_label, relation, note }]
    }
*/

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, relative } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = join(__dirname, '../knowledge');
const GRAPH_FILE = join(__dirname, 'graph.json');

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function scanDir(dir) {
  if (!existsSync(dir)) return [];
  const entries = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) entries.push(...scanDir(full));
    else if (entry.name.endsWith('.json')) entries.push(full);
  }
  return entries;
}

export function buildGraph() {
  const files = scanDir(KNOWLEDGE_DIR);
  const nodes = {};
  const edges = [];

  for (const filepath of files) {
    let memory;
    try {
      memory = JSON.parse(readFileSync(filepath, 'utf-8'));
    } catch {
      continue;
    }

    if (!memory.topic) continue;

    const slug = slugify(memory.topic);
    const ref = relative(join(__dirname, '..'), filepath);

    nodes[slug] = {
      label: memory.topic,
      file: ref,
      date: memory.date || null,
    };

    for (const target of memory.connects_to || []) {
      edges.push({ from: slug, to: slugify(target), to_label: target, relation: 'connects_to', note: null });
    }

    for (const conn of memory.connections || []) {
      edges.push({
        from: slug,
        to: conn.slug || slugify(conn.concept),
        to_label: conn.concept,
        relation: conn.relation || 'related',
        note: conn.note || null,
      });
    }
  }

  const graph = { built: new Date().toISOString(), nodes, edges };
  writeFileSync(GRAPH_FILE, JSON.stringify(graph, null, 2));
  return graph;
}

export function loadGraph() {
  if (!existsSync(GRAPH_FILE)) return buildGraph();
  return JSON.parse(readFileSync(GRAPH_FILE, 'utf-8'));
}

export function query(term) {
  const graph = loadGraph();
  const slug = slugify(term);
  const results = { as_source: [], as_target: [], node: null };

  if (graph.nodes[slug]) results.node = graph.nodes[slug];

  for (const edge of graph.edges) {
    if (edge.from === slug) results.as_source.push(edge);
    if (edge.to === slug) results.as_target.push(edge);
  }

  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const graph = buildGraph();
  console.log(`[connectors] graph built — ${Object.keys(graph.nodes).length} nodes, ${graph.edges.length} edges`);
}
