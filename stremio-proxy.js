const axios = require("axios");

/**
 * Configuracion de cabeceras para saltar el bloqueo 403 de Cloudflare.
 */
const HTTP_CONFIG = {
  timeout: 12000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Referer": "https://web.stremio.com/",
    "Origin": "https://web.stremio.com"
  }
};

async function getAllStreams(type, id, addonUrls) {
  const promises = addonUrls.map(url => getStreamsFromAddon(url, type, id));
  const results = await Promise.all(promises);
  return results.flat();
}

async function getStreamsFromAddon(baseUrl, type, id) {
  // Limpieza total: quitamos espacios, manifest.json y barras finales
  const base = baseUrl.trim().replace(/\/manifest\.json$/, "").replace(/\/+$/, "");
  const url = `${base}/stream/${type}/${id}.json`;

  try {
    const resp = await axios.get(url, HTTP_CONFIG);
    const raw = resp.data?.streams || [];
    
    return raw.map(s => {
      const fullText = `${s.name || ""} ${s.title || ""}`.toLowerCase();
      // Extraer seeders y tamaño para el motor de scoring
      const seedersMatch = fullText.match(/(?:👥|seeds?:?)\s*(\d+)/i);
      const sizeMatch = fullText.match(/(\d+(?:\.\d+)?)\s*gb/i);

      return {
        ...s,
        _rawText: fullText,
        _seeders: seedersMatch ? parseInt(seedersMatch[1]) : 0,
        _sizeGB: sizeMatch ? parseFloat(sizeMatch[1]) : 0
      };
    });
  } catch (err) {
    console.error(`[proxy] ✗ Error 403/Red en ${base}: ${err.message}`);
    return [];
  }
}

module.exports = { getAllStreams };
