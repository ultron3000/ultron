#!/usr/bin/env node
"use strict";

/*
 * Repository-wide Cloud TV catalogue discovery.
 * Scans HTML and JSON sources instead of relying on a fixed list of pages.
 * Run: node scripts/build-catalogue.js
 */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ROOT = path.resolve(__dirname, "..");
const INDEX = path.join(ROOT, "universal-search-index.json");
const SKIP_DIRS = new Set([".git", "node_modules", ".next", "dist", "build", "vendor"]);
const ARRAY_NAMES = {
  movie: /^(movies?|movieData|movieList|allMovies|films?|filmData|filmList)$/i,
  series: /^(seriesData|seriesList|allSeries|tvSeries|shows|showData|showList)$/i
};

function read(rel) {
  const file = path.join(ROOT, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}
function walk(dir = ROOT, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) walk(path.join(dir, entry.name), out);
    } else if (/\.(?:html?|json)$/i.test(entry.name)) {
      out.push(path.relative(ROOT, path.join(dir, entry.name)).replace(/\\/g, "/"));
    }
  }
  return out.sort();
}
function closingArray(source, start) {
  let depth = 0, quote = "", escaped = false, lineComment = false, blockComment = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i], next = source[i + 1];
    if (lineComment) { if (ch === "\n") lineComment = false; continue; }
    if (blockComment) { if (ch === "*" && next === "/") { blockComment = false; i++; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "/" && next === "/") { lineComment = true; i++; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i++; continue; }
    if (ch === "'" || ch === '"' || ch === "\`") { quote = ch; continue; }
    if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) return i;
  }
  return -1;
}
function extractArrays(source) {
  const out = [];
  const re = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\[/g;
  let match;
  while ((match = re.exec(source))) {
    const start = source.indexOf("[", match.index);
    const end = closingArray(source, start);
    if (end < 0) continue;
    try {
      const value = vm.runInNewContext("(" + source.slice(start, end + 1) + ")", Object.create(null), { timeout: 1200 });
      if (Array.isArray(value)) out.push({ name: match[1], rows: value });
    } catch (_) { /* Skip non-literal or executable arrays safely. */ }
    re.lastIndex = end + 1;
  }
  return out;
}
function clean(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean).join(" ");
  if (value && typeof value === "object") return "";
  return value == null ? "" : String(value).trim();
}
function first(record, keys) {
  for (const key of keys) {
    const value = clean(record && record[key]);
    if (value) return value;
  }
  return "";
}
function flatten(value) {
  if (Array.isArray(value)) return value.map(flatten).filter(Boolean).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(flatten).filter(Boolean).join(" ");
  return clean(value);
}
function slug(value) {
  return String(value || "").toLowerCase().replace(/\.html?$/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function pageMeta(file, html) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] ||
    path.basename(file).replace(/\.html?$/i, "").replace(/[-_]+/g, " ");
  const description = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i) || [])[1] || "";
  const image = (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)/i) || [])[1] || "";
  return { title: title.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(), description, image };
}
function inferPath(file) {
  const name = path.basename(file).replace(/\.html?$/i, "").toLowerCase();
  const language = ["hindi", "marathi", "english", "tamil", "telugu", "bengali", "punjabi", "korean", "japanese"].find(x => name.includes(x)) || "";
  const category = /animation|animated|cartoon|anime/.test(name) ? "Animation" :
    /horror/.test(name) ? "Horror" : /action/.test(name) ? "Action" :
    /comedy/.test(name) ? "Comedy" : language ? language[0].toUpperCase() + language.slice(1) : "";
  return { language, category };
}
function isEpisode(row) {
  return row && (row.episode != null || row.episodeNumber != null || row.epNum != null ||
    row.season != null || row.seasonNumber != null || row.airDate != null);
}
function stableId(type, title, source) {
  return type + "-" + slug(title) + "-" + slug(source).slice(0, 42);
}
function normalize(type, item, source, options = {}) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const title = first(item, ["title", "name", "label", "movieTitle", "showTitle"]);
  if (!title || title.length > 220) return null;
  const inferred = inferPath(source);
  const image = first(item, ["image", "img", "poster", "posterUrl", "poster_url", "thumbnail", "thumb", "cover", "logo", "icon", "backdrop"]);
  const category = first(item, ["category", "genre", "genres", "group", "type"]) || options.category || inferred.category;
  const language = first(item, ["language", "lang", "originalLanguage"]) || options.language || inferred.language;
  let url = "";
  if (source === "movies.html") url = "movies.html?title=" + encodeURIComponent(title);
  else if (type === "series" && source === "series.html") url = first(item, ["url", "href", "link", "page"]) || "series.html?title=" + encodeURIComponent(title);
  else if (type === "series" && first(item, ["url", "href", "link", "page"]) && /^https?:\/\//i.test(first(item, ["url", "href", "link", "page"]))) url = first(item, ["url", "href", "link", "page"]);
  else url = source;
  const tags = flatten([item.tags, item.keywords, item.cast, item.director, item.studio, item.network, item.badge, item.subtitle]);
  const description = first(item, ["description", "overview", "summary", "subtitle", "plot", "synopsis"]);
  return {
    id: stableId(type, title, source), type, title, category, language,
    year: item.year || item.releaseYear || item.release_year || "",
    description, image, url, source,
    tags, searchText: [title, category, language, description, tags, source].filter(Boolean).join(" ")
  };
}
function dedupe(records) {
  const map = new Map();
  for (const record of records) {
    if (!record || !record.title) continue;
    const key = record.type + "|" + record.title.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
    const old = map.get(key);
    if (!old) { map.set(key, record); continue; }
    // Keep the canonical movies.html route, but fill missing metadata from other pages.
    for (const field of ["image", "description", "category", "language", "year", "tags", "searchText"]) {
      if (!old[field] && record[field]) old[field] = record[field];
    }
    if (old.source !== "movies.html" && record.source === "movies.html") {
      const merged = { ...record };
      for (const field of ["image", "description", "category", "language", "year", "tags", "searchText"]) {
        if (!merged[field] && old[field]) merged[field] = old[field];
      }
      map.set(key, merged);
    }
  }
  return [...map.values()];
}

