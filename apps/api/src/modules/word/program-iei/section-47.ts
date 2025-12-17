import type { ProgramIeiOrderFlags } from '../../ai/ai.service';
import type { Section47LayersData, SoilLayer } from '../../ai/program-iei/section-47-layers';
import { removeParagraphByParaId, replaceParagraphTextByParaIdPreserveRunProps } from './docx-xml';

// ParaId для условного удаления
const PARA_IDS = {
  // ППР (плотность потока радона)
  ppr: '39CC5C65',

  // Обследование здания (4 параграфа)
  buildingSurveyHeader: '19BAE2A3',
  buildingSurveyGammaScan: '16D5EF8F',
  buildingSurveyMAED: '10F360DF',
  buildingSurveyEROA: '6A935AF9',

  // Основной параграф про отбор проб с площадок и скважин
  soilSamplingMain: '308E5161',

  // Слои грунта (10 параграфов с фиксированными слоями из шаблона)
  layers: [
    '18870DCF', // 0,2-1,0 м
    '126E6E3F', // 1,0-2,0 м
    '7F05BC7B', // 2,0-3,0 м
    '3AF992CD', // 3,0-4,0 м
    '368C2BEC', // 4,0-5,0 м
    '4D19489B', // 5,0-6,0 м
    '2E902EA9', // 6,0-8,0 м
    '70CA0B35', // 8,0-10,0 м
    '19F93532', // 10,0-12,0 м
    '53651C48', // 12,0-15,0 м
  ],

  // Эпидемиологическое загрязнение (площадки ПП/СК)
  epidemiologicalSampling: '74E1E0DB',

  // Бурение скважин + глубина
  boreholeDepth: '5C1C2505',

  // Поверхностные воды
  surfaceWater: '651BB5BC',

  // Донные отложения
  sediment: '5C03EB4F',

  // Подземные воды
  groundwater: '0AB97C19',

  // Газогеохимия (шпуровая съемка)
  gasGeochemistry: '16AC340F',
};

export function replaceProgramIeiSection47Block(params: {
  xml: string;
  orderFlags: ProgramIeiOrderFlags | null;
  layersData: Section47LayersData | null;
  uniquePlatformCount: number;
}): string {
  let xml = params.xml;

  const flags: ProgramIeiOrderFlags = params.orderFlags || {
    hasWaterSampling: false,
    hasSedimentSampling: false,
    hasAirSampling: false,
    hasPhysicalImpacts: false,
    hasBuildingSurvey: false,
    isCommunicationNetworksObject: false,
    hasPPR: false,
    hasGasGeochemistry: false,
    hasSurfaceWater: false,
    hasGroundwater: false,
  };

  // 1. ППР - удаляем если нет
  if (!flags.hasPPR) {
    xml = removeParagraphByParaId(xml, PARA_IDS.ppr);
  }

  // 2. Обследование здания - удаляем все 4 параграфа если нет
  if (!flags.hasBuildingSurvey) {
    xml = removeParagraphByParaId(xml, PARA_IDS.buildingSurveyHeader);
    xml = removeParagraphByParaId(xml, PARA_IDS.buildingSurveyGammaScan);
    xml = removeParagraphByParaId(xml, PARA_IDS.buildingSurveyMAED);
    xml = removeParagraphByParaId(xml, PARA_IDS.buildingSurveyEROA);
  }

  // 3. Поверхностные воды - удаляем если нет
  if (!flags.hasSurfaceWater) {
    xml = removeParagraphByParaId(xml, PARA_IDS.surfaceWater);
  }

  // 4. Донные отложения - удаляем если нет
  if (!flags.hasSedimentSampling) {
    xml = removeParagraphByParaId(xml, PARA_IDS.sediment);
  }

  // 5. Подземные воды - удаляем если нет
  if (!flags.hasGroundwater) {
    xml = removeParagraphByParaId(xml, PARA_IDS.groundwater);
  }

  // 6. Газогеохимия - удаляем если нет
  if (!flags.hasGasGeochemistry) {
    xml = removeParagraphByParaId(xml, PARA_IDS.gasGeochemistry);
  }

  // 7. Обработка слоёв грунта
  const layersData = params.layersData;
  if (layersData && layersData.layers.length > 0) {
    // Заменяем основной параграф про отбор проб
    xml = updateSoilSamplingMainParagraph(xml, layersData);

    // Удаляем старые слои и вставляем новые
    xml = replaceLayersParagraphs(xml, layersData.layers);
  }

  // 8. Эпидемиологическое загрязнение - заменяем количество площадок
  if (params.uniquePlatformCount > 0) {
    xml = updateEpidemiologicalPlatformCount(xml, params.uniquePlatformCount);
  }

  // 9. Глубина бурения
  if (layersData && layersData.maxDepth > 0) {
    xml = updateBoreholeDepth(xml, layersData.maxDepth);
  }

  // 10. Убираем выделение у всех обработанных параграфов
  xml = removeHighlightFromSection47(xml);

  return xml;
}

/**
 * Обновляет основной параграф про отбор проб (308E5161)
 */
