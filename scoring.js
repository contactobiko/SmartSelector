const QUALITY_RANK = { "2160p": 5, "4k": 5, "1080p": 4, "720p": 3, "480p": 2 };

const LANGUAGE_PATTERNS = {
  spa: /\b(spa|esp|spanish|castellano|español|latino|latam)\b/i,
  eng: /\b(eng|english|ingles)\b/i
};

function scoreStream(stream, prefs) {
  let score = 0;
  const text = stream._rawText;

  // 1. Prioridad de Idioma (Prioridad Máxima: 500pts)
  const langMatch = (Array.isArray(prefs.audioPrefs) ? prefs.audioPrefs : [prefs.audioLang || 'spa']);
  langMatch.forEach(lang => {
    if (LANGUAGE_PATTERNS[lang]?.test(text)) score += 500;
  });

  // 2. Calidad (300pts si coincide)
  const preferredQuality = Array.isArray(prefs.qualities) ? prefs.qualities[0] : (prefs.quality || "1080p");
  if (text.includes(preferredQuality)) {
    score += 300;
  } else if (text.includes("1080p") && preferredQuality === "720p") {
    score += 100; // Bonus pequeño por mejor calidad de la pedida
  }

  // 3. Bonus por Seeders (Desempate)
  score += Math.min(stream._seeders * 0.5, 50);

  // 4. Penalización por archivos excesivamente pesados (Remux)
  if (stream._sizeGB > 20 && !text.includes("2160p")) {
    score -= 100;
  }

  return score;
}

function selectBestStream(streams, prefs) {
  if (!streams.length) return null;
  const scored = streams.map(s => ({ ...s, _score: scoreStream(s, prefs) }));
  return scored.sort((a, b) => b._score - a._score)[0];
}

module.exports = { selectBestStream };
