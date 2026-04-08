function selectBestStream(streams, prefs) {
  const scored = streams.map(s => {
    let score = 0;
    const text = s._rawText;

    // 1. Puntuación por Idioma (Soporta múltiples idiomas preferidos)
    const languageMap = {
      spa: /\b(spa|esp|spanish|castellano|español|latino|latam)\b/i,
      eng: /\b(eng|english|ingles)\b/i
    };

    prefs.audioPrefs.forEach(langCode => {
      const regex = languageMap[langCode];
      if (regex && regex.test(text)) {
        score += 500; // Gran prioridad al idioma
      }
    });

    // 2. Puntuación por Calidad (Soporta lista de calidades)
    prefs.qualities.forEach((q, index) => {
      if (text.includes(q.toLowerCase())) {
        // Más puntos si está al principio de tu lista de preferidos
        score += (300 - (index * 50)); 
      }
    });

    // 3. Bonus por Seeders (Pequeño desempate)
    const seedersMatch = text.match(/👥\s*(\d+)/);
    if (seedersMatch) {
      score += Math.min(parseInt(seedersMatch[1]) / 10, 50);
    }

    return { ...s, _score: score };
  });

  // Ordenar de mayor a menor puntuación y devolver el mejor
  return scored.sort((a, b) => b._score - a._score)[0];
}

module.exports = { selectBestStream };
