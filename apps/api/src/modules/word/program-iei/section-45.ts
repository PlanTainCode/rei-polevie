import { removeParagraphByParaId, replaceParagraphTextByParaIdWithItalic } from './docx-xml';

/**
 * Раздел 4.5: Обоснование выбора методик прогноза изменений природных условий.
 *
 * Всегда оставляем только «Не требуется», стандартный блок обоснования удаляем.
 */

const NOT_REQUIRED_PARA_ID = '7A32DBD3';

const FORECAST_BLOCK_PARA_IDS = [
  '6E2000A1', '6E2000A2', '6E2000A3', '6E2000A4',
  '6E2000A5', '6E2000A6', '6E2000A7', '6E2000A8',
];

export function replaceProgramIeiSection45Block(params: {
  xml: string;
  /** @deprecated больше не влияет — всегда «Не требуется» */
  section45Data?: unknown;
}): string {
  let xml = params.xml;

  if (xml.includes(`w14:paraId="${NOT_REQUIRED_PARA_ID}"`)) {
    xml = replaceParagraphTextByParaIdWithItalic(xml, NOT_REQUIRED_PARA_ID, 'Не требуется');
  }

  for (const id of FORECAST_BLOCK_PARA_IDS) {
    xml = removeParagraphByParaId(xml, id);
  }

  return xml;
}
