<script>
  import { onMount, onDestroy } from 'svelte';
  import { keypress } from '../stores.js';
  import { getSessions, getSession } from '../lib/api.js';
  import { marked } from 'marked';
  import Pill from '../components/Pill.svelte';

  let dates = [];
  let dateIndex = 0;
  let session = null;
  let tab = 'raw';
  let articleIndex = 0;
  let loading = true;
  let sessionLoading = false;

  onMount(async () => {
    dates = await getSessions();
    loading = false;
    if (dates.length) loadSession(0);
  });

  async function loadSession(i) {
    dateIndex = i;
    articleIndex = 0;
    sessionLoading = true;
    session = await getSession(dates[i]);
    sessionLoading = false;
  }

  function prevDate() { if (dates.length) loadSession((dateIndex - 1 + dates.length) % dates.length); }
  function nextDate() { if (dates.length) loadSession((dateIndex + 1) % dates.length); }
  function randomDate() { if (dates.length) loadSession(Math.floor(Math.random() * dates.length)); }

  function prevArticle() {
    if (!rawArticles.length) return;
    articleIndex = (articleIndex - 1 + rawArticles.length) % rawArticles.length;
  }

  function nextArticle() {
    if (!rawArticles.length) return;
    articleIndex = (articleIndex + 1) % rawArticles.length;
  }

  const unsub = keypress.subscribe(kp => {
    if (!kp) return;
    if (tab === 'raw') {
      if (kp.key === 'ArrowLeft')  prevArticle();
      if (kp.key === 'ArrowRight') nextArticle();
      if (kp.key === 'ArrowUp')    prevDate();
      if (kp.key === 'ArrowDown')  nextDate();
      if (kp.key === ' ')          () => { articleIndex = Math.floor(Math.random() * rawArticles.length); };
    } else {
      if (kp.key === 'ArrowUp')   prevDate();
      if (kp.key === 'ArrowDown') nextDate();
      if (kp.key === ' ')         randomDate();
    }
  });

  onDestroy(unsub);

  $: rawArticles = session?.raw?.articles ?? (Array.isArray(session?.raw) ? session.raw : []);
  $: article = rawArticles[articleIndex] || null;
  $: conversationHtml = session?.conversation ? marked.parse(session.conversation) : '';
  $: reportEntries = session?.report
    ? Object.entries(session.report).filter(([, v]) => typeof v !== 'object' && v !== null)
    : [];
</script>

