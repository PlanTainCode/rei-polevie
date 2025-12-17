import { removeParagraphByParaId, replaceParagraphTextByParaIdPreserveRunProps } from './docx-xml';

// ParaId для пункта 6.2
const PARA_IDS = {
  // "Не используются" - показываем когда нет техотчёта
  notUsed: '2BF2C306',
  // "Технический отчет по результатам ИЭИ..." - показываем когда есть техотчёт
  techReport: '6A5BCFEC',
};

export function replaceProgramIeiSection62Block(params: {
  xml: string;
  previousSurveyReport: string | null | undefined;
}): string {
  let xml = params.xml;

  const hasTechReport = Boolean(params.previousSurveyReport?.trim());

  if (hasTechReport) {
    // Есть техотчёт:
    // 1. Удаляем "Не используются"
    xml = removeParagraphByParaId(xml, PARA_IDS.notUsed);

    // 2. Заменяем текст техотчёта на актуальный из ТЗ
    const techReportText = params.previousSurveyReport!.trim();
    xml = replaceParagraphTextByParaIdPreserveRunProps(xml, PARA_IDS.techReport, techReportText);
  } else {
    // Нет техотчёта:
    // 1. Удаляем параграф с техотчётом
    xml = removeParagraphByParaId(xml, PARA_IDS.techReport);
    // 2. "Не используются" остаётся
  }

  // 3. Убираем выделение
  xml = removeHighlightFromSection62(xml);

  return xml;
}

/**
 * Убирает выделение (highlight) у параграфов секции 6.2
 */
function removeHighlightFromSection62(xml: string): string {
  const allParaIds = Object.values(PARA_IDS);

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
