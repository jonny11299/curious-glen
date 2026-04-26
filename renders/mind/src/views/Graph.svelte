<script>
  import { onMount, onDestroy } from "svelte";
  import * as d3 from "d3";
  import { getGraph } from "../lib/api.js";

  let svg;
  let container;
  let graph = { nodes: {}, edges: [] };
  let loading = true;
  let selected = null;
  let hoveredId = null;
  let width = 900;
  let height = 600;

  // force controls
  let charge = -30;
  let linkDist = 90;
  let linkStr = 0.65;
  let gravity = 0.5;
  let memorySize = 1.0; // multiplier for memory bubble base radius
  let conceptSize = 1.0; // multiplier for concept bubble radius

  // simulation state
  let simNodes = [];
  let simEdges = [];
  let simulation;
  let transform = { x: 0, y: 0, k: 1 };
  let dragNode = null;
  let dragStart = null;
  let panStart = null;

  $: activeEdgeIds = selected
    ? new Set(
        simEdges
          .filter((e) => e.source.id === selected || e.target.id === selected)
          .map((e) => `${e.source.id}--${e.target.id}`),
      )
    : new Set();

  $: connectedIds = selected
    ? new Set([
        ...simEdges
          .filter((e) => e.source.id === selected)
          .map((e) => e.target.id),
        ...simEdges
          .filter((e) => e.target.id === selected)
          .map((e) => e.source.id),
      ])
    : new Set();

  $: selectedNode = selected ? simNodes.find((n) => n.id === selected) : null;

  $: selectedEdges = selectedNode
    ? simEdges.filter(
        (e) => e.source.id === selected || e.target.id === selected,
      )
    : [];

  function nodeColor(n) {
    if (n.ghost) return "#c0b8a8";
    if (n.source === "human") return "#b87333";
    return "#5a8a9f";
  }

  function nodeRadius(n) {
    if (n.ghost) return Math.max(2, 4 * conceptSize);
    const degree = simEdges.filter(
      (e) => e.source.id === n.id || e.target.id === n.id,
    ).length;
    const base = Math.max(5, Math.min(16, 5 + degree * 0.6));
    return base * memorySize;
  }

  function tick() {
    simNodes = [...simNodes];
    simEdges = [...simEdges];
  }

  // update forces in-place when sliders change — never replace forceLink (would corrupt resolved node refs)
  // explicitly reference all slider vars so Svelte tracks them; do NOT reference simEdges/simNodes
  $: if (simulation) {
    const _ms = memorySize,
      _cs = conceptSize;
    simulation.force("charge")?.strength(charge);
    simulation.force("link")?.distance(linkDist).strength(linkStr);
    simulation.force("center")?.strength(gravity);
    simulation.force("collision")?.radius((d) => nodeRadius(d) + 4);
    simulation.alpha(0.3).restart();
  }

  onMount(async () => {
    graph = await getGraph();
    buildGraph();
    loading = false;
  });

  onDestroy(() => simulation?.stop());

  function buildGraph() {
    const nodeMap = {};

    for (const [slug, node] of Object.entries(graph.nodes)) {
      nodeMap[slug] = {
        id: slug,
        label: node.label,
        date: node.date,
        source: node.file?.startsWith("knowledge/human") ? "human" : "internet",
        ghost: false,
      };
    }

    for (const edge of graph.edges) {
      if (!nodeMap[edge.to]) {
        nodeMap[edge.to] = {
          id: edge.to,
          label: edge.to_label || edge.to,
          date: null,
          source: null,
          ghost: true,
        };
      }
    }

    const cx = width / 2;
    const cy = height / 2;
    simNodes = Object.values(nodeMap).map((n) => ({
      ...n,
      x: cx + (Math.random() - 0.5) * 200,
      y: cy + (Math.random() - 0.5) * 200,
    }));

    simEdges = graph.edges.map((e) => ({
      source: e.from,
      target: e.to,
      relation: e.relation,
      note: e.note,
    }));

    simulation = d3
      .forceSimulation(simNodes)
      .force(
        "link",
        d3
          .forceLink(simEdges)
          .id((d) => d.id)
          .distance(linkDist)
          .strength(linkStr),
      )
      .force("charge", d3.forceManyBody().strength(charge))
      .force("center", d3.forceCenter(cx, cy).strength(gravity))
      .force(
        "collision",
        d3.forceCollide((d) => nodeRadius(d) + 4),
      )
      .on("tick", tick);

    simNodes = [...simNodes];
    simEdges = [...simEdges];
  }

  function getCanvasPos(e) {
    const rect = container.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - transform.x) / transform.k,
      y: (e.clientY - rect.top - transform.y) / transform.k,
    };
  }

  function hitTest(x, y) {
    for (const n of simNodes) {
      const r = nodeRadius(n) + 4;
      const dx = n.x - x,
        dy = n.y - y;
      if (dx * dx + dy * dy < r * r) return n;
    }
    return null;
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    const pos = getCanvasPos(e);
    const hit = hitTest(pos.x, pos.y);
    if (hit) {
      dragNode = hit;
      dragStart = pos;
      simulation?.alphaTarget(0.3).restart();
    } else {
      panStart = {
        mx: e.clientX,
        my: e.clientY,
        tx: transform.x,
        ty: transform.y,
      };
    }
  }

  function onMouseMove(e) {
    if (dragNode) {
      const pos = getCanvasPos(e);
      dragNode.fx = pos.x;
      dragNode.fy = pos.y;
      simNodes = [...simNodes];
    } else if (panStart) {
      transform = {
        ...transform,
        x: panStart.tx + (e.clientX - panStart.mx),
        y: panStart.ty + (e.clientY - panStart.my),
      };
    } else {
      const pos = getCanvasPos(e);
      hoveredId = hitTest(pos.x, pos.y)?.id ?? null;
    }
  }

  function onMouseUp(e) {
    if (dragNode) {
      const pos = getCanvasPos(e);
      const dx = pos.x - dragStart.x,
        dy = pos.y - dragStart.y;
      if (dx * dx + dy * dy < 16) {
        selected = dragNode.id === selected ? null : dragNode.id;
      }
      dragNode.fx = null;
      dragNode.fy = null;
      simulation?.alphaTarget(0);
      dragNode = null;
    }
    panStart = null;
  }

  function onWheel(e) {
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = -e.deltaY * 0.001;
    const newK = Math.max(0.2, Math.min(4, transform.k * (1 + delta)));
    const ratio = newK / transform.k;
    transform = {
      k: newK,
      x: mx - ratio * (mx - transform.x),
      y: my - ratio * (my - transform.y),
    };
  }

  function edgeOpacity(e) {
    if (!selected) return 0.25;
    return activeEdgeIds.has(`${e.source.id}--${e.target.id}`) ? 0.85 : 0.08;
  }

  function nodeOpacity(n) {
    if (!selected) return 1;
    if (n.id === selected || connectedIds.has(n.id)) return 1;
    return 0.25;
  }
