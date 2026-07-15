import type { ProgramIeiSection1Data } from '../../ai/ai.service';
import { removeParagraphByParaId, replaceParagraphTextByParaIdWithItalic } from './docx-xml';

/** ParaIds пункта 7.2 «Количество экземпляров технических отчетов» */
const PARA_IDS = {
  /** «Количество экземпляров в электронном виде – N экз.» */
  electronicVide: '6E2000C5',
  /** «на бумажном носителе – N экз.;» */
  paperCopies: '2CC7373A',
  /** «на электронном носителе – N экз.» */
  electronicNositel: '5DAB0CC0',
};

/**
 * Парсит текст п.21 ТЗ: количество бумажных/электронных экземпляров
 * и предпочитаемую формулировку для электронных («виде» / «носителе»).
 */
function parseReportCopies(text: string): {
  paper: number | null;
  electronic: number | null;
  electronicPhrase: 'vide' | 'nositel' | null;
} {
  const t = text.toLowerCase().replace(/\s+/g, ' ');

  let paper: number | null = null;
  let electronic: number | null = null;
  let electronicPhrase: 'vide' | 'nositel' | null = null;

  // ВАЖНО: в JS \w НЕ включает кириллицу — используем [а-яё]
  const paperMatch = t.match(/бумажн[а-яё]*\s+(?:носител[а-яё]*|вид[а-яё]*)\s*[–\-—]\s*(\d+)/);
  if (paperMatch) {
    paper = parseInt(paperMatch[1], 10);
  }

  const elVideMatch = t.match(/электрон[а-яё]*\s+вид[а-яё]*\s*[–\-—]\s*(\d+)/);
  const elNositelMatch = t.match(/электрон[а-яё]*\s+носител[а-яё]*\s*[–\-—]\s*(\d+)/);

  if (elVideMatch) {
    electronic = parseInt(elVideMatch[1], 10);
    electronicPhrase = 'vide';
  } else if (elNositelMatch) {
    electronic = parseInt(elNositelMatch[1], 10);
    electronicPhrase = 'nositel';
  }

  return { paper, electronic, electronicPhrase };
}

/**
 * Раздел 7.2: только количество экземпляров (один раз), без уточнений про форматы.
 * Форматы остаются в п.7.3.
 */
export function replaceProgramIeiSection72Block(params: {
  xml: string;
  section1Data: ProgramIeiSection1Data | null;
}): string {
  let xml = params.xml;

  const reportText = params.section1Data?.reportCopiesText || '';
  const copies = reportText
    ? parseReportCopies(reportText)
    : { paper: null, electronic: null, electronicPhrase: null as 'vide' | 'nositel' | null };

  if (reportText) {
    console.log('[Section72] Текст из ТЗ п.21:', reportText.substring(0, 200));
    console.log(
      '[Section72] Извлечено: бумажных =',
      copies.paper,
      ', электронных =',
      copies.electronic,
      ', фраза =',
      copies.electronicPhrase,
    );
  } else {
    console.log('[Section72] reportCopiesText пуст — оставляем одно электронное количество из шаблона');
  }

  // Бумажные экземпляры
  if (xml.includes(`w14:paraId="${PARA_IDS.paperCopies}"`)) {
    if (copies.paper != null && copies.paper > 0) {
      xml = replaceParagraphTextByParaIdWithItalic(
        xml,
        PARA_IDS.paperCopies,
        `на бумажном носителе – ${copies.paper} экз.;`,
      );
    } else if (reportText && copies.electronic != null && copies.paper == null) {
      // В ТЗ только электронные — бумажную строку убираем
      xml = removeParagraphByParaId(xml, PARA_IDS.paperCopies);
    } else if (!reportText) {
      // Без ТЗ оставляем шаблонную бумажную строку как есть
    } else if (copies.paper == null) {
      xml = removeParagraphByParaId(xml, PARA_IDS.paperCopies);
    }
  }

  // Электронные: ровно одна строка, без форматов (форматы — в п.7.3)
  const phrase = copies.electronicPhrase || 'vide';
  const elCount = copies.electronic;

  if (phrase === 'nositel') {
    if (elCount != null && xml.includes(`w14:paraId="${PARA_IDS.electronicNositel}"`)) {
      xml = replaceParagraphTextByParaIdWithItalic(
        xml,
        PARA_IDS.electronicNositel,
        `на электронном носителе – ${elCount} экз.`,
      );
    }
    xml = removeParagraphByParaId(xml, PARA_IDS.electronicVide);
  } else {
    // «в электронном виде» (по умолчанию)
    if (xml.includes(`w14:paraId="${PARA_IDS.electronicVide}"`)) {
      if (elCount != null) {
        xml = replaceParagraphTextByParaIdWithItalic(
          xml,
          PARA_IDS.electronicVide,
          `Количество экземпляров в электронном виде – ${elCount} экз.`,
        );
      }
      // если elCount null и нет ТЗ — оставляем шаблонный текст vide
    }
    // Вторую электронную строку всегда убираем, чтобы количество не дублировалось
    xml = removeParagraphByParaId(xml, PARA_IDS.electronicNositel);
  }

  return xml;
}
