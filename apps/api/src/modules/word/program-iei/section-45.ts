import type { ProgramIeiSection45Data } from '../../ai/ai.service';
import { replaceParagraphTextByParaIdPreserveRunProps } from './docx-xml';

/**
 * Раздел 4.5: Обоснование выбора методик прогноза изменений природных условий
 * 
 * Логика:
 * - Берем текст из ТЗ раздела "Требования к составлению прогноза изменения природных условий" (п.18 ТЗ)
 * - Вставляем в ячейку таблицы с paraId="7A32DBD3"
 */
export function replaceProgramIeiSection45Block(params: {
  xml: string;
  section45Data: ProgramIeiSection45Data | null;
}): string {
  let xml = params.xml;

  const forecastText = params.section45Data?.forecastRequirements?.trim() || 'Не требуется';

  // Целевой paraId в таблице (ячейка справа от заголовка "Обоснование выбора методик прогноза...")
  const targetParaId = '7A32DBD3';
  
  if (xml.includes(`w14:paraId="${targetParaId}"`)) {
    xml = replaceParagraphTextByParaIdPreserveRunProps(xml, targetParaId, forecastText);
  }

  return xml;
}
