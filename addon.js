const axios = require("axios");

const HTTP_CONFIG = {
  timeout: 15000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9"
  }
};

const QUALITY_SCORES = {
  "2160p": 5, "4k": 5, "uhd": 5,
  "1080p": 4, "fhd": 4,
  "720p": 3, "hd": 3,
  "480p": 2, "480": 2,
  "cam": 1, "ts": 1, "sd": 1,
  "unknown": 0
};

const LANGUAGE_PATTERNS = {
  spa: /\b(spa|esp|spanish|castellano|espa[ñn]ol|latino|latam)\b/,
  eng: /\b(eng|english|ingl[eé]s)\b/,
  fra: /\b(fra|fre|french|franc[eé]s)\b/,
  deu: /\b(deu|ger|german|alem[aá]n|deutsch)\b/,
  ita: /\b(ita|italian|italiano)\b/,
  por: /\b(por|port|portuguese|portugu[eê]s)\b/,
  jpn: /\b(jpn|japanese|japon[eé]s)\b/,
  kor: /\b(kor|korean|coreano)\b/,
  zho: /\b(zho|chinese|chino|mandarin)\b/,
  rus: /\b(rus|russian|ruso)\b/
};

const QUALITY_PATTERNS = [
  { regex: /2160p|4k|uhd/, quality: "2160p" },
  { regex: /1080p|fhd/, quality: "1080p" },
  { regex: /720p/, quality: "720p" },
  { regex: /480p|dvdrip/, quality: "480p" },
  { regex: /cam|ts|r5|scr/, quality: "cam" }
];

const DEFAULT_CONFIG = {
  audioPrefs: ["spa", "eng"],
  subtitleMap: { "spa": "none", "eng": "spa" },
  qualities: ["2160p", "1080p", "720p", "cam", "480p"],
  addonUrls: []
};

function cleanUrl(url) {
  return url.trim()
    .replace(/\/+$/, "")
    .replace(/\/manifest\.json\/?$/, "")
    .replace(/\/sort=[^\/]+$/, "");
}

function detectQuality(text) {
  const t = (text || "").toLowerCase();
  for (const { regex, quality } of QUALITY_PATTERNS) {
    if (regex.test(t)) return quality;
  }
  return "unknown";
}

function detectLanguages(text) {
  const t = (text || "").toLowerCase();
  const found = [];
  for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
    if (pattern.test(t)) found.push(lang);
  }
  return found;
}

function detectSubtitles(text) {
  const t = (text || "").toLowerCase();
  if (!/sub(?:titles?|s?)|subtitulad[ao]|subbed/.test(t)) return [];
  const found = [];
  if (/\b(spa|esp|spanish|castellano|espa[ñn]ol)\b/.test(t)) found.push("spa");
  if (/\b(eng|english)\b/.test(t)) found.push("eng");
  if (/\b(fra|french)\b/.test(t)) found.push("fra");
  if (/\b(deu|german)\b/.test(t)) found.push("deu");
  return found;
}

function scoreStream(stream, prefs) {
  const text = `${stream.name || ""} ${stream.title || ""}`;
  const audioLangs = detectLanguages(text);
  const quality = detectQuality(text);
  const subtitles = detectSubtitles(text);
  let score = 0;

  const audioIdx = prefs.audioPrefs.findIndex(l => audioLangs.includes(l));
  if (audioIdx === 0) score += 500;
  else if (audioIdx > 0) score += Math.max(100, 400 - audioIdx * 80);
  else if (audioLangs.length === 0) score += 50;
  else score += 0;

  if (!prefs.qualities?.length || prefs.qualities.includes(quality)) {
    score += 300;
  } else {
    score += 0;
  }

  let wantedSub = null;
  for (const lang of audioLangs) {
    if (prefs.subtitleMap?.[lang] && prefs.subtitleMap[lang] !== "none") {
      wantedSub = prefs.subtitleMap[lang];
      break;
    }
  }

  if (!wantedSub) score += 100;
  else if (subtitles.includes(wantedSub)) score += 150;
  else score += 20;

  const seeders = parseInt(stream._seeders) || 0;
  score += Math.min(50, Math.round(Math.log10(seeders + 1) * 20));

  return score;
}

async function fetchFromAddon(baseUrl, type, id) {
  const url = `${cleanUrl(baseUrl)}/stream/${type}/${id}.json`;

  try {
    const resp = await axios.get(url, HTTP_CONFIG);
    const streams = resp.data?.streams || [];

    return streams.map(s => {
      const fullText = `${s.name || ""} ${s.title || ""}`;
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
        _source: new URL(cleanUrl(baseUrl)).hostname
      };
    });
  } catch (err) {
    console.error(`Error ${baseUrl}: ${err.message}`);
    return [];
  }
}

async function getAllStreams(type, id, addonUrls) {
  if (!addonUrls?.length) return [];

  const promises = addonUrls.map(url => fetchFromAddon(url, type, id));
  const results = await Promise.allSettled(promises);

  const streams = results
    .filter(r => r.status === "fulfilled")
    .flatMap(r => r.value);

  const seen = new Set();
  return streams.filter(s => {
    if (!s.infoHash) return true;
    if (seen.has(s.infoHash)) return false;
    seen.add(s.infoHash);
    return true;
  });
}

function mergeConfig(base, override) {
  const result = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    if (value !== undefined && value !== null && value !== "") {
      result[key] = value;
    }
  }
  return result;
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
    configurationRequired: false
  }
};

async function streamHandler({ type, id, config }) {
  console.log(`[stream] ${type} ${id}`);

  const prefs = mergeConfig(DEFAULT_CONFIG, config);
  let addonUrls = prefs.addonUrls;

  if (typeof addonUrls === "string") {
    addonUrls = addonUrls.split(",").map(u => u.trim()).filter(Boolean);
  }

  if (!addonUrls?.length) {
    console.log("[stream] No hay addons configurados");
    return { streams: [] };
  }

  const all = await getAllStreams(type, id, addonUrls);
  console.log(`[stream] ${all.length} streams`);

  if (!all.length) return { streams: [] };

  const scored = all.map(s => ({ ...s, _score: scoreStream(s, prefs) }));
  const best = scored.sort((a, b) => b._score - a._score)[0];

  console.log(`[stream] Mejor: "${best._rawName}" (score: ${best._score})`);

  const result = { name: best._rawName || "Smart Selector" };

  if (best.infoHash) {
    result.infoHash = best.infoHash;
    if (best.fileIdx !== undefined) result.fileIdx = best.fileIdx;
  } else if (best.url) {
    result.url = best.url;
  }

  if (best.behaviorHints) result.behaviorHints = best.behaviorHints;

  return { streams: [result] };
}

module.exports = {
  manifest,
  get: async ({ resource, type, id, config }) => {
    if (resource === "stream") return streamHandler({ type, id, config });
    return {};
  }
};
