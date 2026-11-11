#!/usr/bin/env node
"use strict";

/*
 * Rebuild the shared Cloud TV catalogue from the actual site data.
 * Run with: node scripts/build-catalogue.js
 * No playback URLs are copied into the search index; movie cards route
 * through movies.html?title=... so the existing player remains in charge.
 */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ROOT = path.resolve(__dirname, "..");
const INDEX = path.join(ROOT, "universal-search-index.json");

function read(rel) {
  const file = path.join(ROOT, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}
function extractArray(source, variable) {
  const re = new RegExp("(?:const|let|var)\\s+" + variable + "\\s*=\\s*\\[", "m");
  const match = re.exec(source);
  if (!match) return [];
  const start = source.indexOf("[", match.index);
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
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "[") depth++;
    if (ch === "]" && --depth === 0) {
      try { return vm.runInNewContext("(" + source.slice(start, i + 1) + ")", Object.create(null), { timeout: 1500 }); }
      catch (error) { console.warn("Could not parse " + variable + ": " + error.message); return []; }
    }
  }
  return [];
}
function clean(value) { return typeof value === "string" ? value.trim() : value == null ? "" : String(value); }
function first(record, keys) { for (const key of keys) { const value = clean(record && record[key]); if (value) return value; } return ""; }
function stableId(type, title, url) {
  return type + "-" + (title + "|" + url).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 110);
}
function normalize(type, item, source) {
  const title = first(item, ["title", "name", "label"]);
  if (!title) return null;
  const image = first(item, ["image", "img", "poster", "posterUrl", "thumbnail", "cover", "logo"]);
  const category = first(item, ["category", "genre", "language", "group"]);
  const url = type === "movie"
    ? "movies.html?title=" + encodeURIComponent(title)
    : first(item, ["url", "href", "link", "page"]) || (type === "series" ? "series.html?title=" + encodeURIComponent(title) : "");
  return {
    id: stableId(type, title, url), type, title, category,
    language: first(item, ["language", "lang"]),
    year: item.year || item.releaseYear || "",
    description: first(item, ["description", "overview", "subtitle", "summary"]),
    image, url, source
  };
}
function unique(records) {
  const seen = new Set();
  return records.filter(record => {
    if (!record || !record.title) return false;
    const key = (record.type + "|" + record.title + "|" + (record.url || "")).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function discoverCategoryPages() {
  const files = fs.readdirSync(ROOT).filter(name => name.endsWith(".html") &&
    /(?:movie|movies|series|animation|animated|cartoon|collection|category)/i.test(name) &&
    !/^(?:index|search|search1|movies|series)\.html$/i.test(name));
  return files.map(file => {
    const html = read(file);
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || file.replace(/\.html$/i, "").replace(/[-_]+/g, " ");
    const description = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i) || [])[1] || "";
    const image = (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)/i) || [])[1] || "";
    const cleanTitle = title.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    return { id: stableId("collection", cleanTitle, file), type: "collection", title: cleanTitle,
      category: "Category", description, image, url: file, source: file };
  }).filter(item => item.title);
}

const movieRows = extractArray(read("movies.html"), "movies");
const seriesRows = extractArray(read("series.html"), "seriesData");
let records = [
  ...movieRows.map(item => normalize("movie", item, "movies.html")),
  ...seriesRows.map(item => normalize("series", item, "series.html"))
];
const channels = JSON.parse(read("channels2.json") || "[]");
records.push(...channels.map(item => {
  const row = normalize("live", item, "channels2.json");
  if (row) row.url = "tv.html?channel=" + encodeURIComponent(row.title);
  if (row) row.language = first(item, ["language", "lang"]);
  return row;
}));

// Keep the curated collection records already maintained by the advanced search page,
// then discover newly added category landing pages automatically.
try {
  const previous = JSON.parse(read("universal-search-index.json") || "{}");
  records.push(...(previous.records || []).filter(item => item.type === "collection"));
} catch (_) {}
records.push(...discoverCategoryPages());
records = unique(records);

const byType = records.reduce((out, item) => { out[item.type] = (out[item.type] || 0) + 1; return out; }, {});
const output = {
  version: 2,
  generatedAt: new Date().toISOString(),
  generatedFrom: ["movies.html (movies array)", "series.html (seriesData array)", "channels2.json", "category landing pages", "curated collections"],
  count: records.length,
  counts: byType,
  records
};
fs.writeFileSync(INDEX, JSON.stringify(output, null, 2) + "\n");
console.log("Built " + records.length + " catalogue records: " + JSON.stringify(byType));
console.log("Movies: " + movieRows.length + "; series: " + seriesRows.length + "; channels: " + channels.length);
