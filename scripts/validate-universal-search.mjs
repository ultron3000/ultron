import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const index = JSON.parse(readFileSync("universal-search-index.json", "utf8"));
assert.equal(index.count, index.records.length, "index count matches record count");
assert.ok(index.count >= 2500, "catalogue includes the repository's main catalogues");

const counts = Object.groupBy(index.records, record => record.type);
assert.ok((counts.movie || []).length >= 1000, "movie catalogue is represented");
assert.ok((counts.series || []).length >= 100, "series catalogue is represented");
assert.ok((counts.live || []).length >= 1000, "all live-channel catalogues are represented");
assert.ok((counts.collection || []).length >= 50, "portal collections are represented");

const ids = new Set();
for (const record of index.records) {
  assert.ok(record.id && !ids.has(record.id), "record IDs are present and unique");
  ids.add(record.id);
  assert.ok(record.title && record.title.trim(), "record title is present");
  assert.ok(typeof record.url === "string" && record.url.trim(), "record destination is present");
  assert.ok(!/^javascript:/i.test(record.url), "record destination is not executable");
  assert.ok(!("video" in record) && !("key" in record) && !("mpd" in record), "playback URLs and DRM keys are not copied into the search index");
}

for (const path of ["index.html", "search.html", "movies.html", "series.html", "tv.html"]) {
  const html = readFileSync(path, "utf8");
  const scriptAt = html.lastIndexOf('src="assets/js/universal-search.js"');
  const bodyAt = html.toLowerCase().lastIndexOf("</body>");
  assert.ok(scriptAt >= 0 && scriptAt < bodyAt, path + " loads universal search before </body>");
  assert.ok(html.lastIndexOf("<!--", scriptAt) <= html.lastIndexOf("-->", scriptAt), path + " search script is inside an HTML comment");
}
assert.match(readFileSync("movies.html", "utf8"), /openPlayer\(movies\.indexOf\(match\)\)/, "movie deep links use the existing player");
assert.match(readFileSync("tv.html", "utf8"), /openPlayer\(list, index\)/, "live-channel deep links use the existing player");

console.log("Universal search validation passed:", index.count, "records", JSON.stringify(Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value.length]))));
