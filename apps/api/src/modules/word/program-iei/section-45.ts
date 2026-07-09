import type { ProgramIeiSection45Data } from '../../ai/ai.service';
import { removeParagraphByParaId, replaceParagraphTextByParaIdWithItalic } from './docx-xml';

/**
 * Раздел 4.5: Обоснование выбора методик прогноза изменений природных условий.
 *
 * В актуальном шаблоне ячейка содержит ДВА взаимоисключающих варианта
 * (в шаблоне помечены разной заливкой):
 *  - «Не требуется» (жёлтый) — прогноз не требуется;
 *  - стандартный блок обоснования + перечень НТД (зелёный) — прогноз требуется.
 *
 * По ТЗ (forecastRequirements) выбираем ОДИН вариант, второй удаляем.
 */

// Абзац-вариант «Не требуется» (ячейка справа от заголовка п.4.5)
const NOT_REQUIRED_PARA_ID = '7A32DBD3';

// Стандартный блок обоснования прогноза (8 абзацев: вводный + «Перечень...» + 6 НТД)
const FORECAST_BLOCK_PARA_IDS = [
  '6E2000A1', '6E2000A2', '6E2000A3', '6E2000A4',
  '6E2000A5', '6E2000A6', '6E2000A7', '6E2000A8',
];

export function replaceProgramIeiSection45Block(params: {
  xml: string;
  section45Data: ProgramIeiSection45Data | null;
}): string {
  let xml = params.xml;

  const req = (params.section45Data?.forecastRequirements || '').trim();
  // Прогноз НЕ требуется, если из ТЗ пусто / «Не требуется» / «не предусмотрен» и т.п.
  const notRequired = !req || /^(не\s+требуется|не\s+предусмотр|отсутству|нет\b)/i.test(req);

  if (notRequired) {
    // Оставляем «Не требуется», удаляем зелёный блок обоснования
    if (xml.includes(`w14:paraId="${NOT_REQUIRED_PARA_ID}"`)) {
      xml = replaceParagraphTextByParaIdWithItalic(xml, NOT_REQUIRED_PARA_ID, 'Не требуется');
    }
    for (const id of FORECAST_BLOCK_PARA_IDS) {
      xml = removeParagraphByParaId(xml, id);
    }
  } else {
    // Прогноз требуется: удаляем «Не требуется», оставляем стандартный блок обоснования
    xml = removeParagraphByParaId(xml, NOT_REQUIRED_PARA_ID);
  }

  return xml;
}
