const axios = require("axios");

const HTTP_CONFIG = {
  timeout: 15000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9"
  }
};

async function getAllStreams(type, id, addonUrls) {
  const promises = addonUrls.map(url => getStreamsFromAddon(url, type, id));
  const results = await Promise.all(promises);
  return results.flat();
}

async function getStreamsFromAddon(baseUrl, type, id) {
  // Limpieza de URL para evitar errores de manifest
  const base = baseUrl.trim().replace(/\/manifest\.json$/, "").replace(/\/+$/, "");
  const url = `${base}/stream/${type}/${id}.json`;

  try {
    const resp = await axios.get(url, HTTP_CONFIG);
    const raw = resp.data?.streams || [];
    
    // Normalización para que scoring.js tenga datos uniformes
    return raw.map(s => {
      const fullText = [s.name || "", s.title || ""].join(" ").toLowerCase();
      const seedersMatch = fullText.match(/(?:👥|seeds?:?)\s*(\d+)/i);
      const sizeMatch = fullText.match(/(\d+(?:\.\d+)?)\s*gb/i);

      return {
        ...s,
        _source: base,
        _rawText: fullText,
        _seeders: seedersMatch ? parseInt(seedersMatch[1]) : 0,
        _sizeGB: sizeMatch ? parseFloat(sizeMatch[1]) : 0
      };
    });
  } catch (err) {
    console.error(`[proxy] ✗ Fallo en ${base}: ${err.message}`);
    return [];
  }
}

module.exports = { getAllStreams };
