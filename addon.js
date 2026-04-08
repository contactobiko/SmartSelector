const axios = require("axios");

const QUALITY_RANK = { 
  "2160p": 5, "4k": 5, "uhd": 5, 
  "1080p": 4, "fhd": 4, 
  "720p": 3, "hd": 3, 
  "480p": 2, "480": 2, 
  "sd": 1, "cam": 1, "ts": 1, "unknown": 0 
};

const DEFAULT_CONFIG = {
  audioPrefs: ["spa", "eng"],
  subtitleMap: { "spa": "none", "eng": "spa" },
  qualities: ["2160p", "1080p", "720p", "cam", "480p"],
  addonUrls: []
};

function detectQuality(text) {
  const t = (text || "").toLowerCase();
  if (/2160p|4k|uhd/.test(t)) return "2160p";
  if (/1080p|fhd/.test(t)) return "1080p";
  if (/720p/.test(t)) return "720p";
  if (/480p|dvdrip/.test(t)) return "480p";
  if (/cam|ts|r5|.scr/.test(t)) return "cam";
  return "unknown";
}

function detectAudioLangs(text) {
  const t = (text || "").toLowerCase();
  const found = [];
  if (/\b(spa|esp|spanish|castellano|espa[ñn]ol|latino|latam)\b/.test(t)) found.push("spa");
  if (/\b(eng|english|ingl[eé]s)\b/.test(t)) found.push("eng");
  if (/\b(fra|fre|french|franc[eé]s)\b/.test(t)) found.push("fra");
  if (/\b(deu|ger|german|alem[aá]n|deutsch)\b/.test(t)) found.push("deu");
  if (/\b(ita|italian|italiano)\b/.test(t)) found.push("ita");
  if (/\b(por|port|portuguese|portugu[eê]s)\b/.test(t)) found.push("por");
  if (/\b(jpn|japanese|japon[eé]s)\b/.test(t)) found.push("jpn");
  if (/\b(kor|korean|coreano)\b/.test(t)) found.push("kor");
  if (/\b(zho|chinese|chino|mandarin)\b/.test(t)) found.push("zho");
  if (/\b(rus|russian|ruso)\b/.test(t)) found.push("rus");
  return found;
}

function detectSubtitleLangs(text) {
  const t = (text || "").toLowerCase();
  const found = [];
  if (/sub(?:titles?|s?)|subtitulad[ao]|subbed/.test(t)) {
    if (/\b(spa|esp|spanish|castellano|espa[ñn]ol)\b/.test(t)) found.push("spa");
    if (/\b(eng|english)\b/.test(t)) found.push("eng");
    if (/\b(fra|french)\b/.test(t)) found.push("fra");
    if (/\b(deu|german|deutsch)\b/.test(t)) found.push("deu");
    if (/\b(ita|italian)\b/.test(t)) found.push("ita");
    if (/\b(por|portuguese)\b/.test(t)) found.push("por");
  }
  return found;
}

function scoreStream(stream, prefs) {
  const text = [(stream.name || ""), (stream.title || "")].join(" ");
  let score = 0;
  const breakdown = {};

  const audio = detectAudioLangs(text);

  if (!prefs.audioPrefs || prefs.audioPrefs.length === 0) {
    score += 200;
    breakdown.audio = "+200";
  } else {
    const bestIdx = prefs.audioPrefs.findIndex(l => audio.includes(l));
    if (bestIdx === 0) {
      score += 500;
      breakdown.audio = "+500 (audio preferido)";
    } else if (bestIdx > 0) {
      score += 400 - (bestIdx * 80);
      breakdown.audio = `+${score} (audio en pref ${bestIdx + 1})`;
    } else if (audio.length === 0) {
      score += 50;
      breakdown.audio = "+50";
    } else {
      score += 0;
      breakdown.audio = "+0";
    }
  }

  const qual = detectQuality(text);
  if (!prefs.qualities || prefs.qualities.length === 0) {
    score += 150;
    breakdown.quality = "+150";
  } else if (prefs.qualities.includes(qual)) {
    score += 300;
    breakdown.quality = `+300 (${qual})`;
  } else {
    score += 0;
    breakdown.quality = "+0 (filtrada)";
  }

  const subs = detectSubtitleLangs(text);
  let wantedSub = null;
  if (prefs.subtitleMap) {
    for (const lang of audio) {
      if (prefs.subtitleMap[lang]) {
        wantedSub = prefs.subtitleMap[lang];
        break;
      }
    }
  }

  if (!wantedSub || wantedSub === "none") {
    score += 100;
    breakdown.subs = "+100";
  } else if (subs.includes(wantedSub)) {
    score += 150;
    breakdown.subs = `+150 (sub ${wantedSub})`;
  } else {
    score += 20;
    breakdown.subs = "+20";
  }

  const seeders = parseInt(stream._seeders) || 0;
  score += Math.min(50, Math.round(Math.log10(seeders + 1) * 20));

  return { score, breakdown };
}

