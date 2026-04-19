<script>
  import { onMount } from 'svelte';
  import { getWishes } from '../lib/api.js';

  let wishes = [];
  let loading = true;

  const statusColor = {
    granted:  '#6a9a6a',
    deferred: '#aaa',
    pending:  '#b08040',
  };

  onMount(async () => {
    const data = await getWishes();
    wishes = parse(data.content || '');
    loading = false;
  });

  function parse(text) {
    return text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
      .map(line => {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 3) {
          return { date: parts[0], status: parts[1], description: parts.slice(2).join(' | ') };
        }
        return { date: '', status: '', description: line };
      });
  }
</script>

<div class="view">
  {#if loading}
    <p class="muted">loading…</p>
  {:else}
    <p class="filepath">wishes / wishes.txt</p>

    {#if !wishes.length}
      <p class="muted">no wishes recorded yet</p>
    {:else}
      <div class="list">
        {#each wishes as wish}
          <div class="wish">
            <div class="wish-meta">
              <span class="date">{wish.date}</span>
              <span class="status" style="color: {statusColor[wish.status] || '#aaa'}">{wish.status}</span>
            </div>
            <p class="description">{wish.description}</p>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .view {
    width: 100%;
    max-width: 720px;
  }

  .filepath {
    font-size: 0.72rem;
    color: #ccc;
    margin-bottom: 2rem;
    font-style: italic;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .wish {
    padding: 1rem 1.2rem;
    border: 1px solid #e0dbd0;
    border-radius: 2px;
  }

  .wish-meta {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.75rem;
  }

  .date   { color: #bbb; }
  .status { font-style: italic; }

  .description {
    font-size: 0.9rem;
    line-height: 1.65;
    color: #333;
  }

  .muted {
    color: #999;
    font-size: 0.85rem;
  }
</style>
