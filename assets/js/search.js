(function() {
  let searchIndex = [];
  let currentFilter = 'all';

  async function initSearch() {
    try {
      const response = await fetch('search-index.json');
      searchIndex = await response.json();
    } catch (e) {
      console.error("CloudTV Search Error:", e);
    }

    const container = document.getElementById('cloudtv-search-container');
    if (!container) return;

    container.innerHTML = `
      <div class="cloudtv-search-wrapper">
        <div class="cloudtv-search-bar">
          <input type="text" id="cloudtv-input" class="cloudtv-search-input" placeholder="Search movies, series, live TV..." autocomplete="off">
        </div>
        <div class="cloudtv-filters" id="cloudtv-filters">
          <button class="filter-chip active" data-filter="all">All</button>
          <button class="filter-chip" data-filter="movie">Movies</button>
          <button class="filter-chip" data-filter="series">Series</button>
          <button class="filter-chip" data-filter="animation">Animation</button>
          <button class="filter-chip" data-filter="tv">Live TV</button>
        </div>
        <div class="cloudtv-results-dropdown" id="cloudtv-results"></div>
      </div>
    `;

    setupListeners();
  }

  function setupListeners() {
    const input = document.getElementById('cloudtv-input');
    const resultsBox = document.getElementById('cloudtv-results');
    const filters = document.querySelectorAll('.filter-chip');

    filters.forEach(btn => {
      btn.addEventListener('click', (e) => {
        filters.forEach(f => f.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.dataset.filter;
        executeSearch(input.value);
      });
    });

    input.addEventListener('input', (e) => executeSearch(e.target.value));

    document.addEventListener('click', (e) => {
      if (!document.getElementById('cloudtv-search-container').contains(e.target)) {
        resultsBox.style.display = 'none';
      }
    });
  }

  function executeSearch(query) {
    const resultsBox = document.getElementById('cloudtv-results');
    if (!query || query.trim().length === 0) {
      resultsBox.style.display = 'none';
      return;
    }

    const q = query.toLowerCase();
    const filtered = searchIndex.filter(item => {
      const matchesFilter = currentFilter === 'all' || item.type === currentFilter;
      const matchesQuery = item.title.toLowerCase().includes(q) || (item.code && item.code.toLowerCase().includes(q));
      return matchesFilter && matchesQuery;
    }).slice(0, 15);

    if (filtered.length === 0) {
      resultsBox.innerHTML = `<div style="padding: 16px; text-align: center; color: #8e8e99;">No results found.</div>`;
      resultsBox.style.display = 'block';
      return;
    }

    resultsBox.innerHTML = filtered.map(item => `
      <div class="result-item" onclick="window.location.href='${item.url || '#'}'">
        <div class="result-info">
          <h4>${item.title}</h4>
          <span style="font-size: 0.8rem; color: #8e8e99;">${item.sourcePage || item.type}</span>
        </div>
        <span class="result-badge">${item.type}</span>
      </div>
    `).join('');

    resultsBox.style.display = 'block';
  }

  document.addEventListener('DOMContentLoaded', initSearch);
})();
