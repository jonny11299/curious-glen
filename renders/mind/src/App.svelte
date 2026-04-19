<script>
  import { currentView, keypress } from "./stores.js";
  import NavBar from "./components/NavBar.svelte";
  import Memories from "./views/Memories.svelte";
  import Graph from "./views/Graph.svelte";
  import Sessions from "./views/Sessions.svelte";
  import Suppositions from "./views/Suppositions.svelte";
  import Wishes from "./views/Wishes.svelte";

  const viewKeys = {
    "1": "memories",
    "2": "graph",
    "3": "sessions",
    "4": "suppositions",
    "5": "wishes",
  };

  function handleKeydown(e) {
    console.log(e);
    if (viewKeys[e.key]) {
      currentView.set(viewKeys[e.key]);
      return;
    }
    if (
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)
    ) {
      e.preventDefault();
      keypress.set({ key: e.key, ts: Date.now() });
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="app">
  <NavBar />
  <main>
    {#if $currentView === "memories"}
      <Memories />
    {:else if $currentView === "graph"}
      <Graph />
    {:else if $currentView === "sessions"}
      <Sessions />
    {:else if $currentView === "suppositions"}
      <Suppositions />
    {:else if $currentView === "wishes"}
      <Wishes />
    {/if}
  </main>
</div>

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    font-family: "Georgia", serif;
    background: #f5f2eb;
    color: #222;
    min-height: 100vh;
  }

  :global(::-webkit-scrollbar) {
    width: 4px;
  }

  :global(::-webkit-scrollbar-track) {
    background: transparent;
  }

  :global(::-webkit-scrollbar-thumb) {
    background: #ccc;
    border-radius: 2px;
  }

  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  main {
    flex: 1;
    display: flex;
    justify-content: center;
    padding: 2.5rem 2rem;
  }
</style>
