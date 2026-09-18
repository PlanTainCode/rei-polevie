import { readFile } from 'fs/promises';
import PizZip from 'pizzip';
import { extractVisibleTextFromDocxXml } from './xml-text';

const SECTION1_HINT = `§1 шаблона отчёта ИЭИ (не программы):
- Введение: объект, вид градостроительной деятельности (одно значение 1:1 из ТЗ), этап, договор с заказчиком.
- 1.7: «Территория изысканий расположена … (см. Рисунок 1.1).»
- Зона: «Территория изысканий расположена в {формулировка из ТЗ}.»
- Водный объект и соцобъекты — только если явно есть в ТЗ/окружении.
- Здание — только при обследовании/сносе/реконструкции по ТЗ.`;

/** Текст введения и §1 из шаблона отчёта — контекст для AI. Без mammoth. */
export async function extractReportIeiSection1TemplateText(templatePath: string): Promise<string> {
  try {
    const buffer = await readFile(templatePath);
    const zip = new PizZip(buffer);
    const xml = zip.file('word/document.xml')?.asText() || '';
    const full = extractVisibleTextFromDocxXml(xml);
    const firstIntro = full.indexOf('Введение');
    const secondIntro = firstIntro >= 0 ? full.indexOf('Введение', firstIntro + 1) : -1;
    const start = secondIntro >= 0 ? secondIntro : firstIntro;
    const searchFrom = start >= 0 ? start + 8 : 0;
    const end = full.indexOf('Инженерно-экологическая изученность территории', searchFrom);

    if (start >= 0 && end > start) {
      return full.slice(start, end).trim();
    }
    if (full) return full.slice(0, 7000);
  } catch (error) {
    console.error('[ReportIei] Не удалось прочитать текст §1 шаблона:', error);
  }
  return SECTION1_HINT;
}

export function reportIeiSection1AiHint(): string {
  return SECTION1_HINT;
}
