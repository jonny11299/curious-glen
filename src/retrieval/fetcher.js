import { N } from '../neurochemistry/constants.js';

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const BATCH_SIZE = 20;

async function getRandomPageIds(count) {
  const url = `${WIKI_API}?action=query&list=random&rnnamespace=0&rnlimit=${count}&format=json&origin=*`;
  const res = await fetch(url);
  const data = await res.json();
  return data.query.random.map(p => ({ id: p.id, title: p.title }));
}

async function getExtracts(pageIds) {
  const ids = pageIds.join('|');
  const url = `${WIKI_API}?action=query&prop=extracts&exintro=true&explaintext=true&pageids=${ids}&format=json&origin=*`;
  const res = await fetch(url);
  const data = await res.json();
  return Object.values(data.query.pages);
}

export async function fetchArticles(n = N) {
  const pages = await getRandomPageIds(n);
  const articles = [];

  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const batch = pages.slice(i, i + BATCH_SIZE);
    const extracts = await getExtracts(batch.map(p => p.id));
    for (const p of extracts) {
      articles.push({
        title: p.title,
        pageId: p.pageid,
        extract: p.extract || '',
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`
      });
    }
  }

  return articles;
}
