/**
 * Stremio Addon Proxy Source
 *
 * Queries the stream endpoint of any Stremio-compatible addon
 * and returns its streams normalized for our scoring engine.
 *
 * Every Stremio addon exposes streams at:
 *   GET {baseUrl}/stream/{type}/{id}.json
 *
 * This module calls those endpoints — it hosts nothing itself.
 */

const axios = require("axios");

const TIMEOUT = 10000; // ms

/**
 * Fetch streams from a single Stremio addon endpoint.
 *
 * @param {string} baseUrl  - Addon base URL, e.g. "https://torrentio.strem.fun/sort=seeders"
 * @param {string} type     - "movie" | "series"
 * @param {string} id       - IMDB ID (+ episode for series), e.g. "tt0111161" or "tt0944947:1:1"
 * @returns {Promise<Array>} Normalized stream objects ready for scoring
 */
async function getStreamsFromAddon(baseUrl, type, id) {
  // Strip trailing slash
  const base = baseUrl.replace(/\/+$/, "");
  const url  = `${base}/stream/${type}/${id}.json`;

  try {
    console.log(`  [proxy] → GET ${url}`);
    const resp = await axios.get(url, { timeout: TIMEOUT });
    const raw  = resp.data?.streams || [];

    // Normalize to our internal format
    return raw.map(s => normalizeStream(s, base));

  } catch (err) {
    console.error(`  [proxy] ✗ ${base} failed: ${err.message}`);
    return [];
  }
}

/**
 * Normalize a raw Stremio stream object into our internal format.
 * Most addons (Torrentio, Knightcrawler, etc.) follow the same schema.
 */
function normalizeStream(raw, sourceBase) {
  // Stremio stream title usually looks like:
  //   "Torrentio\n1080p Español\n👥 320 seeders 💾 2.1 GB"
  // We combine name + title for the scoring engine to analyze.
  const fullText = [raw.name || "", raw.title || ""].join(" ");

  // Extract seeders from title text (e.g. "👥 320 seeders" or "Seeds: 320")
  const seedersMatch = fullText.match(/(?:👥|seeds?:?)\s*(\d+)/i);
  const seeders = seedersMatch ? parseInt(seedersMatch[1]) : 0;

  // Extract file size in GB
  const sizeMatch = fullText.match(/(\d+(?:\.\d+)?)\s*GB/i);
  const sizeGB = sizeMatch ? parseFloat(sizeMatch[1]) : 0;

  return {
    // Fields for Stremio (pass-through as-is)
    infoHash:     raw.infoHash,
    fileIdx:      raw.fileIdx,
    url:          raw.url,
    behaviorHints: raw.behaviorHints,

    // Fields for scoring engine
    title:    fullText,        // full combined text for language/quality detection
    name:     raw.name || "",
    seeders,
    sizeGB,

    // Debug / display
    _rawName:  raw.name,
    _rawTitle: raw.title,
    _source:   new URL(sourceBase).hostname,
  };
}

module.exports = { getStreamsFromAddon };
