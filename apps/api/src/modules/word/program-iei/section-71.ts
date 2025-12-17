import type { ProgramIeiOrderFlags } from '../../ai/ai.service';
import { removeParagraphByParaId, replaceParagraphTextByParaIdPreserveRunProps } from './docx-xml';

// ParaId для пункта 7.1
const PARA_IDS = {
  // 1. "Результатом ИЭИ является..." - убрать "для подготовки проектной документации"
  resultHeader: '0CFFD41E',

  // 2. "радиационное, химическое, биологическое..." - условно убираем части
  pollutionTypes: '08623773',

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

  // 2. Условно формируем текст про загрязнения
  xml = updatePollutionTypesParagraph(xml, PARA_IDS.pollutionTypes, flags);

  // 3. Удаляем весь блок
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
 * Формирует и заменяет параграф с типами загрязнений в зависимости от флагов
 */
function updatePollutionTypesParagraph(
  xml: string,
  paraId: string,
  flags: ProgramIeiOrderFlags,
): string {
  // Базовые части текста
  const parts: string[] = [];

  // Всегда есть: "радиационное, химическое, биологическое и другие виды загрязнений почв (грунтов)"
  parts.push('радиационное, химическое, биологическое и другие виды загрязнений почв (грунтов)');

  // Добавляем ", поверхностных и подземных вод" только если есть вода
  if (flags.hasWaterSampling || flags.hasSurfaceWater || flags.hasGroundwater) {
    parts.push(', поверхностных и подземных вод');
  }

  // Добавляем ", атмосферного воздуха; акустическое загрязнение ОС" только если есть воздух
  if (flags.hasAirSampling) {
    parts.push(', атмосферного воздуха; акустическое загрязнение ОС');
  }

  // Добавляем ", оценка вибрации, измерение параметров электромагнитного поля" только если есть физ. воздействия
  if (flags.hasPhysicalImpacts) {
    parts.push(', оценка вибрации, измерение параметров электромагнитного поля');
  }

  // Собираем текст и добавляем точку с запятой в конце
  const fullText = parts.join('') + ';';

  return replaceParagraphTextByParaIdPreserveRunProps(xml, paraId, fullText);
}

/**
 * Убирает выделение (highlight) у параграфов секции 7.1
 */
function removeHighlightFromSection71(xml: string): string {
  const allParaIds = [
    PARA_IDS.resultHeader,
    PARA_IDS.pollutionTypes,
    PARA_IDS.deadline,
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
