import type { ProgramIeiOrderFlags } from '../../ai/ai.service';
import { removeParagraphByParaId, replaceParagraphTextByParaIdPreserveRunProps } from './docx-xml';

// ParaId для пункта 7.1 (актуальный шаблон)
const PARA_IDS = {
  // 1. "Результатом ИЭИ является..." - убрать "для подготовки проектной документации"
  resultHeader: '0CFFD41E',

  // 2. «результаты инженерно-экологических работ…» — условно вода / акустика / физ. воздействия
  resultsWithPollution: '1C63D642',

  // Пункты нового списка (для снятия highlight)
  listItems: [
    '57A9FAF2', // введение
    '62C8DDD0', // инженерно-экологическая изученность территории
    '3C3E2CF1', // краткая характеристика природных и антропогенных условий
    '32694C80', // методика и технология выполнения работ
    '1C63D642', // результаты … (с загрязнениями)
    '2C3E1215', // санитарно-эпидемиологическое состояние
    '3EB30315', // зоны с особыми условиями
    '0599613F', // контроль качества и приемка
    '29FE6F9E', // заключение
    '684743EE', // использованные документы и материалы
    '5B6F3C28', // текстовые приложения
    '6EEA3DA8', // графическая часть
  ],

  // 3. Блок для полного удаления (второй «Технический отчет...» + все подпункты)
  blockToDelete: [
    '2199F848', // «Технический отчет...» в составе:
    '502E2747', // краткая характеристика природных и техногенных условий
    '79899415', // почвенно-растительные условия
    '73C68B14', // животный мир
    '297A2081', // хозяйственное использование территории
    '0088EACD', // социально-экономические условия
    '3E8BC1F7', // объекты культурного наследия
    '55D420EA', // современное экологическое состояние района изыскания
    '6154BF72', // определение класса опасности грунта
    '1875FE09', // особо охраняемые природные территории
    '4B5DBBA6', // предварительный прогноз
    '6575ED91', // анализ возможных непрогнозируемых последствий
    '650C2415', // предложения к программе экологического мониторинга
    '6C3BB37E', // текстовые приложения
    '2F2A648F', // графическая часть
  ],

  // 4. "Срок представления..." - убрать длинный текст после "Согласно Календарному плану выполнения работ"
  deadline: '22368CF2',
};

export function replaceProgramIeiSection71Block(params: {
  xml: string;
  orderFlags: ProgramIeiOrderFlags | null;
}): string {
  let xml = params.xml;

  const flags = params.orderFlags || {
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

  // 1. Заменяем заголовок на версию без "для подготовки проектной документации"
  const resultHeaderText =
    'Результатом ИЭИ является «Технический отчет по результатам инженерно-экологических изысканий» в составе:';
  xml = replaceParagraphTextByParaIdPreserveRunProps(xml, PARA_IDS.resultHeader, resultHeaderText);

  // 2. Условно формируем текст про загрязнения внутри пункта «результаты…»
  xml = updateResultsWithPollutionParagraph(xml, PARA_IDS.resultsWithPollution, flags);

  // 3. Удаляем устаревший второй блок «Технический отчет…»
  for (const paraId of PARA_IDS.blockToDelete) {
    xml = removeParagraphByParaId(xml, paraId);
  }

  // 4. Укорачиваем "Срок представления"
  const shortDeadline = 'Срок представления: Согласно Календарному плану выполнения работ';
  xml = replaceParagraphTextByParaIdPreserveRunProps(xml, PARA_IDS.deadline, shortDeadline);

  // 5. Убираем выделение
  xml = removeHighlightFromSection71(xml);

  return xml;
}

/**
 * Пункт списка «результаты инженерно-экологических работ и исследований (…)».
 * Правила условных вставок — те же, что были у старого пункта про загрязнения:
 * - поверхностные/подземные воды — только при воде;
 * - атмосферный воздух — всегда;
 * - акустика — только при отборе воздуха;
 * - вибрация/ЭМП — только при физ. воздействиях.
 */
export function buildResultsWithPollutionText(flags: ProgramIeiOrderFlags): string {
  const parts: string[] = [];

  parts.push(
    'результаты инженерно-экологических работ и исследований (в т.ч. радиационное, химическое, биологическое и другие виды загрязнений почв (грунтов)',
  );

  if (flags.hasWaterSampling || flags.hasSurfaceWater || flags.hasGroundwater) {
    parts.push(', поверхностных и подземных вод');
  }

  // Атмосферный воздух — всегда (данные из справки о фоновых концентрациях)
  parts.push(', атмосферного воздуха');

  if (flags.hasAirSampling) {
    parts.push('; акустическое загрязнение ОС');
  }

  if (flags.hasPhysicalImpacts) {
    parts.push(', оценка вибрации, измерение параметров электромагнитного поля');
  }

  parts.push(
    '; определение класса опасности грунта с применением Критерия (2) (биотестирование водной вытяжки с возможностью присвоения V класса опасности));',
  );

  return parts.join('');
}

function updateResultsWithPollutionParagraph(
  xml: string,
  paraId: string,
  flags: ProgramIeiOrderFlags,
): string {
  if (!xml.includes(`w14:paraId="${paraId}"`)) {
    console.warn(`[Section71] Не найден абзац результатов п.7.1 (${paraId})`);
    return xml;
  }
  return replaceParagraphTextByParaIdPreserveRunProps(
    xml,
    paraId,
    buildResultsWithPollutionText(flags),
  );
}

/**
 * Убирает выделение (highlight) у параграфов секции 7.1
 */
function removeHighlightFromSection71(xml: string): string {
  const allParaIds = [
    PARA_IDS.resultHeader,
    PARA_IDS.deadline,
    ...PARA_IDS.listItems,
    ...PARA_IDS.blockToDelete,
  ];

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
