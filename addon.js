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
  behaviorHints: { configurable: true, configurationRequired: false }
};

async function get({ resource, type, id, config }) {
  if (resource !== "stream") return { streams: [] };

  // --- ARREGLO PARA EL ERROR .split ---
  let addonUrls = [];
  if (config.addonUrls) {
    if (Array.isArray(config.addonUrls)) {
      addonUrls = config.addonUrls; // Ya es una lista
    } else if (typeof config.addonUrls === "string") {
      addonUrls = config.addonUrls.split(",").map(u => u.trim()); // Es texto, lo dividimos
    }
  }

  if (addonUrls.length === 0) {
    console.warn("⚠️ No hay addons configurados.");
    return { streams: [] };
  }

  // Adaptación a las variables de tu index.html
  const prefs = {
    audioPrefs: config.audioPrefs || ["spa"],
    qualities: config.qualities || ["1080p", "720p"]
  };

  console.log(`[Smart] Buscando ${type} ${id} | Addons: ${addonUrls.length}`);

  try {
    const allStreams = await getAllStreams(type, id, addonUrls);
    if (!allStreams.length) return { streams: [] };

    const best = selectBestStream(allStreams, prefs);
    if (!best) return { streams: [] };

    return {
      streams: [{
        ...best,
        name: `Smart Selector\n⭐ Mejor opción encontrada`
      }]
    };
  } catch (err) {
    console.error("❌ Error en addon.get:", err.message);
    return { streams: [] };
  }
}

module.exports = { manifest, get };
