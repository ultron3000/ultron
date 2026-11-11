/* Cloud TV — universal catalogue search. Uses only repository catalogue metadata. */
(() => {
  "use strict";
  const INPUTS = ["#mainSearch", "#sidebarSearch", "#searchInput", "#globalPortalSearch", "#searchBar"];
  const state = { records: [], query: "", type: "all", active: 0, ready: false, loading: false };
  const normalize = value => String(value || "").normalize("NFKD").toLocaleLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const escapeText = value => String(value || "");
  const root = document.createElement("section");
  root.id = "universalSearchLayer";
  root.setAttribute("aria-label", "Universal search results");
  root.hidden = true;
  root.innerHTML = `
    <style>
      #universalSearchLayer{position:fixed;inset:78px 0 0;z-index:10050;background:rgba(3,7,18,.97);backdrop-filter:blur(18px);overflow:auto;color:#f8fafc;padding:clamp(14px,3vw,32px)}
      #universalSearchLayer[hidden]{display:none}
      #universalSearchLayer .us-wrap{max-width:1180px;margin:0 auto}
      #universalSearchLayer .us-top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}
      #universalSearchLayer .us-heading{font-size:clamp(20px,3vw,28px);font-weight:800;letter-spacing:-.03em}
      #universalSearchLayer .us-muted{color:#94a3b8;font-size:13px}
      #universalSearchLayer .us-close{border:1px solid #334155;background:#0f172a;color:#e2e8f0;border-radius:12px;padding:9px 13px;cursor:pointer}
      #universalSearchLayer .us-filters{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}
      #universalSearchLayer .us-filter{border:1px solid #334155;color:#cbd5e1;background:#0f172a;border-radius:999px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer}
      #universalSearchLayer .us-filter[aria-pressed=true]{background:#06b6d4;color:#04111a;border-color:#06b6d4}
      #universalSearchLayer .us-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px}
      #universalSearchLayer .us-card{display:flex;flex-direction:column;text-align:left;min-width:0;border:1px solid rgba(148,163,184,.18);background:linear-gradient(145deg,rgba(30,41,59,.88),rgba(15,23,42,.94));border-radius:16px;overflow:hidden;color:inherit;text-decoration:none;transition:transform .18s,border-color .18s}
      #universalSearchLayer .us-card:hover,#universalSearchLayer .us-card:focus-visible{transform:translateY(-3px);border-color:#22d3ee;outline:none}
      #universalSearchLayer .us-card img{width:100%;aspect-ratio:2/3;object-fit:cover;background:#111827}
      #universalSearchLayer .us-card .us-noimg{width:100%;aspect-ratio:2/3;display:grid;place-items:center;background:radial-gradient(circle at top,#164e63,#111827 70%);font-size:36px;color:#67e8f9}
      #universalSearchLayer .us-card-body{padding:11px;display:grid;gap:5px}
      #universalSearchLayer .us-title{font-size:13px;line-height:1.35;font-weight:750;overflow-wrap:anywhere}
      #universalSearchLayer .us-meta{font-size:11px;color:#94a3b8;text-transform:capitalize}
      #universalSearchLayer .us-empty{border:1px dashed #475569;border-radius:16px;padding:34px 18px;text-align:center;color:#cbd5e1}
      #universalSearchLayer .us-hint{margin-top:16px;color:#64748b;font-size:11px}
      @media(max-width:600px){#universalSearchLayer{inset:64px 0 0;padding:14px}#universalSearchLayer .us-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}
      @media(prefers-reduced-motion:reduce){#universalSearchLayer *{transition:none!important}}
    </style>
    <div class="us-wrap">
      <div class="us-top"><div><div class="us-heading">Search the Cloud TV universe</div><div class="us-muted" id="usSummary">Search movies, series, live channels and collections</div></div><button class="us-close" type="button" id="usClose" aria-label="Close search">Close ✕</button></div>
      <div class="us-filters" role="group" aria-label="Filter results">
        <button class="us-filter" data-type="all" aria-pressed="true">All</button>
        <button class="us-filter" data-type="movie" aria-pressed="false">Movies</button>
        <button class="us-filter" data-type="series" aria-pressed="false">Series</button>
        <button class="us-filter" data-type="live" aria-pressed="false">Live TV</button>
        <button class="us-filter" data-type="collection" aria-pressed="false">Collections</button>
      </div>
      <div id="usResults" class="us-grid" aria-live="polite"></div>
      <div class="us-hint">Tip: use ↑ ↓ to move through results, Enter to open, and Esc to close.</div>
    </div>`;
  document.body.appendChild(root);
  const results = root.querySelector("#usResults");
  const summary = root.querySelector("#usSummary");
  const inputs = INPUTS.flatMap(selector => [...document.querySelectorAll(selector)]).filter((el, i, all) => all.indexOf(el) === i);
  const activeInput = () => inputs.find(el => document.activeElement === el) || inputs[0];
  function close() { root.hidden = true; state.active = 0; }
  function open() { root.hidden = false; }
  async function load() {
    if (state.ready || state.loading) return;
    state.loading = true;
    try {
      const response = await fetch(new URL("universal-search-index.json", document.baseURI), { cache: "no-cache" });
      if (!response.ok) throw new Error("Search catalogue unavailable");
      const data = await response.json();
      state.records = Array.isArray(data.records) ? data.records : [];
      state.ready = true;
    } catch (error) {
      summary.textContent = "Could not load the repository search catalogue. Please refresh and try again.";
    } finally { state.loading = false; }
  }
  function rank(record, query) {
    const title = normalize(record.title), description = normalize(record.description), category = normalize(record.category), language = normalize(record.language);
    if (title === query) return 100;
    if (title.startsWith(query)) return 70;
    if (title.includes(query)) return 55;
    if (category.includes(query) || language.includes(query)) return 25;
    if (description.includes(query)) return 10;
    const terms = query.split(" ").filter(Boolean);
    const haystack = title + " " + category + " " + language + " " + description;
    return terms.every(term => haystack.includes(term)) ? 5 : 0;
  }
  function render() {
    const query = normalize(state.query);
    if (!query) { results.replaceChildren(); summary.textContent = "Search movies, series, live channels and collections"; return; }
    const found = state.records.map(record => ({ record, score: rank(record, query) }))
      .filter(item => item.score > 0 && (state.type === "all" || item.record.type === state.type))
      .sort((a,b) => b.score-a.score || a.record.title.localeCompare(b.record.title));
    summary.textContent = state.ready ? found.length + " results · " + state.records.length.toLocaleString() + " catalogue entries" : "Loading your catalogue…";
    results.replaceChildren();
    if (!found.length) {
      const empty = document.createElement("div"); empty.className = "us-empty"; empty.style.gridColumn = "1/-1";
      empty.textContent = state.ready ? "No matches found. Try another title, language, genre or channel." : "Loading search catalogue…";
      results.appendChild(empty); return;
    }
    found.forEach(({record}, index) => {
      const link = document.createElement("a");
      link.className = "us-card"; link.href = record.url || "#"; link.dataset.index = String(index);
      if (record.image) {
        const img = document.createElement("img"); img.src = record.image; img.alt = ""; img.loading = "lazy"; img.onerror = () => img.remove(); link.appendChild(img);
      } else {
        const noimg = document.createElement("div"); noimg.className = "us-noimg"; noimg.textContent = record.type === "live" ? "◉" : "▶"; link.appendChild(noimg);
      }
      const body = document.createElement("div"); body.className = "us-card-body";
      const title = document.createElement("div"); title.className = "us-title"; title.textContent = escapeText(record.title);
      const meta = document.createElement("div"); meta.className = "us-meta"; meta.textContent = [record.type, record.category, record.language, record.year].filter(Boolean).join(" · ");
      body.append(title, meta); link.appendChild(body); results.appendChild(link);
    });
    state.active = 0;
  }
  function update(value) {
    state.query = value || "";
    inputs.forEach(input => { if (input.value !== state.query) input.value = state.query; });
    if (state.query.trim()) { open(); load().then(render); }
    else render();
  }
  inputs.forEach(input => {
    input.setAttribute("autocomplete", "off");
    input.addEventListener("focus", () => { if (input.value.trim()) { state.query = input.value; open(); load().then(render); } });
    input.addEventListener("input", () => update(input.value));
    input.addEventListener("keydown", event => {
      if (event.key === "Escape") { close(); input.blur(); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const cards = [...results.querySelectorAll(".us-card")]; if (!cards.length || root.hidden) return;
        event.preventDefault(); state.active = (state.active + (event.key === "ArrowDown" ? 1 : -1) + cards.length) % cards.length;
        cards[state.active].focus();
      }
    });
  });
  root.querySelector("#usClose").addEventListener("click", close);
  root.querySelectorAll(".us-filter").forEach(button => button.addEventListener("click", () => {
    state.type = button.dataset.type;
    root.querySelectorAll(".us-filter").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    render();
  }));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !root.hidden) close();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); const input = activeInput(); input?.focus(); open(); load().then(render); }
  });
  const params = new URLSearchParams(location.search);
  const initial = params.get("title") || params.get("channel") || "";
  if (initial) { const input = inputs.find(el => el.id === "searchInput" || el.id === "searchBar") || inputs[0]; if (input) { input.value = initial; state.query = initial; load().then(render); } }
  const clearButton = document.getElementById("clearSearchBtn");
  if (clearButton && inputs.some(input => input.id === "globalPortalSearch")) clearButton.addEventListener("click", () => { update(""); close(); });
})();
