<script>
  import { onMount, onDestroy } from 'svelte';
  import { keypress } from '../stores.js';
  import Pill from '../components/Pill.svelte';
  import { getMemories } from '../lib/api.js';

  let memories = [];
  let index = 0;
  let loading = true;

  onMount(async () => {
    memories = await getMemories();
    loading = false;
  });

  function prev() {
    if (!memories.length) return;
    index = (index - 1 + memories.length) % memories.length;
  }

  function next() {
    if (!memories.length) return;
    index = (index + 1) % memories.length;
  }

  function random() {
    if (!memories.length) return;
    index = Math.floor(Math.random() * memories.length);
  }

  const unsub = keypress.subscribe(kp => {
    if (!kp) return;
    if (kp.key === 'ArrowLeft')  prev();
    if (kp.key === 'ArrowRight') next();
    if (kp.key === ' ')          random();
  });

  onDestroy(unsub);

  $: memory = memories[index] || null;
</script>

<div class="view">
  {#if loading}
    <p class="muted">loading memories…</p>
  {:else if !memory}
    <p class="muted">no memories found</p>
  {:else}
    <div class="meta">
      <span class="muted">{memory.date || ''}</span>
      <span class="source" class:human={memory._source === 'human'}>
        {memory._source === 'human' ? 'from conversation' : 'from wikipedia'}
      </span>
    </div>

    <h1 class="topic">
      {#if memory.source_url}
        <a href={memory.source_url} target="_blank">{memory.topic}</a>
      {:else}
        {memory.topic}
      {/if}
    </h1>

    <p class="what">{memory.what}</p>

    {#if memory.why_interesting}
      <p class="why">{memory.why_interesting}</p>
    {/if}

    {#if memory.connects_to?.length}
      <div class="pills">
        {#each memory.connects_to as concept}
          <Pill text={concept} />
        {/each}
      </div>
    {/if}

    {#if memory.uncertainty}
      <p class="uncertainty">? {memory.uncertainty}</p>
    {/if}

    <div class="nav">
      <button class="btn" on:click={prev}>←</button>
      <span class="counter">{index + 1} / {memories.length}</span>
      <button class="btn" on:click={next}>→</button>
      <button class="btn" on:click={random}>random <kbd>space</kbd></button>
    </div>
  {/if}
</div>

<style>
  .view {
    width: 100%;
    max-width: 720px;
  }

  .meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: #999;
    margin-bottom: 1.5rem;
  }

  .source {
    color: #bbb;
  }

  .source.human {
    font-style: italic;
    color: #999;
  }

  .topic {
    font-size: 1.8rem;
    font-weight: normal;
    line-height: 1.2;
    margin-bottom: 1.2rem;
  }

  .topic a {
    color: inherit;
    text-decoration: none;
    border-bottom: 1px solid #bbb;
  }

  .topic a:hover {
    border-color: #555;
  }

  .what {
    font-size: 0.95rem;
    line-height: 1.75;
    color: #444;
    margin-bottom: 1rem;
  }

  .why {
    font-size: 0.9rem;
    line-height: 1.65;
    color: #666;
    font-style: italic;
    padding-left: 1rem;
    border-left: 2px solid #ddd;
    margin-bottom: 1.2rem;
  }

  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1.2rem;
  }

  .uncertainty {
    font-size: 0.85rem;
    color: #999;
    font-style: italic;
    margin-bottom: 1.5rem;
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

  .btn:hover {
    background: #e8e3d8;
  }

  kbd {
    font-family: inherit;
    font-size: 0.68rem;
    color: #bbb;
    border: 1px solid #ddd;
    border-radius: 2px;
    padding: 0.1rem 0.3rem;
    margin-left: 0.3rem;
  }

  .muted {
    color: #999;
    font-size: 0.9rem;
  }
</style>