</script>

<div class="view">
  <!-- force controls -->
  <div class="controls">
    <p class="ctrl-title">forces</p>

    <label>repulsion<span>{charge}</span></label>
    <input type="range" min="-150" max="50" step="5" bind:value={charge} />

    <label>link pull<span>{linkDist}px</span></label>
    <input type="range" min="10" max="300" step="5" bind:value={linkDist} />

    <label>link strength<span>{linkStr.toFixed(2)}</span></label>
    <input type="range" min="0" max="1" step="0.05" bind:value={linkStr} />

    <label>gravity<span>{gravity.toFixed(2)}</span></label>
    <input type="range" min="0" max="1" step="0.05" bind:value={gravity} />

    <p class="ctrl-title" style="margin-top:1.2rem">bubbles</p>

    <label
      ><span class="dot memory-dot"></span>memory size<span
        >{memorySize.toFixed(1)}×</span
      ></label
    >
    <input type="range" min="0.3" max="3" step="0.1" bind:value={memorySize} />

    <label
      ><span class="dot concept-dot"></span>concept size<span
        >{conceptSize.toFixed(1)}×</span
      ></label
    >
    <input type="range" min="0.3" max="3" step="0.1" bind:value={conceptSize} />
  </div>

  <!-- graph canvas -->
  <div
    class="graph-wrap"
    bind:this={container}
    bind:clientWidth={width}
    bind:clientHeight={height}
    role="img"
    aria-label="concept graph"
    on:mousedown={onMouseDown}
    on:mousemove={onMouseMove}
    on:mouseup={onMouseUp}
    on:mouseleave={onMouseUp}
    on:wheel={onWheel}
    style="cursor: {dragNode
      ? 'grabbing'
      : panStart
        ? 'grabbing'
        : hoveredId
          ? 'pointer'
          : 'grab'}"
  >
    {#if loading}
      <p class="loading-msg">loading graph…</p>
    {:else}
      <svg {width} {height}>
        <g
          transform="translate({transform.x},{transform.y}) scale({transform.k})"
        >
          <g class="edges">
            {#each simEdges as e, i (i)}
              {#if e.source.x !== undefined && e.target.x !== undefined}
                <line
                  x1={e.source.x}
                  y1={e.source.y}
                  x2={e.target.x}
                  y2={e.target.y}
                  stroke={activeEdgeIds.has(e.source.id + "--" + e.target.id)
                    ? "#b87333"
                    : "#999"}
                  stroke-width={activeEdgeIds.has(
                    e.source.id + "--" + e.target.id,
                  )
                    ? 1.5
                    : 0.8}
                  opacity={edgeOpacity(e)}
                />
              {/if}
            {/each}
          </g>
          <g class="nodes">
            {#each simNodes as n (n.id)}
              {#if n.x !== undefined}
                {@const r = nodeRadius(n)}
                {@const col = nodeColor(n)}
                {@const op = nodeOpacity(n)}
                <circle
                  cx={n.x}
                  cy={n.y}
                  {r}
                  fill={col}
                  fill-opacity={op * (n.id === selected ? 1 : 0.82)}
                  stroke={n.id === selected ? "#222" : col}
                  stroke-width={n.id === selected ? 2 : 0.5}
                  opacity={op}
                />
                {#if !n.ghost || hoveredId === n.id}
                  <text
                    x={n.x}
                    y={n.y - r - 5}
                    text-anchor="middle"
                    font-size={n.ghost ? "8" : "10"}
                    fill={n.id === selected ? "#222" : "#555"}
                    opacity={op}
                    style="pointer-events:none; user-select:none;"
                    >{n.label.length > 32
                      ? n.label.slice(0, 30) + "…"
                      : n.label}</text
                  >
                {/if}
              {/if}
            {/each}
          </g>
        </g>
      </svg>
    {/if}

    <!-- legend -->
    <div class="legend">
      <span class="leg-dot human"></span> human
      <span class="leg-dot internet"></span> internet
      <span class="leg-dot ghost"></span> concept
    </div>
  </div>

  <!-- detail panel -->
  {#if selectedNode}
    <div class="detail">
      <button class="close" on:click={() => (selected = null)}>×</button>
      <div class="detail-source {selectedNode.source}">
        {selectedNode.source || "concept"}
      </div>
      <h3>{selectedNode.label}</h3>
      {#if selectedNode.date}<p class="date">{selectedNode.date}</p>{/if}
      {#if selectedEdges.length}
        <div class="conn-list">
          {#each selectedEdges as e}
            {@const other = e.source.id === selected ? e.target : e.source}
            {@const dir = e.source.id === selected ? "→" : "←"}
            <div
              class="conn-item"
              on:click={() => (selected = other.id)}
              role="button"
              tabindex="0"
              on:keydown={(ev) => ev.key === "Enter" && (selected = other.id)}
            >
              <span class="dir">{dir}</span>
              <span class="conn-label"
                >{other.label.length > 40
                  ? other.label.slice(0, 38) + "…"
                  : other.label}</span
              >
              {#if e.relation !== "connects_to"}<span class="rel"
                  >{e.relation}</span
                >{/if}
            </div>
          {/each}
        </div>
      {:else}
        <p class="muted">no connections</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .view {
    position: relative;
    width: 100%;
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }

  /* controls panel */
  .controls {
    width: 170px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 1rem 0.9rem;
    background: #faf8f3;
    border: 1px solid #ddd8cc;
    border-radius: 4px;
    font-size: 0.75rem;
    color: #666;
  }

  .ctrl-title {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #aaa;
    margin-bottom: 0.1rem;
  }

  .controls label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.3rem;
    color: #777;
    margin-top: 0.5rem;
  }

  .controls label span:last-child {
    font-variant-numeric: tabular-nums;
    color: #aaa;
    font-size: 0.7rem;
  }

  .controls input[type="range"] {
    width: 100%;
    accent-color: #b87333;
    margin: 0;
  }

  .dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .memory-dot {
    background: #7aadbb;
  }
  .concept-dot {
    background: #c0b8a8;
  }

  /* graph */
  .graph-wrap {
    flex: 1;
    height: calc(100vh - 9rem);
    background: #f0ece3;
    border-radius: 4px;
    overflow: hidden;
    position: relative;
    border: 1px solid #ddd8cc;
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  .loading-msg {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #aaa;
    font-size: 0.85rem;
  }

  /* detail panel */
  .detail {
    width: 240px;
    flex-shrink: 0;
    background: #faf8f3;
    border: 1px solid #ddd8cc;
    border-radius: 4px;
    padding: 1.2rem 1rem;
    overflow-y: auto;
    max-height: calc(100vh - 9rem);
    position: relative;
  }

  .close {
    position: absolute;
    top: 0.6rem;
    right: 0.7rem;
    background: none;
    border: none;
    font-size: 1.1rem;
    color: #bbb;
    cursor: pointer;
    line-height: 1;
    padding: 0;
  }
  .close:hover {
    color: #555;
  }

  .detail-source {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 0.4rem;
    color: #aaa;
  }
  .detail-source.human {
    color: #b87333;
  }
  .detail-source.internet {
    color: #5a8a9f;
  }

  h3 {
    font-size: 0.95rem;
    font-weight: normal;
    line-height: 1.4;
    margin-bottom: 0.25rem;
  }

  .date {
    font-size: 0.72rem;
    color: #aaa;
    margin-bottom: 1rem;
  }

  .conn-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .conn-item {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    padding: 0.45rem 0.5rem;
    border: 1px solid #e6e1d6;
    border-radius: 2px;
    cursor: pointer;
    font-size: 0.8rem;
  }
  .conn-item:hover {
    background: #ece8de;
  }

  .dir {
    color: #bbb;
    font-size: 0.72rem;
    flex-shrink: 0;
    padding-top: 1px;
  }

  .conn-label {
    color: #444;
    flex: 1;
    line-height: 1.4;
  }

  .rel {
    font-size: 0.68rem;
    color: #aaa;
    font-style: italic;
    flex-shrink: 0;
    padding-top: 1px;
  }

  .muted {
    font-size: 0.8rem;
    color: #bbb;
    margin-top: 0.5rem;
  }

  /* legend */
  .legend {
    position: absolute;
    bottom: 0.8rem;
    left: 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.8rem;
    font-size: 0.72rem;
    color: #888;
    pointer-events: none;
    background: rgba(240, 236, 227, 0.85);
    padding: 0.3rem 0.6rem;
    border-radius: 3px;
  }

  .leg-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 2px;
  }
  .leg-dot.human {
    background: #b87333;
  }
  .leg-dot.internet {
    background: #5a8a9f;
  }
  .leg-dot.ghost {
    background: #c0b8a8;
  }
</style>