function selectBest(streams, prefs) {
  if (!streams || streams.length === 0) return null;

  let filtered = streams;
  if (prefs.qualities && prefs.qualities.length > 0) {
    filtered = streams.filter(s => {
      const q = detectQuality([(s.name || ""), (s.title || "")].join(" "));
      return prefs.qualities.includes(q);
    });
  }

  if (filtered.length === 0) filtered = streams;

  return filtered
    .map(s => ({ ...s, _score: scoreStream(s, prefs).score }))
    .sort((a, b) => b._score - a._score)[0];
}

async function fetchFromAddon(baseUrl, type, id) {
  const cleanUrl = baseUrl.replace(/\/+$/, "").replace(/\/manifest\.json$/, "");
  const url = `${cleanUrl}/stream/${type}/${id}.json`;
  
  try {
    console.log(`  [proxy] ${url}`);
    const resp = await axios.get(url, { timeout: 12000 });
    const raw = resp.data?.streams || [];

    return raw.map(s => {
      const fullText = [(s.name || ""), (s.title || "")].join(" ");
      const seedersMatch = fullText.match(/(?:👥|seeds?:?)\s*(\d+)/i);
      return {
        infoHash: s.infoHash,
        fileIdx: s.fileIdx,
        url: s.url,
        behaviorHints: s.behaviorHints,
        name: s.name || "",
        title: fullText,
        _rawName: s.name,
        _rawTitle: s.title,
        _seeders: seedersMatch ? parseInt(seedersMatch[1]) : 0,
        _source: new URL(cleanUrl).hostname,
      };
    });
  } catch (err) {
    console.error(`  [proxy] Error: ${err.message}`);
    return [];
  }
}

async function getAllStreams(type, id, addonUrls) {
  if (!addonUrls || addonUrls.length === 0) return [];
  
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
    seen.add(s.infoHash);
    return true;
  });
}

const manifest = {
  id: "com.smartselector.stremio",
  version: "1.0.0",
  name: "Smart Selector",
  description: "Selector inteligente de streams",
  catalogs: [],
  resources: ["stream"],
  types: ["movie", "series"],
  idPrefixes: ["tt"],
  behaviorHints: {
    configurable: true,
    configurationRequired: false,
    adult: false
  }
};

function mergeConfig(base, override) {
  const result = { ...base };
  for (const key of Object.keys(override || {})) {
    if (override[key] !== undefined && override[key] !== null && override[key] !== "") {
      result[key] = override[key];
    }
  }
  return result;
}

async function streamHandler({ type, id, config }) {
  console.log(`[handler] ${type} ${id}`);

  const prefs = mergeConfig(DEFAULT_CONFIG, config);
  
  let addonUrls = prefs.addonUrls;
  if (typeof addonUrls === "string") {
    addonUrls = addonUrls.split(",").map(u => u.trim()).filter(u => u);
  }
  
  if (addonUrls.length === 0) {
    return { streams: [] };
  }

  const all = await getAllStreams(type, id, addonUrls);
  console.log(`[handler] Streams: ${all.length}`);

  if (all.length === 0) return { streams: [] };

  const best = selectBest(all, prefs);
  if (!best) return { streams: [] };

  console.log(`[handler] Ganador: "${best._rawName}" score: ${best._score}`);

  const result = {
    name: best._rawName || "Smart Selector",
    title: best.title || best._rawTitle
  };

  if (best.infoHash) {
    result.infoHash = best.infoHash;
    if (best.fileIdx !== undefined) result.fileIdx = best.fileIdx;
  } else if (best.url) {
    result.url = best.url;
  }
  
  if (best.behaviorHints) {
    result.behaviorHints = best.behaviorHints;
  }

  return { streams: [result] };
}

module.exports = {
  manifest,
  get: async ({ resource, type, id, config }) => {
    if (resource === "stream") return streamHandler({ type, id, config });
    return {};
  }
};
