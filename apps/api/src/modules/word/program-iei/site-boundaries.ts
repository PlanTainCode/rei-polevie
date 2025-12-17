export function extractSiteAreaSentence(tzText: string): string | null {
  const text = String(tzText || '').replace(/\u00A0/g, ' ');

  // Ищем предложение, содержащее "Площад" и "га".
  // Пример: "Площадь участка линейного объекта – около 0,18 га." (варианты до тире допускаются)
  const re = /(Площад[^.\n]{0,180}?\d+(?:[.,]\d+)?\s*га\.)/i;
  const m = text.match(re);
  if (m?.[1]) return m[1].replace(/\s+/g, ' ').trim();

  return null;
}

export function mergeSiteDescriptionWithArea(params: {
  siteDescription: string;
  siteArea: string;
  tzText: string | null;
}): { siteDescription: string; siteArea: string; siteAreaSentence: string | null } {
  const siteDescription = String(params.siteDescription || '').trim();
  const siteArea = String(params.siteArea || '').trim();

  const fromTz = params.tzText ? extractSiteAreaSentence(params.tzText) : null;
  const sentence = fromTz || (siteArea ? `${siteArea.replace(/[;\s]*$/, '')}.` : null);

  // Склеиваем: важно, чтобы в итоговом тексте была фраза про площадь.
  let merged = siteDescription;
  if (sentence) {
    const normMerged = merged.replace(/\s+/g, ' ').trim();
    const normSentence = sentence.replace(/\s+/g, ' ').trim();
    if (normSentence && !normMerged.toLowerCase().includes(normSentence.toLowerCase())) {
      merged = [merged, normSentence].filter(Boolean).join(' ').trim();
    }
  }

  return {
    siteDescription: merged,
    siteArea,
    siteAreaSentence: sentence,
  };
}

