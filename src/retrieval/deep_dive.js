const WIKI_API = 'https://en.wikipedia.org/w/api.php';

export async function deepDive(pageId) {
  const url = `${WIKI_API}?action=query&prop=extracts&explaintext=true&pageids=${pageId}&format=json&origin=*`;
  const res = await fetch(url);
  const data = await res.json();
  const page = Object.values(data.query.pages)[0];
  return page.extract || '';
}
