/**
 * П.7.3 «Форматы текстовых и графических документов в электронном виде».
 * Всегда остаётся как в шаблоне — AI и пост-обработка документ не меняют.
 */
const SECTION_73_PARA_IDS = [
  '763BD95A', // заголовок
  '6E2000C2', // .pdf / .dwg / .xls / .doc
  '6E2000C3', // Требования к предоставлению Документации…
  '6FCF8BEF', // Приказ Минстроя / перечень форматов
] as const;

export function extractProgramIeiSection73Paragraphs(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const id of SECTION_73_PARA_IDS) {
    const match = xml.match(
      new RegExp(`<w:p[^>]*w14:paraId="${id}"[^>]*>[\\s\\S]*?<\\/w:p>`),
    );
    if (match) {
      map.set(id, match[0]);
    }
  }
  return map;
}

/** Возвращает абзацы п.7.3 в исходном виде из шаблона. */
export function restoreProgramIeiSection73Paragraphs(
  xml: string,
  paragraphs: Map<string, string>,
): string {
  if (!paragraphs.size) return xml;
  let result = xml;
  for (const [id, original] of paragraphs) {
    const re = new RegExp(`<w:p[^>]*w14:paraId="${id}"[^>]*>[\\s\\S]*?<\\/w:p>`);
    if (!re.test(result)) continue;
    result = result.replace(re, () => original);
  }
  return result;
}
