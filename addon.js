/**
 * Stremio Smart Selector — TODO EN UN SOLO ARCHIVO
 * No requiere ninguna subcarpeta ni archivo adicional.
 */

const axios = require("axios");

// ═══════════════════════════════════════════════════════════════════
// SCORING — detecta calidad, idioma y puntúa cada stream
// ═══════════════════════════════════════════════════════════════════

const QUALITY_RANK = { "2160p":5, "4k":5, "uhd":5, "1080p":4, "fhd":4, "720p":3, "hd":3, "480p":2, "sd":1, "unknown":0 };

function detectQuality(text) {
  const t = (text || "").toLowerCase();
  if (/2160p|4k|uhd/.test(t))  return "2160p";
  if (/1080p|fhd/.test(t))     return "1080p";
  if (/720p/.test(t))          return "720p";
  if (/480p|dvdrip/.test(t))   return "480p";
  return "unknown";
}

function detectAudioLangs(text) {
  const t = (text || "").toLowerCase();
  const found = [];
  if (/\b(spa|esp|spanish|castellano|espa[ñn]ol|latino|latam)\b/.test(t)) found.push("spa");
  if (/\b(eng|english|ingl[eé]s)\b/.test(t))                               found.push("eng");
  if (/\b(fra|fre|french|franc[eé]s)\b/.test(t))                           found.push("fra");
  if (/\b(deu|ger|german|alem[aá]n|deutsch)\b/.test(t))                    found.push("deu");
  if (/\b(ita|italian|italiano)\b/.test(t))                                 found.push("ita");
  if (/\b(por|port|portuguese|portugu[eê]s)\b/.test(t))                    found.push("por");
  if (/\b(jpn|japanese|japon[eé]s)\b/.test(t))                             found.push("jpn");
  if (/\b(kor|korean|coreano)\b/.test(t))                                   found.push("kor");
  if (/\b(zho|chinese|chino|mandarin)\b/.test(t))                          found.push("zho");
  if (/\b(rus|russian|ruso)\b/.test(t))                                     found.push("rus");
  return found;
}

function detectSubtitleLangs(text) {
  const t = (text || "").toLowerCase();
  const found = [];
  const hasSub = /sub(?:titles?|s?)|subtitulad[ao]|subbed/.test(t);
  if (!hasSub) return found;
  if (/\b(spa|esp|spanish|castellano|espa[ñn]ol)\b/.test(t)) found.push("spa");
  if (/\b(eng|english)\b/.test(t))                            found.push("eng");
  if (/\b(fra|french)\b/.test(t))                             found.push("fra");
  if (/\b(deu|german|deutsch)\b/.test(t))                     found.push("deu");
  if (/\b(ita|italian)\b/.test(t))                            found.push("ita");
  if (/\b(por|portuguese)\b/.test(t))                         found.push("por");
  return found;
}

function scoreStream(stream, prefs) {
  const text = [(stream.name || ""), (stream.title || "")].join(" ");
  let score = 0;
  const breakdown = {};

  // Audio
  const audio = detectAudioLangs(text);
  if (!prefs.audioLang || prefs.audioLang === "any") {
    score += 200; breakdown.audio = "+200 (sin preferencia)";
  } else if (audio.includes(prefs.audioLang)) {
    score += 500; breakdown.audio = `+500 (${prefs.audioLang} encontrado)`;
  } else if (audio.length === 0) {
    score += 50;  breakdown.audio = "+50 (idioma desconocido)";
  } else {
    score += 0;   breakdown.audio = `+0 (${audio.join(",")} ≠ ${prefs.audioLang})`;
  }

  // Calidad
  const qual = detectQuality(text);
  const desired  = QUALITY_RANK[prefs.quality]  || 0;
  const detected = QUALITY_RANK[qual] || 0;
  if (!prefs.quality || prefs.quality === "any") {
    score += 150; breakdown.quality = "+150 (sin preferencia)";
  } else if (detected === desired) {
    score += 300; breakdown.quality = `+300 (exacta: ${qual})`;
  } else if (detected > desired) {
    score += 250; breakdown.quality = `+250 (mejor: ${qual})`;
  } else {
    const q = Math.max(0, 300 - (desired - detected) * 80);
    score += q;   breakdown.quality = `+${q} (inferior: ${qual})`;
  }

  // Subtítulos
  const subs = detectSubtitleLangs(text);
  if (!prefs.subtitleLang || prefs.subtitleLang === "none") {
    score += 0;   breakdown.subs = "+0 (no se necesitan subs)";
  } else if (subs.includes(prefs.subtitleLang)) {
    score += 150; breakdown.subs = `+150 (sub ${prefs.subtitleLang} encontrado)`;
  } else {
    score += 0;   breakdown.subs = `+0 (subs no detectados)`;
  }

  // Seeders (desempate)
  const seeders = parseInt(stream._seeders) || 0;
  const seederPts = seeders > 0 ? Math.min(50, Math.round(Math.log10(seeders + 1) * 20)) : 0;
  score += seederPts; breakdown.seeders = `+${seederPts} (${seeders} seeders)`;

  return { score, breakdown };
}

function selectBest(streams, prefs, minSeeders) {
  const filtered = minSeeders > 0
    ? streams.filter(s => (parseInt(s._seeders) || 0) >= minSeeders)
    : streams;

  if (filtered.length === 0) return null;

  return filtered
    .map(s => { const r = scoreStream(s, prefs); return { ...s, _score: r.score, _breakdown: r.breakdown }; })
    .sort((a, b) => b._score - a._score)[0];
}

