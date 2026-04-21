<script>
  import { onMount, onDestroy } from 'svelte';
  import { keypress } from '../stores.js';
  import { getGraph } from '../lib/api.js';

  let graph = { nodes: {}, edges: [] };
  let loading = true;
  let search = '';
  let nodeList = [];
  let selectedIndex = 0;

  $: filtered = search
    ? nodeList.filter(n => n.label.toLowerCase().includes(search.toLowerCase()))
    : nodeList;

  $: if (search !== undefined) selectedIndex = 0;

  $: selectedNode = filtered[selectedIndex] || null;

  $: outgoing = selectedNode
    ? graph.edges.filter(e => e.from === selectedNode.slug)
    : [];

  function up() {
    selectedIndex = Math.max(0, selectedIndex - 1);
  }

  function down() {
    selectedIndex = Math.min(filtered.length - 1, selectedIndex + 1);
  }

  function random() {
    if (!filtered.length) return;
    selectedIndex = Math.floor(Math.random() * filtered.length);
  }

  let unsub;
  onMount(async () => {
    graph = await getGraph();
    nodeList = Object.entries(graph.nodes).map(([slug, node]) => ({ slug, ...node }));
    loading = false;
    unsub = keypress.subscribe(kp => {
      if (!kp) return;
      if (kp.key === 'ArrowUp')   up();
      if (kp.key === 'ArrowDown') down();
      if (kp.key === ' ')         random();
    });
  });

  onDestroy(() => unsub?.());
</script>

<div class="view">
  {#if loading}
    <p class="muted">loading graph…</p>
  {:else}
    <div class="layout">
      <div class="left">
        <input
          bind:value={search}
          placeholder="search concepts…"
          class="search"
        />
        <div class="node-list">
          {#each filtered as node, i}
            <button
              class="node-item"
              class:selected={i === selectedIndex}
              on:click={() => selectedIndex = i}
            >
              {node.label}
            </button>
          {/each}
          {#if !filtered.length}
            <p class="muted small">no matches</p>
          {/if}
        </div>
        <p class="hint">↑↓ navigate · <kbd>space</kbd> random</p>
      </div>

      <div class="right">
        {#if selectedNode}
          <div class="node-header">
            <h2>{selectedNode.label}</h2>
            <span class="muted">{selectedNode.date || ''}</span>
          </div>

          {#if outgoing.length}
            <div class="edges">
              {#each outgoing as edge}
                <div class="edge">
                  <span class="to-label">{edge.to_label}</span>
                  {#if edge.relation !== 'connects_to'}
                    <span class="relation">{edge.relation}</span>
                  {/if}
                  {#if edge.note}
                    <p class="note">{edge.note}</p>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <p class="muted">no outgoing connections</p>
          {/if}
        {:else}
          <p class="muted">select a concept</p>
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
    grid-template-columns: 260px 1fr;
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

  .search {
    font-family: inherit;
    font-size: 0.85rem;
    background: none;
    border: none;
    border-bottom: 1px solid #ccc;
    padding: 0.4rem 0;
    color: #222;
    outline: none;
    margin-bottom: 1rem;
    flex-shrink: 0;
  }

  .search::placeholder {
    color: #ccc;
  }

  .node-list {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .node-item {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    font-family: inherit;
    font-size: 0.85rem;
    color: #555;
    padding: 0.32rem 0.5rem;
    cursor: pointer;
    border-radius: 2px;
  }

  .node-item:hover {
    background: #ece8de;
    color: #222;
  }

  .node-item.selected {
    background: #e8e3d8;
    color: #222;
  }

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

  .node-header {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  h2 {
    font-size: 1.5rem;
    font-weight: normal;
  }

  .edges {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .edge {
    padding: 0.8rem 1rem;
    border: 1px solid #e0dbd0;
    border-radius: 2px;
  }

  .to-label {
    font-size: 0.9rem;
    color: #222;
    display: block;
    margin-bottom: 0.25rem;
  }

  .relation {
    font-size: 0.78rem;
    color: #999;
    font-style: italic;
  }

  .note {
    font-size: 0.8rem;
    color: #888;
    margin-top: 0.4rem;
    line-height: 1.5;
  }

  .muted {
    color: #999;
    font-size: 0.85rem;
  }

  .small {
    font-size: 0.78rem;
  }
</style>