function updateSoilSamplingMainParagraph(xml: string, layersData: Section47LayersData): string {
  const paraId = PARA_IDS.soilSamplingMain;

  // Формируем новый текст
  const platformCount = layersData.surfacePlatformCount || layersData.layers[0]?.count || 15;
  const boreholeCount = layersData.totalBoreholeCount || platformCount;
  const maxDepth = layersData.maxDepth || 5;

  const newText =
    `Определение участков отбора проб осуществляется на обследуемой территории с учетом функциональных зон, рельефа местности и литолого-геологического строения. ` +
    `Отбор проб ПГ для проведения лабораторных исследований и испытаний, указанных в п.4 настоящей Программы, осуществляется в поверхностном слое с ${platformCount} пробных площадок размером 5х5 м (площадью 25 кв.м) ` +
    `и послойно из ${boreholeCount} геоэкологических скважин до глубины ведения земляных работ в количестве:`;

  return replaceParagraphTextByParaIdPreserveRunProps(xml, paraId, newText);
}

/**
 * Заменяет параграфы со слоями на актуальные из поручения
 */
function replaceLayersParagraphs(xml: string, layers: SoilLayer[]): string {
  // Сначала удаляем все существующие слои
  for (const paraId of PARA_IDS.layers) {
    xml = removeParagraphByParaId(xml, paraId);
  }

  // Находим позицию после основного параграфа (308E5161) для вставки новых слоёв
  const mainParaPattern = new RegExp(
    `(<w:p\\b[^>]*w14:paraId="${PARA_IDS.soilSamplingMain}"[^>]*>[\\s\\S]*?</w:p>)`,
  );
  const mainMatch = xml.match(mainParaPattern);

  if (!mainMatch) {
    console.warn('[section-47] Не найден основной параграф для вставки слоёв');
    return xml;
  }

  // Генерируем XML для новых слоёв
  const layersXml = layers
    .map((layer, index) => {
      // Если есть номера площадок — добавляем их в скобках
      const platformsSuffix = layer.platformNumbers && layer.platformNumbers.length > 0
        ? ` (${layer.platformNumbers.join(',')})`
        : '';
      const layerText = `в слое ${formatDepth(layer.from)}-${formatDepth(layer.to)} м${platformsSuffix} – ${layer.count} шт.${index === layers.length - 1 ? '' : ';'}`;
      return generateLayerParagraphXml(layerText, index);
    })
    .join('');

  // Вставляем после основного параграфа
  xml = xml.replace(mainParaPattern, `$1${layersXml}`);

  return xml;
}

/**
 * Форматирует глубину (0.2 -> "0,2")
 */
function formatDepth(depth: number): string {
  return depth.toFixed(1).replace('.', ',');
}

/**
 * Генерирует XML для параграфа слоя
 */
function generateLayerParagraphXml(text: string, index: number): string {
  // Генерируем уникальный paraId (используем базовый + индекс)
  const baseId = parseInt('18870DCF', 16);
  const newId = (baseId + index + 100).toString(16).toUpperCase().padStart(8, '0');

  return `<w:p w14:paraId="${newId}"><w:pPr><w:jc w:val="both"/><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>${text}</w:t></w:r></w:p>`;
}

/**
 * Обновляет количество площадок в параграфе про эпидемиологическое загрязнение
 */
function updateEpidemiologicalPlatformCount(xml: string, count: number): string {
  const paraId = PARA_IDS.epidemiologicalSampling;

  const newText =
    `Отбор проб ПГ для проведения лабораторных исследований и испытаний для выявления эпидемиологического и паразитологического загрязнения окружающей среды осуществляется в поверхностном слое с ${count} пробных площадок размером 5х5 м (площадью 25 кв.м).`;

  return replaceParagraphTextByParaIdPreserveRunProps(xml, paraId, newText);
}

/**
 * Обновляет глубину бурения и условно добавляет текст про глубокие слои
 */
function updateBoreholeDepth(xml: string, maxDepth: number): string {
  const paraId = PARA_IDS.boreholeDepth;

  // Базовый текст с заменой "Глубина" на реальное значение
  let newText = `Бурение геоэкологических скважин и отбор образцов грунта на глубину до ${formatDepth(maxDepth)} м осуществляется исполнителем с помощью ручного бура.`;

  // Добавляем текст про глубокие слои только если глубина > 5м
  if (maxDepth > 5) {
    newText += ` Отбор образцов грунта с глубин 5,0-${formatDepth(maxDepth)} м осуществляется из геологических скважин, выполненных Заказчиком.`;
  }

  return replaceParagraphTextByParaIdPreserveRunProps(xml, paraId, newText);
}

/**
 * Убирает выделение (highlight) у всех параграфов секции 4.7
 */
function removeHighlightFromSection47(xml: string): string {
  const allParaIds = [
    PARA_IDS.ppr,
    PARA_IDS.buildingSurveyHeader,
    PARA_IDS.buildingSurveyGammaScan,
    PARA_IDS.buildingSurveyMAED,
    PARA_IDS.buildingSurveyEROA,
    PARA_IDS.soilSamplingMain,
    ...PARA_IDS.layers,
    PARA_IDS.epidemiologicalSampling,
    PARA_IDS.boreholeDepth,
    PARA_IDS.surfaceWater,
    PARA_IDS.sediment,
    PARA_IDS.groundwater,
    PARA_IDS.gasGeochemistry,
  ];

  for (const paraId of allParaIds) {
    const paraPattern = new RegExp(
      `(<w:p\\b[^>]*w14:paraId="${paraId}"[^>]*>[\\s\\S]*?</w:p>)`,
      'g',
    );

    xml = xml.replace(paraPattern, (match) => {
      let cleaned = match;
      // Убираем highlight
      cleaned = cleaned.replace(/<w:highlight[^/]*\/>/g, '');
      cleaned = cleaned.replace(/<w:highlight[^>]*>[\s\S]*?<\/w:highlight>/g, '');
      // Меняем цвет на черный
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
