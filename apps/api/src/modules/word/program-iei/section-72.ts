import type { ProgramIeiSection1Data } from '../../ai/ai.service';
import { removeParagraphByParaId, replaceParagraphTextByParaIdWithItalic } from './docx-xml';

// ParaIds для пункта 7.2 "Количество экземпляров технических отчетов"
const PARA_IDS = {
  paperCopies: '2CC7373A',    // "на бумажном носителе – 3 экз.;"
  electronicCopies: '5DAB0CC0', // "на электронном носителе – 2 экз."
};

/**
 * Парсит текст п.21 ТЗ и извлекает количество бумажных и электронных экземпляров.
 * 
 * Примеры текстов из ТЗ:
 * - "Количество экземпляров в электронном виде – 1 экз. (в не редактируемом формате .pdf...)"
 * - "Количество экземпляров на бумажном носителе – 3 экз."
 * - "на бумажном носителе – 4 экз., на электронном носителе – 2 экз."
 */
function parseReportCopies(text: string): {
  paper: number | null;
  electronic: number | null;
  electronicFormats: string | null;
} {
  const t = text.toLowerCase().replace(/\s+/g, ' ');

  let paper: number | null = null;
  let electronic: number | null = null;
  let electronicFormats: string | null = null;

  // Бумажные экземпляры: "бумажном носителе – 3 экз" или "бумажном виде – 3"
  const paperMatch = t.match(/бумажн\w*\s+(?:носител\w*|вид\w*)\s*[–\-—]\s*(\d+)/);
  if (paperMatch) {
    paper = parseInt(paperMatch[1], 10);
  }

  // Электронные экземпляры: "электронном виде – 1 экз" или "электронном носителе – 2"
  const elMatch = t.match(/электрон\w*\s+(?:вид\w*|носител\w*)\s*[–\-—]\s*(\d+)/);
  if (elMatch) {
    electronic = parseInt(elMatch[1], 10);
  }

  // Форматы электронных экземпляров: "(в не редактируемом формате .pdf, ...)"
  const fmtMatch = text.match(/\(в\s+не\s+редактируемом[^)]+\)/i);
  if (fmtMatch) {
    electronicFormats = fmtMatch[0];
  }

  return { paper, electronic, electronicFormats };
}

/**
 * Раздел 7.2: Количество экземпляров технических отчетов на бумажных и электронных носителях
 * 
 * Берёт текст из п.21 ТЗ (reportCopiesText) и подставляет количество экземпляров в шаблон.
 */
export function replaceProgramIeiSection72Block(params: {
  xml: string;
  section1Data: ProgramIeiSection1Data | null;
}): string {
  let xml = params.xml;

  const reportText = params.section1Data?.reportCopiesText || '';
  if (!reportText) {
    console.log('[Section72] reportCopiesText пуст, оставляем шаблонные значения');
    return xml;
  }

  console.log('[Section72] Текст из ТЗ п.21:', reportText.substring(0, 200));

  const copies = parseReportCopies(reportText);
  console.log('[Section72] Извлечено: бумажных =', copies.paper, ', электронных =', copies.electronic, ', форматы =', copies.electronicFormats);

  // Бумажные экземпляры
  if (xml.includes(`w14:paraId="${PARA_IDS.paperCopies}"`)) {
    if (copies.paper != null && copies.paper > 0) {
      xml = replaceParagraphTextByParaIdWithItalic(
        xml,
        PARA_IDS.paperCopies,
        `на бумажном носителе – ${copies.paper} экз.;`,
      );
    } else if (copies.electronic != null && copies.paper == null) {
      // Если в ТЗ нет бумажных экземпляров — убираем строку
      xml = removeParagraphByParaId(xml, PARA_IDS.paperCopies);
    }
  }

  // Электронные экземпляры
  if (copies.electronic != null && xml.includes(`w14:paraId="${PARA_IDS.electronicCopies}"`)) {
    // Формируем текст с указанием форматов если есть
    let elText = `на электронном носителе – ${copies.electronic} экз.`;
    if (copies.electronicFormats) {
      elText += ` ${copies.electronicFormats}`;
    }
    xml = replaceParagraphTextByParaIdWithItalic(
      xml,
      PARA_IDS.electronicCopies,
      elText,
    );
  }

  return xml;
}