<div class="view">
  {#if loading}
    <p class="muted">loading sessions…</p>
  {:else if !dates.length}
    <p class="muted">no sessions found</p>
  {:else}
    <div class="layout">
      <div class="left">
        <p class="section-label">sessions</p>
        <div class="date-list">
          {#each dates as date, i}
            <button
              class="date-item"
              class:selected={i === dateIndex}
              on:click={() => loadSession(i)}
            >{date}</button>
          {/each}
        </div>
        <p class="hint">↑↓ date · <kbd>space</kbd> random</p>
      </div>

      <div class="right">
        {#if sessionLoading}
          <p class="muted">loading…</p>
        {:else if session}
          <div class="tabs">
            <button class:active={tab === 'raw'}          on:click={() => { tab = 'raw'; articleIndex = 0; }}>raw articles</button>
            <button class:active={tab === 'report'}       on:click={() => tab = 'report'}>report</button>
            <button class:active={tab === 'conversation'} on:click={() => tab = 'conversation'}>conversation</button>
          </div>

          {#if tab === 'raw'}
            {#if !rawArticles.length}
              <p class="muted">no articles in this session</p>
            {:else if article}
              <div class="article-meta">
                <span class="muted">{session.date}</span>
                <span class="muted">heuristic: {article.heuristic?.total ?? '—'}</span>
              </div>

              {#if article.heuristic?.scores}
                <div class="pills">
                  {#each Object.entries(article.heuristic.scores) as [k, v]}
                    <Pill text="{k} {(v * 100).toFixed(0)}%" />
                  {/each}
                </div>
              {/if}

              <h2 class="article-title">
                <a href={article.url} target="_blank">{article.title}</a>
              </h2>

              <p class="extract">{article.extract || '(no extract)'}</p>

              <div class="nav">
                <button class="btn" on:click={prevArticle}>←</button>
                <span class="counter">{articleIndex + 1} / {rawArticles.length}</span>
                <button class="btn" on:click={nextArticle}>→</button>
                <button class="btn" on:click={() => articleIndex = Math.floor(Math.random() * rawArticles.length)}>
                  random <kbd>space</kbd>
                </button>
              </div>
            {/if}

          {:else if tab === 'report'}
            <div class="report">
              {#if reportEntries.length}
                <dl>
                  {#each reportEntries as [k, v]}
                    <div class="report-row">
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  {/each}
                </dl>
              {:else}
                <p class="muted">no report for this date</p>
              {/if}
            </div>

          {:else if tab === 'conversation'}
            {#if session.conversation}
              <div class="conversation">{@html conversationHtml}</div>
            {:else}
              <p class="muted">no conversation transcript for this date</p>
            {/if}
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .view {
    width: 100%;
    max-width: 900px;
  }

  .layout {
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: 2.5rem;
    height: calc(100vh - 9rem);
  }

  .left {
    display: flex;
    flex-direction: column;
    border-right: 1px solid #e0dbd0;
    padding-right: 2rem;
    min-height: 0;
  }

  .section-label {
    font-size: 0.68rem;
    color: #ccc;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 0.8rem;
    flex-shrink: 0;
  }

  .date-list {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .date-item {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    font-family: inherit;
    font-size: 0.82rem;
    color: #666;
    padding: 0.28rem 0.4rem;
    cursor: pointer;
    border-radius: 2px;
  }

  .date-item:hover  { background: #ece8de; color: #222; }
  .date-item.selected { background: #e8e3d8; color: #222; }

  .hint {
    font-size: 0.72rem;
    color: #ccc;
    padding-top: 0.8rem;
    border-top: 1px solid #eee;
    margin-top: 0.5rem;
    flex-shrink: 0;
  }

  kbd {
    font-family: inherit;
    font-size: 0.68rem;
    color: #bbb;
    border: 1px solid #ddd;
    border-radius: 2px;
    padding: 0.1rem 0.3rem;
  }

  .right {
    overflow-y: auto;
    min-height: 0;
  }

  .tabs {
    display: flex;
    gap: 0.3rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid #e0dbd0;
    padding-bottom: 0.75rem;
  }

  .tabs button {
    background: none;
    border: none;
    font-family: inherit;
    font-size: 0.82rem;
    color: #999;
    cursor: pointer;
    padding: 0.2rem 0.5rem;
    border-radius: 2px;
  }

  .tabs button:hover  { color: #333; background: #ece8de; }
  .tabs button.active { color: #222; font-style: italic; }

  .article-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: #999;
    margin-bottom: 1rem;
  }

  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .article-title {
    font-size: 1.6rem;
    font-weight: normal;
    line-height: 1.2;
    margin-bottom: 1rem;
  }

  .article-title a {
    color: inherit;
    text-decoration: none;
    border-bottom: 1px solid #bbb;
  }

  .article-title a:hover { border-color: #555; }

  .extract {
    font-size: 0.92rem;
    line-height: 1.7;
    color: #444;
    max-height: 38vh;
    overflow-y: auto;
  }

  .nav {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 2rem;
  }

  .counter {
    font-size: 0.8rem;
    color: #999;
    flex: 1;
    text-align: center;
  }

  .btn {
    background: none;
    border: 1px solid #aaa;
    padding: 0.5rem 1.2rem;
    font-family: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    color: #444;
    border-radius: 2px;
    transition: background 0.15s;
  }

  .btn:hover { background: #e8e3d8; }

  .report dl {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .report-row {
    display: flex;
    gap: 1.5rem;
    font-size: 0.88rem;
  }

  .report-row dt {
    color: #aaa;
    min-width: 110px;
    flex-shrink: 0;
  }

  .report-row dd { color: #333; }

  .conversation {
    font-size: 0.92rem;
    line-height: 1.75;
    color: #444;
  }

  :global(.conversation h1, .conversation h2, .conversation h3) {
    font-weight: normal;
    margin: 1.5rem 0 0.8rem;
    color: #222;
  }

  :global(.conversation p)      { margin-bottom: 1rem; }
  :global(.conversation strong) { color: #222; }
  :global(.conversation em)     { color: #666; }

  .muted {
    color: #999;
    font-size: 0.85rem;
  }
</style>