const files = walk();
const htmlFiles = files.filter(file => /\.html?$/i.test(file));
const jsonFiles = files.filter(file => /\.json$/i.test(file));
const existing = (() => { try { return JSON.parse(read("universal-search-index.json")); } catch (_) { return {}; } })();
const knownSeriesSlugs = new Set((existing.records || []).filter(r => r.type === "series")
  .map(r => slug((r.url || "").split("?")[0].split("/").pop())));
const records = [];
const stats = { htmlScanned: 0, arraysFound: 0, movieArrays: 0, seriesArrays: 0, jsonScanned: 0 };

for (const file of htmlFiles) {
  const html = read(file);
  stats.htmlScanned++;
  const meta = pageMeta(file, html);
  const pageSlug = slug(file);
  const arrays = extractArrays(html);
  for (const array of arrays) {
    const declared = array.name;
    const isMovieArray = ARRAY_NAMES.movie.test(declared);
    const isSeriesArray = ARRAY_NAMES.series.test(declared);
    if (!isMovieArray && !isSeriesArray) continue;
    stats.arraysFound++;
    const sample = array.rows.find(row => row && typeof row === "object" && !Array.isArray(row));
    if (!sample) continue;
    const episodeData = isEpisode(sample) || array.rows.some(isEpisode);
    // Some show-detail pages unfortunately name their episode list "movies".
    const seriesPage = knownSeriesSlugs.has(pageSlug) || /(?:series|episode|season|show)/i.test(file);
    const type = episodeData || (isMovieArray && seriesPage) ? "series" : isSeriesArray ? "series" : "movie";
    if (type === "movie") stats.movieArrays++; else stats.seriesArrays++;
    const pathHints = inferPath(file);
    const pageCategory = pathHints.category || (meta.title.match(/animation|cartoon|anime/i) ? "Animation" : "");
    for (const row of array.rows) {
      const record = normalize(type, row, file, { ...pathHints, category: first(row, ["category", "genre"]) || pageCategory });
      if (record) records.push(record);
    }
  }
  // Category/franchise landing pages are searchable even when their content is rendered as HTML cards.
  const base = path.basename(file);
  if (/(?:movie|movies|series|animation|animated|cartoon|collection|category|franchise|studio)/i.test(base) &&
      !/^(?:index|search|search1|movies|series)\.html?$/i.test(base)) {
    records.push({
      id: stableId("collection", meta.title, file), type: "collection", title: meta.title,
      category: "Category", description: meta.description, image: meta.image,
      url: file, source: file, tags: inferPath(file).category, searchText: [meta.title, meta.description, file].join(" ")
    });
  }
}

for (const file of jsonFiles) {
  const base = path.basename(file).toLowerCase();
  if (!/(channel|movie|series|catalog|collection|content)/i.test(base)) continue;
  stats.jsonScanned++;
  let parsed;
  try { parsed = JSON.parse(read(file)); } catch (_) { continue; }
  const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.records) ? parsed.records :
    Array.isArray(parsed.channels) ? parsed.channels : Array.isArray(parsed.movies) ? parsed.movies : [];
  if (!rows.length) continue;
  const type = /channel/i.test(base) ? "live" : /series/i.test(base) ? "series" : "movie";
  for (const row of rows) {
    const record = normalize(type, row, file);
    if (record) {
      if (type === "live") record.url = "tv.html?channel=" + encodeURIComponent(record.title);
      records.push(record);
    }
  }
}

// Preserve hand-curated external collection destinations not represented by a local page.
for (const record of existing.records || []) {
  if (record.type === "collection" && /^https?:\/\//i.test(record.url || "") &&
      !records.some(item => item.type === "collection" && item.title.toLowerCase() === String(record.title || "").toLowerCase())) {
    records.push(record);
  }
}

const finalRecords = dedupe(records);
if (!finalRecords.length) throw new Error("Catalogue scan returned zero records; refusing to overwrite the live index.");
const counts = finalRecords.reduce((out, item) => { out[item.type] = (out[item.type] || 0) + 1; return out; }, {});
const output = {
  version: 3, generatedAt: new Date().toISOString(),
  generatedFrom: ["repository-wide recursive HTML/JSON scan", "movies/series data arrays", "channel JSON", "category and franchise pages"],
  count: finalRecords.length, counts, scan: stats, records: finalRecords
};
fs.writeFileSync(INDEX, JSON.stringify(output, null, 2) + "\n");
console.log("Repository scan complete:", JSON.stringify({ ...stats, counts, total: finalRecords.length }, null, 2));
