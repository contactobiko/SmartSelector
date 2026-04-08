const axios = require("axios");

const QUALITY_RANK = { "2160p": 5, "4k": 5, "uhd": 5, "1080p": 4, "fhd": 4, "720p": 3, "hd": 3, "480p": 2, "480": 2, "sd": 1, "cam": 1, "ts": 1, "unknown": 0 };

function detectQuality(text) {
  const t = (text || "").toLowerCase();
  if (/2160p|4k|uhd/.test(t))  return "2160p";
  if (/1080p|fhd/.test(t))     return "1080p";
  if (/720p/.test(t))          return "720p";
  if (/480p|dvdrip/.test(t))   return "480p";
  if (/cam|ts|r5|.scr/.test(t)) return "cam";
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

function getSubtitleForAudio(audioLangs, subtitleMap) {
  for (const lang of audioLangs) {
    if (subtitleMap && subtitleMap[lang] && subtitleMap[lang] !== "none") {
      return subtitleMap[lang];
    }
  }
  return null;
}

function scoreStream(stream, prefs) {
  const text = [(stream.name || ""), (stream.title || "")].join(" ");
  let score = 0;
  const breakdown = {};

  const audio = detectAudioLangs(text);
  const detectedAudio = audio[0] || "unknown";

  if (!prefs.audioPrefs || prefs.audioPrefs.length === 0) {
    score += 200; breakdown.audio = "+200 (sin preferencia)";
  } else {
    const bestAudioIdx = prefs.audioPrefs.findIndex(l => audio.includes(l));
    if (bestAudioIdx === 0) {
      score += 500; breakdown.audio = `+500 (${prefs.audioPrefs[0]} preferido)`;
    } else if (bestAudioIdx > 0) {
      score += 300 - (bestAudioIdx * 50); breakdown.audio = `+${score} (${audio[0]} en posición ${bestAudioIdx + 1})`;
    } else if (audio.length === 0) {
      score += 50; breakdown.audio = "+50 (idioma desconocido)";
    } else {
      score += 0; breakdown.audio = `+0 (${audio.join(",")} no preferido)`;
    }
  }

  const qual = detectQuality(text);
  const desiredRank  = prefs.qualities && prefs.qualities.length > 0
    ? (prefs.qualities.includes(qual) ? QUALITY_RANK[qual] : -1)
    : 4;
  
  if (!prefs.qualities || prefs.qualities.length === 0 || prefs.qualities.includes(qual)) {
    if (!prefs.qualities || prefs.qualities.length === 0) {
      score += 150; breakdown.quality = "+150 (sin filtro)";
    } else {
      score += 300; breakdown.quality = `+300 (${qual} permitida)`;
    }
  } else {
    score += 0; breakdown.quality = `+0 (${qual} filtrada)`;
  }

  const subs = detectSubtitleLangs(text);
  const wantedSub = prefs.subtitleMap 
    ? getSubtitleForAudio(audio, prefs.subtitleMap) 
    : null;
  
  if (!wantedSub) {
    score += 100; breakdown.subs = "+100 (no se necesitan subs)";
  } else if (subs.includes(wantedSub)) {
    score += 150; breakdown.subs = `+150 (sub ${wantedSub})`;
  } else if (subs.length === 0 && wantedSub === "spa") {
    score += 50; breakdown.subs = "+50 (subs implícitos spa)";
  } else {
    score += 0; breakdown.subs = `+0 (subs: ${subs.join(",")})`;
  }

  const seeders = parseInt(stream._seeders) || 0;
  const seederPts = seeders > 0 ? Math.min(50, Math.round(Math.log10(seeders + 1) * 20)) : 0;
  score += seederPts; breakdown.seeders = `+${seederPts} (${seeders} seeders)`;

  return { score, breakdown, detectedAudio, detectedQuality: qual };
}

function selectBest(streams, prefs) {
  if (!streams || streams.length === 0) return null;

  let filtered = streams;
  if (prefs.qualities && prefs.qualities.length > 0) {
    filtered = streams.filter(s => {
      const t = [(s.name || ""), (s.title || "")].join(" ");
      const q = detectQuality(t);
      return prefs.qualities.includes(q);
    });
  }

  if (filtered.length === 0) filtered = streams;

  return filtered
    .map(s => { const r = scoreStream(s, prefs); return { ...s, _score: r.score, _breakdown: r.breakdown, _detectedAudio: r.detectedAudio }; })
    .sort((a, b) => b._score - a._score)[0];
}

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
  if (!addonUrls || addonUrls.length === 0) {
    return [];
  }
  const results = await Promise.allSettled(
    addonUrls.map(url => fetchFromAddon(url, type, id))
  );
  const streams = [];
  for (const r of results) {
    if (r.status === "fulfilled") streams.push(...r.value);
  }
  const seen = new Set();
  return streams.filter(s => {
    if (!s.infoHash) return true;
    if (seen.has(s.infoHash)) return false;
    seen.add(s.infoHash); return true;
  });
}

const manifest = {
  id:          "com.smartselector.stremio",
  version:     "1.0.0",
  name:        "Smart Selector",
  description: "Selector inteligente de streams con preferencias de audio, subtítulos y calidad.",
  catalogs:    [],
  resources:   ["stream"],
  types:       ["movie", "series"],
  idPrefixes:  ["tt"],
  behaviorHints: { configurable: true, configurationRequired: false },
  config: [
    { key: "addonUrls",    type: "text",   title: "🔗 URLs de addons (separadas por coma)",  default: "" },
    { key: "audioPrefs",   type: "text",   title: "🎧 Orden de audio (ej: spa,eng)",         default: "spa,eng" },
    { key: "subtitleMap",  type: "text",   title: "💬 Mapa subtítulos (ej: spa:none,eng:spa)", default: "spa:none,eng:spa" },
    { key: "qualities",    type: "text",   title: "🎬 Calidades (ej: 2160p,1080p,720p)",     default: "2160p,1080p,720p" },
  ],
};

function parseConfig(configStr) {
  if (typeof configStr === 'object') return configStr;
  try {
    return JSON.parse(decodeURIComponent(configStr));
  } catch {
    try {
      return JSON.parse(Buffer.from(configStr, 'base64').toString('utf8'));
    } catch {
      return {};
    }
  }
}

async function streamHandler({ type, id, config }) {
  console.log("\n" + "─".repeat(60));
  console.log(`[handler] ${type.toUpperCase()} ${id}`);

  const parsed = parseConfig(config);
  
  const prefs = {
    audioPrefs: parsed.audioPrefs || ["spa", "eng"],
    subtitleMap: parsed.subtitleMap || { "spa": "none", "eng": "spa" },
    qualities: parsed.qualities || ["2160p", "1080p", "720p", "cam", "480p"],
  };

  let addonUrls = [];
  if (parsed.addonUrls && parsed.addonUrls.length > 0) {
    addonUrls = parsed.addonUrls.map(u => u.trim()).filter(u => u.startsWith("http"));
  }

  console.log("[handler] Prefs:", JSON.stringify(prefs));
  console.log("[handler] Consultando:", addonUrls.length > 0 ? addonUrls : "(usando addons por defecto)");

  const all = await getAllStreams(type, id, addonUrls);
  console.log(`[handler] Streams recibidos: ${all.length}`);

  if (all.length === 0) return { streams: [] };

  const best = selectBest(all, prefs);
  if (!best) return { streams: [] };

  console.log(`[handler] ✅ Ganador: "${best._rawName}" | score: ${best._score}`);
  console.log("[handler] Desglose:", best._breakdown);

  const result = { name: best._rawName || "Smart Selector", title: best._rawTitle || best.title };
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
