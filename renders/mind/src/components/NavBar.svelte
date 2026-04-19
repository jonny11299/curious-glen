<script>
  import { currentView } from '../stores.js';

  const views = [
    { key: '1', id: 'memories',     label: 'memories'     },
    { key: '2', id: 'graph',        label: 'graph'        },
    { key: '3', id: 'sessions',     label: 'sessions'     },
    { key: '4', id: 'suppositions', label: 'suppositions' },
    { key: '5', id: 'wishes',       label: 'wishes'       },
  ];
</script>

<nav>
  <span class="brand">curious glen</span>
  <div class="tabs">
    {#each views as v}
      <button class:active={$currentView === v.id} on:click={() => currentView.set(v.id)}>
        <span class="num">{v.key}</span>{v.label}
      </button>
    {/each}
  </div>
</nav>

<style>
  nav {
    display: flex;
    align-items: center;
    gap: 2rem;
    padding: 0.75rem 2rem;
    border-bottom: 1px solid #e0dbd0;
    background: #f5f2eb;
  }

  .brand {
    font-size: 0.78rem;
    color: #bbb;
    letter-spacing: 0.04em;
    white-space: nowrap;
    font-style: italic;
  }

  .tabs {
    display: flex;
    gap: 0.1rem;
  }

  button {
    background: none;
    border: none;
    font-family: inherit;
    font-size: 0.82rem;
    color: #999;
    cursor: pointer;
    padding: 0.3rem 0.75rem;
    border-radius: 2px;
    transition: color 0.12s, background 0.12s;
  }

  button:hover {
    color: #333;
    background: #ece8de;
  }

  button.active {
    color: #222;
    background: #e8e3d8;
  }

  .num {
    color: #ccc;
    font-size: 0.68rem;
    margin-right: 0.35rem;
  }

  button.active .num {
    color: #aaa;
  }
</style>
