export async function getMemories() {
  const res = await fetch('/api/memories');
  return res.json();
}

export async function getGraph() {
  const res = await fetch('/api/graph');
  return res.json();
}

export async function getSessions() {
  const res = await fetch('/api/sessions');
  return res.json();
}

export async function getSession(date) {
  const res = await fetch(`/api/sessions/${date}`);
  return res.json();
}

export async function getSuppositions() {
  const res = await fetch('/api/suppositions');
  return res.json();
}

export async function getWishes() {
  const res = await fetch('/api/wishes');
  return res.json();
}
