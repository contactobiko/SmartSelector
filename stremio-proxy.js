const axios = require("axios");

const TIMEOUT = 15000;

async function getAllStreams(type, id, addonUrls) {
  const promises = addonUrls.map(url => getStreamsFromAddon(url, type, id));
  const results = await Promise.all(promises);
  return results.flat();
}

async function getStreamsFromAddon(baseUrl, type, id) {
  // Limpiar la URL (quitar manifest.json si existe)
  const cleanBase = baseUrl.trim().replace(/\/manifest\.json$/, "").replace(/\/+$/, "");
  const url = `${cleanBase}/stream/${type}/${id}.json`;

  try {
    const resp = await axios.get(url, {
      timeout: TIMEOUT,
      headers: {
        // Cabeceras para evitar el Error 403
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });

    const streams = resp.data?.streams || [];
    return streams.map(s => ({
      ...s,
      _rawText: `${s.name} ${s.title}`.toLowerCase()
    }));
  } catch (err) {
    console.error(`[proxy] ✗ Error en ${cleanBase}: ${err.message}`);
    return [];
  }
}

module.exports = { getAllStreams };
