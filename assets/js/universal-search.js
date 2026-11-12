/* Cloud TV — universal catalogue search. Uses only repository catalogue metadata. */
(() => {
  "use strict";
  const INPUTS = ["#mainSearch", "#sidebarSearch", "#searchInput", "#globalPortalSearch", "#searchBar"];
  const state = { records: [], query: "", type: "all", active: 0, ready: false, loading: false, loadedAt: 0 };
  const REFRESH_INTERVAL = 3 * 60 * 1000;
  const normalize = value => String(value || "").normalize("NFKD").toLocaleLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const escapeText = value => String(value || "");
  const root = document.createElement("section");
  root.id = "universalSearchLayer";
  root.setAttribute("aria-label", "Universal search results");
  root.hidden = true;
  root.innerHTML = `
    <style>
      #universalSearchLayer{position:fixed;inset:76px 0 0;z-index:10050;background:radial-gradient(ellipse at 12% 0%,rgba(23,132,169,.2),transparent 42%),radial-gradient(ellipse at 90% 20%,rgba(93,92,202,.17),transparent 42%),rgba(3,8,19,.97);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);overflow:auto;color:#f5f9ff;padding:clamp(14px,3vw,32px);border-top:1px solid rgba(85,234,255,.16)}
      #universalSearchLayer[hidden]{display:none}
      #universalSearchLayer .us-wrap{max-width:1200px;margin:0 auto}
      #universalSearchLayer .us-top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}
      #universalSearchLayer .us-heading{font-size:clamp(20px,3vw,30px);font-weight:900;letter-spacing:-.045em;background:linear-gradient(90deg,#fff,#8cefff 70%,#a8b5ff);background-clip:text;-webkit-background-clip:text;color:transparent}
      #universalSearchLayer .us-muted{color:#91a4bd;font-size:13px;margin-top:5px}
      #universalSearchLayer .us-close{border:1px solid rgba(143,190,220,.24);background:linear-gradient(145deg,rgba(22,42,65,.9),rgba(7,16,31,.95));color:#e2eaf5;border-radius:12px;padding:10px 14px;cursor:pointer;box-shadow:inset 0 1px rgba(255,255,255,.09);transition:.2s}
      #universalSearchLayer .us-close:hover{border-color:rgba(85,234,255,.6);box-shadow:0 0 24px rgba(85,234,255,.12)}
      #universalSearchLayer .us-filters{display:flex;flex-wrap:wrap;gap:9px;margin:20px 0 22px}
      #universalSearchLayer .us-filter{border:1px solid rgba(143,190,220,.2);color:#cbd8e8;background:linear-gradient(145deg,rgba(18,34,54,.9),rgba(8,17,32,.92));border-radius:999px;padding:9px 15px;font-size:12px;font-weight:800;cursor:pointer;transition:transform .2s,border-color .2s,box-shadow .2s}
      #universalSearchLayer .us-filter:hover{transform:translateY(-2px);border-color:rgba(85,234,255,.5)}
      #universalSearchLayer .us-filter[aria-pressed=true]{background:linear-gradient(110deg,#45dff0,#8ba7ff);color:#06111e;border-color:transparent;box-shadow:0 5px 24px rgba(85,234,255,.2)}
      #universalSearchLayer .us-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:15px;perspective:1400px}
      #universalSearchLayer .us-card{display:flex;flex-direction:column;text-align:left;min-width:0;border:1px solid rgba(143,190,220,.17);background:linear-gradient(145deg,rgba(20,37,59,.94),rgba(7,15,29,.97));border-radius:17px;overflow:hidden;color:inherit;text-decoration:none;box-shadow:0 15px 32px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.07);transform-style:preserve-3d;transition:transform .25s,border-color .25s,box-shadow .25s}
      #universalSearchLayer .us-card:hover,#universalSearchLayer .us-card:focus-visible{transform:translateY(-5px) rotateX(2deg);border-color:rgba(85,234,255,.62);outline:none;box-shadow:0 22px 42px rgba(0,0,0,.38),0 0 25px rgba(85,234,255,.1)}
      #universalSearchLayer .us-card img{width:100%;aspect-ratio:2/3;object-fit:cover;background:#101b2b;transition:transform .45s}
      #universalSearchLayer .us-card:hover img{transform:scale(1.045)}
      #universalSearchLayer .us-card .us-noimg{width:100%;aspect-ratio:2/3;display:grid;place-items:center;background:radial-gradient(circle at 35% 18%,rgba(85,234,255,.23),transparent 35%),linear-gradient(145deg,#142b46,#080f20 75%);font-size:36px;color:#7beeff}
      #universalSearchLayer .us-card-body{padding:12px;display:grid;gap:6px}
      #universalSearchLayer .us-title{font-size:13px;line-height:1.4;font-weight:800;overflow-wrap:anywhere}
      #universalSearchLayer .us-meta{font-size:10px;color:#91a4bd;text-transform:capitalize;line-height:1.5}
      #universalSearchLayer .us-empty{border:1px dashed rgba(143,190,220,.35);border-radius:18px;padding:38px 18px;text-align:center;color:#cbd8e8;background:rgba(13,26,44,.45)}
      #universalSearchLayer .us-hint{margin-top:18px;color:#71849d;font-size:11px}
      @media(max-width:760px){#universalSearchLayer{inset:66px 0 0;padding:14px;overflow-y:auto;overflow-x:hidden;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y}#universalSearchLayer.has-mobile-search{top:118px;bottom:0;padding-bottom:calc(32px + env(safe-area-inset-bottom))}#universalSearchLayer .us-wrap{padding-bottom:36px}#universalSearchLayer .us-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;touch-action:pan-y}#universalSearchLayer .us-card{touch-action:pan-y;user-select:none;-webkit-user-select:none}}
      @media(max-width:480px){#universalSearchLayer .us-top{align-items:flex-start}#universalSearchLayer .us-heading{font-size:20px}#universalSearchLayer .us-muted{font-size:11px}#universalSearchLayer .us-close{padding:9px 10px;font-size:11px}#universalSearchLayer .us-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}#universalSearchLayer .us-card{border-radius:13px}#universalSearchLayer .us-card-body{padding:9px}#universalSearchLayer .us-title{font-size:12px}#universalSearchLayer .us-meta{font-size:9px}#universalSearchLayer .us-filter{padding:8px 11px;font-size:11px}}
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
  root.classList.toggle("has-mobile-search", !!document.querySelector(".mobile-search-bar"));
  document.body.appendChild(root);
  const results = root.querySelector("#usResults");
  const summary = root.querySelector("#usSummary");
  const inputs = INPUTS.flatMap(selector => [...document.querySelectorAll(selector)]).filter((el, i, all) => all.indexOf(el) === i);
  const activeInput = () => inputs.find(el => document.activeElement === el) || inputs[0];
  function close() { root.hidden = true; state.active = 0; }
  function open() { root.hidden = false; }
  async function load(force = false) {
    if (state.loading) return;
    if (!force && state.ready && Date.now() - state.loadedAt < REFRESH_INTERVAL) return;
    state.loading = true;
    try {
      const indexUrl = new URL("universal-search-index.json", document.baseURI);
      indexUrl.searchParams.set("v", String(Date.now()));
      const response = await fetch(indexUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Search catalogue unavailable");
      const data = await response.json();
      state.records = (Array.isArray(data.records) ? data.records : []).map(record => ({
        ...record,
        title: record.title || record.name || record.label || "Untitled",
        image: record.image || record.img || record.poster || record.posterUrl || record.thumbnail || record.cover || record.logo || "",
        category: record.category || record.genre || record.group || "",
        language: record.language || record.lang || "",
        description: record.description || record.overview || record.summary || record.subtitle || "",
        url: record.url || record.href || record.link || "#"
      }));
      state.ready = true;
      state.loadedAt = Date.now();
      if (state.query.trim()) render();
    } catch (error) {
      if (!state.ready) summary.textContent = "Could not load the repository search catalogue. Please refresh and try again.";
      console.warn("Cloud TV search index refresh failed; keeping the last good index.", error);
    } finally { state.loading = false; }
  }
  function rank(record, query) {
    const title = normalize(record.title), description = normalize(record.description), category = normalize(record.category), language = normalize(record.language), extra = normalize([record.genre, record.tags, record.keywords, record.source].flat().join(" "));
    if (title === query) return 100;
    if (title.startsWith(query)) return 70;
    if (title.includes(query)) return 55;
    if (category.includes(query) || language.includes(query)) return 25;
    if (description.includes(query)) return 10;
    const terms = query.split(" ").filter(Boolean);
    const haystack = title + " " + category + " " + language + " " + description + " " + extra;
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
        const img = document.createElement("img"); img.src = record.image; img.alt = record.title + " poster"; img.loading = "lazy"; img.decoding = "async"; img.onerror = () => { const fallback = document.createElement("div"); fallback.className = "us-noimg"; fallback.textContent = record.type === "live" ? "◉" : "▶"; img.replaceWith(fallback); }; link.appendChild(img);
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

  // Keep the search index fresh while the page remains open, and refresh when
  // the visitor returns to the tab. The server-side workflow rebuilds the index.
  window.setInterval(() => {
    if (document.visibilityState === "visible") load(true);
  }, REFRESH_INTERVAL);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") load(true);
  });
})();