// ═══════════════════════════════════════════════════════════════════
// PROXY — consulta los addons configurados por el usuario
// ═══════════════════════════════════════════════════════════════════

async function fetchFromAddon(baseUrl, type, id) {
  const url = baseUrl.replace(/\/+$/, "") + `/stream/${type}/${id}.json`;
  try {
    console.log(`  [proxy] → ${url}`);
    const resp = await axios.get(url, { timeout: 10000 });
    const raw  = resp.data?.streams || [];

    return raw.map(s => {
      const fullText = [(s.name || ""), (s.title || "")].join(" ");
      const seedersMatch = fullText.match(/(?:👥|seeds?:?)\s*(\d+)/i);
      return {
        infoHash:      s.infoHash,
        fileIdx:       s.fileIdx,
        url:           s.url,
        behaviorHints: s.behaviorHints,
        name:          s.name || "",
        title:         fullText,
        _rawName:      s.name,
        _rawTitle:     s.title,
        _seeders:      seedersMatch ? parseInt(seedersMatch[1]) : 0,
        _source:       new URL(baseUrl).hostname,
      };
    });
  } catch (err) {
    console.error(`  [proxy] ✗ Error en ${baseUrl}: ${err.message}`);
    return [];
  }
}

async function getAllStreams(type, id, addonUrls) {
  const results = await Promise.allSettled(
    addonUrls.map(url => fetchFromAddon(url, type, id))
  );
  const streams = [];
  for (const r of results) {
    if (r.status === "fulfilled") streams.push(...r.value);
  }
  // Deduplicar por infoHash
  const seen = new Set();
  return streams.filter(s => {
    if (!s.infoHash) return true;
    if (seen.has(s.infoHash)) return false;
    seen.add(s.infoHash); return true;
  });
}

// ═══════════════════════════════════════════════════════════════════
// MANIFEST
// ═══════════════════════════════════════════════════════════════════

const manifest = {
  id:          "com.smartselector.stremio",
  version:     "1.0.0",
  name:        "Smart Selector",
  description: "Elige automáticamente el mejor stream según tu idioma de audio, subtítulos y calidad. Sin preguntar.",
  catalogs:    [],
  resources:   ["stream"],
  types:       ["movie", "series"],
  idPrefixes:  ["tt"],
  behaviorHints: { configurable: true, configurationRequired: false },
  config: [
    { key: "addonUrls",    type: "text",   title: "🔗 URLs de addons a consultar (separadas por coma)",  default: "https://torrentio.strem.fun/sort=seeders" },
    { key: "audioLang",    type: "select", title: "🔊 Idioma de audio",    options: ["spa","eng","fra","deu","ita","por","jpn","kor","zho","rus","any"], default: "spa" },
    { key: "subtitleLang", type: "select", title: "💬 Subtítulos",         options: ["none","spa","eng","fra","deu","ita","por","jpn","any"],            default: "none" },
    { key: "quality",      type: "select", title: "🎬 Calidad preferida",  options: ["2160p","1080p","720p","480p","any"],                               default: "1080p" },
    { key: "minSeeders",   type: "text",   title: "🌱 Seeders mínimos",    default: "5" },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════

async function streamHandler({ type, id, config }) {
  console.log("\n" + "─".repeat(60));
  console.log(`[handler] ${type.toUpperCase()} ${id}`);

  const prefs = {
    audioLang:    config?.audioLang    || "spa",
    subtitleLang: config?.subtitleLang || "none",
    quality:      config?.quality      || "1080p",
  };
  const minSeeders = parseInt(config?.minSeeders) || 0;
  const addonUrls  = (config?.addonUrls || "https://torrentio.strem.fun/sort=seeders")
    .split(",").map(u => u.trim()).filter(u => u.startsWith("http"));

  console.log("[handler] Prefs:", prefs, "| minSeeders:", minSeeders);
  console.log("[handler] Consultando:", addonUrls);

  const all  = await getAllStreams(type, id, addonUrls);
  console.log(`[handler] Streams recibidos: ${all.length}`);

  if (all.length === 0) return { streams: [] };

  const best = selectBest(all, prefs, minSeeders);
  if (!best) { console.warn("[handler] Ninguno supera el mínimo de seeders"); return { streams: [] }; }

  console.log(`[handler] ✅ Ganador: "${best._rawName}" | score: ${best._score}`);
  console.log("[handler] Desglose:", best._breakdown);

  const prefLine = [
    prefs.audioLang !== "any"     ? "🔊 " + prefs.audioLang.toUpperCase()    : null,
    prefs.subtitleLang !== "none" ? "💬 " + prefs.subtitleLang.toUpperCase() : null,
    "⭐ " + best._score + "pts",
  ].filter(Boolean).join(" · ");

  const result = { name: "Smart Selector\n" + prefLine, title: best._rawTitle || best.title };
  if (best.infoHash)      { result.infoHash = best.infoHash; if (best.fileIdx !== undefined) result.fileIdx = best.fileIdx; }
  else if (best.url)      { result.url = best.url; }
  if (best.behaviorHints) result.behaviorHints = best.behaviorHints;

  return { streams: [result] };
}

module.exports = {
  manifest,
  get: async ({ resource, type, id, config }) => {
    if (resource === "stream") return streamHandler({ type, id, config });
    return {};
  },
};
