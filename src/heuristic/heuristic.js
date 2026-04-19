import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadHeuristics() {
  return JSON.parse(readFileSync(join(__dirname, 'weights.json'), 'utf-8'));
}

export function scoreArticle(article, heuristics) {
  const text = (article.title + ' ' + article.extract).toLowerCase();
  const scores = {};

  for (const [dimension, config] of Object.entries(heuristics.dimensions)) {
    const hits = config.keywords.filter(kw => text.includes(kw));
    scores[dimension] = (hits.length / config.keywords.length) * config.weight;
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;
  return { scores, total: parseFloat(total.toFixed(4)) };
}
