/**
 * Scoring algorithm to rank streams by user preferences.
 *
 * Final score = audioScore + subtitleScore + qualityScore + seederScore
 *
 * Weights:
 *   Audio language match   → 500 pts  (highest priority)
 *   Quality match          → 300 pts
 *   Subtitle match         → 150 pts
 *   Seeder count           → up to 50 pts (logarithmic, tiebreaker)
 */

const QUALITY_RANK = {
  "2160p": 5,
  "4k":    5,
  "uhd":   5,
  "1080p": 4,
  "fhd":   4,
  "720p":  3,
  "hd":    3,
  "480p":  2,
  "sd":    1,
  "unknown": 0,
};

const QUALITY_WEIGHTS = {
  500: 5,   // 2160p
  400: 4,   // 1080p
  300: 3,   // 720p
  200: 2,   // 480p
  100: 1,   // SD
    0: 0,   // unknown
};

/**
 * Detect quality from a stream's title/name string.
 */
function detectQuality(title = "") {
  const t = title.toLowerCase();
  if (/2160p|4k|uhd/.test(t))  return "2160p";
  if (/1080p|fhd/.test(t))     return "1080p";
  if (/720p|hd/.test(t))       return "720p";
  if (/480p|sd/.test(t))       return "480p";
  return "unknown";
}

/**
 * Detect audio languages from a stream's title string.
 * Returns an array of ISO 639-1 or 639-2 codes found.
 */
function detectAudioLanguages(title = "") {
  const t = title.toLowerCase();
  const found = [];

  const LANG_PATTERNS = {
    spa: [/\bspa\b/, /\besp\b/, /\bspanish\b/, /\bcastell[a]?no\b/, /\bespa[ñn]ol\b/, /\blat[íi]no\b/, /\blatam\b/],
    eng: [/\beng\b/, /\benglish\b/, /\bingl[eé]s\b/],
    fra: [/\bfra\b/, /\bfre\b/, /\bfrench\b/, /\bfranc[eé]s\b/, /\bfrançais\b/],
    deu: [/\bdeu\b/, /\bger\b/, /\bgerman\b/, /\balem[aá]n\b/, /\bdeutsch\b/],
    ita: [/\bita\b/, /\bitalian\b/, /\bitaliano\b/],
    por: [/\bpor\b/, /\bport\b/, /\bportuguese\b/, /\bportugu[eê]s\b/],
    jpn: [/\bjpn\b/, /\bjapanese\b/, /\bjapon[eé]s\b/],
    kor: [/\bkor\b/, /\bkorean\b/, /\bcoreano\b/],
    zho: [/\bzho\b/, /\bchinese\b/, /\bchino\b/, /\bmandarin\b/],
    rus: [/\brus\b/, /\brussian\b/, /\bruso\b/],
    ara: [/\bara\b/, /\barabic\b/, /\b[aá]rabe\b/],
  };

  for (const [lang, patterns] of Object.entries(LANG_PATTERNS)) {
    if (patterns.some(p => p.test(t))) {
      found.push(lang);
    }
  }

  return found;
}

/**
 * Detect subtitle languages from a stream's title string.
 */
function detectSubtitleLanguages(title = "") {
  const t = title.toLowerCase();
  const found = [];

  // Subtitles usually appear after keywords like "sub", "subs", "subtitles"
  const subSection = t.match(/sub(?:titles?|s?)[\s:]+([a-z ,/|+]+)/i);
  const baseTitle = subSection ? subSection[1] : t;

  const LANG_PATTERNS = {
    spa: [/\bspa\b/, /\besp\b/, /\bspanish\b/, /\bcastell[a]?no\b/, /\bespa[ñn]ol\b/],
    eng: [/\beng\b/, /\benglish\b/, /\bingl[eé]s\b/],
    fra: [/\bfra\b/, /\bfrench\b/, /\bfranc[eé]s\b/],
    deu: [/\bdeu\b/, /\bgerman\b/, /\balem[aá]n\b/],
    ita: [/\bita\b/, /\bitalian\b/],
    por: [/\bpor\b/, /\bportuguese\b/, /\bportugu[eê]s\b/],
    jpn: [/\bjpn\b/, /\bjapanese\b/],
  };

  // Check in full title for subtitle indicators
  for (const [lang, patterns] of Object.entries(LANG_PATTERNS)) {
    const inSubSection = subSection ? patterns.some(p => p.test(baseTitle)) : false;
    // Also check for explicit patterns like "[ESP subs]" or "subtitulado español"
    const explicit = /subtitulad[ao]|subbed/.test(t) && patterns.some(p => p.test(t));
    if (inSubSection || explicit) {
      found.push(lang);
    }
  }

  return found;
}

/**
 * Main scoring function.
 * @param {Object} stream - Stream object with title, seeders, etc.
 * @param {Object} prefs  - User preferences: { audioLang, subtitleLang, quality }
 * @returns {number} Total score (higher = better)
 */
