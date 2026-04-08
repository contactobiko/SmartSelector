const { getAllStreams } = require("./stremio-proxy.js");
const { selectBestStream } = require("./scoring.js");

const manifest = {
  id: "community.smart.selector",
  version: "1.1.0",
  name: "Smart Selector",
  description: "Elige automáticamente el mejor stream de tus addons favoritos.",
  resources: ["stream"],
  types: ["movie", "series"],
  idPrefixes: ["tt"],
  behaviorHints: { configurable: true }
};

async function get({ resource, type, id, config }) {
  if (resource !== "stream") return { streams: [] };

  const addonUrls = config.addonUrls ? config.addonUrls.split(",") : [];
  if (!addonUrls.length) return { streams: [] };

  const prefs = {
    audioLang: config.audioLang || "spa",
    quality: config.quality || "1080p"
  };

  console.log(`[Smart] Buscando ${type} ${id} para idioma: ${prefs.audioLang}`);

  const allStreams = await getAllStreams(type, id, addonUrls);
  const best = selectBestStream(allStreams, prefs);

  if (!best) return { streams: [] };

  // Retornamos el ganador formateado para Stremio
  return {
    streams: [{
      name: `Smart Selector\n⭐ ${best._finalScore} pts`,
      title: best.title || best.name,
      infoHash: best.infoHash,
      url: best.url,
      externalUrl: best.externalUrl,
      fileIdx: best.fileIdx,
      behaviorHints: best.behaviorHints
    }]
  };
}

module.exports = { manifest, get };
