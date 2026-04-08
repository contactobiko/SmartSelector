const QUALITY_RANK = {
  "2160p": 5, "4k": 5, "uhd": 5,
  "1080p": 4, "fhd": 4,
  "720p": 3, "hd": 3,
  "480p": 2, "sd": 1, "unknown": 0
};

const LANGUAGE_PATTERNS = {
  spa: /\b(spa|esp|spanish|castellano|español|latino|latam)\b/i,
  eng: /\b(eng|english|ingles)\b/i
};

function scoreStream(stream, prefs) {
  let score = 0;
  const text = stream._rawText;

  // 1. Detección de Calidad
  let detectedQ = "unknown";
  for (const q in QUALITY_RANK) {
    if (text.includes(q)) {
      detectedQ = q;
      break;
    }
  }

  // Puntos por calidad
  if (detectedQ === prefs.quality) score += 300;
  else if (QUALITY_RANK[detectedQ] > QUALITY_RANK[prefs.quality]) score += 100; // Mejor que lo pedido
  else if (QUALITY_RANK[detectedQ] < QUALITY_RANK[prefs.quality]) score -= 100; // Peor que lo pedido

  // 2. Idioma de Audio (Prioridad Máxima)
  if (prefs.audioLang !== "any") {
    const pattern = LANGUAGE_PATTERNS[prefs.audioLang];
    if (pattern && pattern.test(text)) {
      score += 500;
    }
  }

  // 3. Seeders (Bonus logarítmico para desempate)
  if (stream._seeders > 0) {
    score += Math.min(stream._seeders * 0.5, 50);
  }

  // 4. Penalización por tamaño (Si no es 4K y pesa > 15GB, probablemente sea un Remux pesado)
  if (prefs.quality !== "2160p" && stream._sizeGB > 15) {
    score -= 100;
  }

  return score;
}

function selectBestStream(streams, prefs) {
  if (!streams.length) return null;
  
  const scored = streams.map(s => ({
    ...s,
    _finalScore: scoreStream(s, prefs)
  }));

  return scored.sort((a, b) => b._finalScore - a._finalScore)[0];
}

module.exports = { selectBestStream };