function scoreStream(stream, prefs) {
  const title = (stream.title || stream.name || "").toLowerCase();
  let score = 0;
  const breakdown = {};

  // ─── 1. AUDIO LANGUAGE ───────────────────────────────────────────────────
  const detectedAudio = detectAudioLanguages(title);
  if (prefs.audioLang && prefs.audioLang !== "any") {
    if (detectedAudio.includes(prefs.audioLang)) {
      score += 500;
      breakdown.audio = `+500 (${prefs.audioLang} found)`;
    } else if (detectedAudio.length === 0) {
      // Unknown audio — mild penalty, might still be correct
      score += 50;
      breakdown.audio = "+50 (audio lang unknown, possible match)";
    } else {
      score += 0;
      breakdown.audio = `+0 (audio langs: ${detectedAudio.join(",")} ≠ ${prefs.audioLang})`;
    }
  } else {
    score += 200; // no preference = neutral
    breakdown.audio = "+200 (no preference)";
  }

  // ─── 2. QUALITY ──────────────────────────────────────────────────────────
  const detectedQuality = detectQuality(title);
  const desiredRank  = QUALITY_RANK[prefs.quality]  || 0;
  const detectedRank = QUALITY_RANK[detectedQuality] || 0;

  if (prefs.quality === "any") {
    score += 150;
    breakdown.quality = "+150 (no preference)";
  } else {
    // Perfect match
    if (detectedRank === desiredRank) {
      score += 300;
      breakdown.quality = `+300 (exact: ${detectedQuality})`;
    } else if (detectedRank > desiredRank) {
      // Better than desired — still good, slight bonus
      score += 250;
      breakdown.quality = `+250 (better than desired: ${detectedQuality} > ${prefs.quality})`;
    } else {
      // Below desired quality — penalize proportionally
      const diff = desiredRank - detectedRank;
      const qualityScore = Math.max(0, 300 - diff * 80);
      score += qualityScore;
      breakdown.quality = `+${qualityScore} (below desired: ${detectedQuality} < ${prefs.quality})`;
    }
  }

  // ─── 3. SUBTITLES ────────────────────────────────────────────────────────
  const detectedSubs = detectSubtitleLanguages(title);
  if (!prefs.subtitleLang || prefs.subtitleLang === "none") {
    score += 0;
    breakdown.subtitle = "+0 (subtitles not needed)";
  } else if (detectedSubs.includes(prefs.subtitleLang)) {
    score += 150;
    breakdown.subtitle = `+150 (subtitle ${prefs.subtitleLang} found)`;
  } else if (detectedSubs.length === 0) {
    score += 20;
    breakdown.subtitle = "+20 (subtitle lang unknown)";
  } else {
    score += 0;
    breakdown.subtitle = `+0 (subs: ${detectedSubs.join(",")} ≠ ${prefs.subtitleLang})`;
  }

  // ─── 4. SEEDERS (tiebreaker) ─────────────────────────────────────────────
  const seeders = parseInt(stream.seeders) || 0;
  const seederScore = seeders > 0 ? Math.min(50, Math.round(Math.log10(seeders + 1) * 20)) : 0;
  score += seederScore;
  breakdown.seeders = `+${seederScore} (${seeders} seeders)`;

  // ─── 5. SIZE PENALTY (prefer balanced file sizes) ────────────────────────
  // Penalize extremely large files (remux/raw) unless quality is 4K
  const sizeGB = parseFloat(stream.sizeGB) || 0;
  if (sizeGB > 0) {
    if (prefs.quality !== "2160p" && sizeGB > 20) {
      score -= 50;
      breakdown.size = `-50 (file too large: ${sizeGB}GB)`;
    } else if (sizeGB > 0.1) {
      score += 10;
      breakdown.size = "+10 (reasonable file size)";
    }
  }

  return { score, breakdown, detectedAudio, detectedQuality, detectedSubs };
}

/**
 * Select the best stream from a list according to user preferences.
 * @param {Array}  streams - Array of stream objects
 * @param {Object} prefs   - User preferences
 * @param {number} minSeeders - Minimum required seeders
 * @returns {Object|null} The best stream object (with .score injected) or null
 */
function selectBestStream(streams, prefs, minSeeders = 0) {
  if (!streams || streams.length === 0) return null;

  const scored = streams
    .filter(s => {
      const seeders = parseInt(s.seeders) || 0;
      return seeders >= minSeeders || minSeeders === 0;
    })
    .map(s => {
      const result = scoreStream(s, prefs);
      return { ...s, _score: result.score, _breakdown: result.breakdown };
    })
    .sort((a, b) => b._score - a._score);

  return scored[0] || null;
}

module.exports = { scoreStream, selectBestStream, detectQuality, detectAudioLanguages, detectSubtitleLanguages };
