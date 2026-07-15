import type { ProgramIeiOrderFlags } from '../../ai/ai.service';
import { removeParagraphByParaId, removeMarkerRunFromParagraph } from './docx-xml';

// ParaId для пункта 6.1
const PARA_IDS = {
  // Всегда удаляем (Благоустройство)
  mgsn: '3E6B21D3', // МГСН 1.02.02
  pp514: '582D72BF', // 514-ПП

  // Только если есть здание
  building: '41DC4980', // МР 2.6.1.0333-23

  // Только если Москва
  moscowInstruction: '30B10CC4', // Инструкция Москомархитектуры № 66
  moscow1386: '516E058D', // 1386-ПП
  moscow1387: '0A442FAE', // 1387-ПП
};

export function replaceProgramIeiSection61Block(params: {
  xml: string;
  orderFlags: ProgramIeiOrderFlags | null;
  isMoscow: boolean;
}): string {
  let xml = params.xml;

  const hasBuildingSurvey = Boolean(params.orderFlags?.hasBuildingSurvey);
  const isMoscow = params.isMoscow;

  // 1. Всегда удаляем МГСН и 514-ПП (Благоустройство)
  xml = removeParagraphByParaId(xml, PARA_IDS.mgsn);
  xml = removeParagraphByParaId(xml, PARA_IDS.pp514);

  // 2. МР 2.6.1.0333-23 (Здание) — только если есть здание, иначе удаляем
  if (hasBuildingSurvey) {
    // Убираем маркер "(Здание)" — он в отдельном <w:r>
    xml = removeMarkerRunFromParagraph(xml, PARA_IDS.building, '(Здание)');
  } else {
    xml = removeParagraphByParaId(xml, PARA_IDS.building);
  }

  // 3. Московские документы — только если адрес в Москве
  if (isMoscow) {
    // Убираем маркер "(Москва)" — в шаблоне без пробела после скобки
    xml = removeMarkerRunFromParagraph(xml, PARA_IDS.moscowInstruction, '(Москва)');
    xml = removeMarkerRunFromParagraph(xml, PARA_IDS.moscow1386, '(Москва)');
    xml = removeMarkerRunFromParagraph(xml, PARA_IDS.moscow1387, '(Москва)');
  } else {
    // Удаляем московские документы для не-Москвы
    xml = removeParagraphByParaId(xml, PARA_IDS.moscowInstruction);
    xml = removeParagraphByParaId(xml, PARA_IDS.moscow1386);
    xml = removeParagraphByParaId(xml, PARA_IDS.moscow1387);
  }

  // 4. Убираем выделение у всех параграфов секции
  xml = removeHighlightFromSection61(xml);

  return xml;
}

/**
 * Убирает выделение (highlight) у параграфов секции 6.1
 */
function removeHighlightFromSection61(xml: string): string {
  const allParaIds = Object.values(PARA_IDS);

  for (const paraId of allParaIds) {
    const paraPattern = new RegExp(
      `(<w:p\\b[^>]*w14:paraId="${paraId}"[^>]*>[\\s\\S]*?</w:p>)`,
      'g',
    );

    xml = xml.replace(paraPattern, (match) => {
      let cleaned = match;
      cleaned = cleaned.replace(/<w:highlight[^/]*\/>/g, '');
      cleaned = cleaned.replace(/<w:highlight[^>]*>[\s\S]*?<\/w:highlight>/g, '');
      cleaned = cleaned.replace(/<w:color w:val="[0-9A-Fa-f]{6}"\/>/g, '<w:color w:val="000000"/>');
      cleaned = cleaned.replace(
        /<w:color w:val="[0-9A-Fa-f]{6}"[^>]*>/g,
        '<w:color w:val="000000"/>',
      );
      return cleaned;
    });
  }

  return xml;
}
