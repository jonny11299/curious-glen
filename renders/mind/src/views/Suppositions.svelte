<script>
  import { onMount } from 'svelte';
  import { getSuppositions } from '../lib/api.js';
  import { marked } from 'marked';

  let content = '';
  let loading = true;

  onMount(async () => {
    const data = await getSuppositions();
    content = data.content || '';
    loading = false;
  });

  $: html = content ? marked.parse(content) : '';
</script>

<div class="view">
  {#if loading}
    <p class="muted">loading…</p>
  {:else}
    <p class="filepath">suppositions / self.md</p>
    <div class="prose">{@html html}</div>
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

  .prose {
    font-size: 0.95rem;
    line-height: 1.8;
    color: #444;
  }

  :global(.prose h1) {
    font-size: 1.8rem;
    font-weight: normal;
    color: #222;
    margin-bottom: 1.2rem;
    line-height: 1.2;
  }

  :global(.prose h2) {
    font-size: 1.15rem;
    font-weight: normal;
    color: #333;
    margin-top: 2.2rem;
    margin-bottom: 0.8rem;
  }

  :global(.prose p)      { margin-bottom: 1rem; }
  :global(.prose em)     { color: #666; }
  :global(.prose strong) { color: #222; }

  :global(.prose hr) {
    border: none;
    border-top: 1px solid #e0dbd0;
    margin: 2rem 0;
  }

  :global(.prose ul, .prose ol) {
    padding-left: 1.5rem;
    margin-bottom: 1rem;
  }

  :global(.prose li) { margin-bottom: 0.4rem; }

  .muted {
    color: #999;
    font-size: 0.85rem;
  }
</style>
