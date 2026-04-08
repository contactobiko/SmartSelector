const { getAllStreams } = require("./stremio-proxy.js");
const { selectBestStream } = require("./scoring.js");

const manifest = {
  id: "community.smart.selector",
  version: "1.1.5",
  name: "Smart Selector PRO",
  description: "Selección inteligente de streams sin esperas.",
  resources: ["stream"],
  types: ["movie", "series"],
  idPrefixes: ["tt"],
  behaviorHints: { configurable: true, configurationRequired: false }
};

async function get({ resource, type, id, config }) {
  if (resource !== "stream") return { streams: [] };

  // FIX: Manejo robusto de la lista de URLs
  let addonUrls = [];
  if (config.addonUrls) {
    addonUrls = Array.isArray(config.addonUrls) 
      ? config.addonUrls 
      : config.addonUrls.split(",").map(u => u.trim()).filter(Boolean);
  }

  if (!addonUrls.length) return { streams: [] };

  const prefs = {
    audioPrefs: config.audioPrefs || ["spa"],
    qualities: config.qualities || ["1080p"]
  };

  try {
    const all = await getAllStreams(type, id, addonUrls);
    const best = selectBestStream(all, prefs);

    if (!best) return { streams: [] };

    return {
      streams: [{
        ...best,
        name: `Smart Selector\n⭐ Ganador (${best._score} pts)`
      }]
    };
  } catch (err) {
    console.error("Error en get:", err.message);
    return { streams: [] };
  }
}

module.exports = { manifest, get };
