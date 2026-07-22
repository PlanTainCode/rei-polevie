import { escapeXml, replaceParagraphTextByParaIdPreserveRunProps } from '../program-iei/docx-xml';

export interface ProgramIgiSection1FillData {
  objectName: string;
  objectLocation: string;
  clientNameLine: string;
  clientAddressLine: string;
  clientContactLines: string[];
  executorNameLine: string;
  executorAddressLine: string;
  goalsAndTasks: string | null; // null = не трогать (оставить геологический текст подрядчика)
  objectPurpose: string;
  transportInfrastructure: string;
  hazardousProduction: string;
  fireHazard: string;
  responsibilityLevel: string;
  permanentOccupancy: string;
  urbanPlanningActivity: string;
  surveyStage: string;
  technicalCharacteristics: string;
  excavationDepth: string;
  siteDescription: string;
  egrnLines: string[];
}

const SECTION1_START = 'Общие сведения';
const SECTION1_END = 'Изученность территории';

function paragraphPlainText(paragraphXml: string): string {
  return [...paragraphXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join('')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function fragmentPlainText(xml: string): string {
  return paragraphPlainText(xml);
}

/** Границы текста §1 (для проверок/целей). Нельзя вырезать этот диапазон из XML — он внутри большой таблицы. */
export function findSection1Bounds(xml: string): { start: number; end: number } | null {
  const startTextIdx = xml.indexOf(SECTION1_START);
  if (startTextIdx < 0) return null;
  const endTextIdx = xml.indexOf(SECTION1_END, startTextIdx + 10);
  if (endTextIdx < 0) return null;
  return { start: startTextIdx, end: endTextIdx };
}

export function extractGoalsTextFromSection1(xml: string): string {
  const bounds = findSection1Bounds(xml);
  if (!bounds) return '';
  const sectionXml = xml.slice(bounds.start, bounds.end);
  const paragraphs = [...sectionXml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].map((m) =>
    paragraphPlainText(m[0]),
  );
  const startIdx = paragraphs.findIndex((t) => t.includes('Цели и задачи инженерных изысканий'));
  if (startIdx < 0) return '';
  const endIdx = paragraphs.findIndex(
    (t, i) => i > startIdx && t.includes('Идентификационные сведения об объекте'),
  );
  const slice = paragraphs.slice(startIdx + 1, endIdx < 0 ? undefined : endIdx);
  return slice.filter(Boolean).join('\n');
}

export function hasGeologicalGoals(text: string): boolean {
  return /инженерно[- ]?геологическ/i.test(text || '');
}

/**
 * П.1.9.1 / 1.9.2 ИГИ: убираем фразы про демонтаж (начинаются с «демонтаж»).
 * Режет по переводам строк и точкам с запятой.
 */
export function omitDemolitionPhrases(text: string): string[] {
  const raw = String(text || '').trim();
  if (!raw) return [];

  const phrases = raw
    .split(/\n|;/)
    .map((p) => p.trim())
    .filter(Boolean);

  return phrases.filter((phrase) => {
    const normalized = phrase.replace(/^[-–—•*]\s*/, '').trim();
    return !/^демонтаж/i.test(normalized);
  });
}

function buildSimpleParagraph(text: string, templateParagraphXml?: string): string {
  const escaped = escapeXml(text);
  let pPr = '<w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr>';
  let rPr =
    '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="000000"/></w:rPr>';

  if (templateParagraphXml) {
    const pPrMatch = templateParagraphXml.match(/<w:pPr[\s\S]*?<\/w:pPr>/);
    if (pPrMatch) pPr = pPrMatch[0];
    const runMatch = templateParagraphXml.match(/<w:r[\s\S]*?<\/w:r>/);
    if (runMatch) {
      const rPrMatch = runMatch[0].match(/<w:rPr[\s\S]*?<\/w:rPr>/);
      if (rPrMatch) {
        rPr = rPrMatch[0]
          .replace(/<w:highlight[^/]*\/>/g, '')
          .replace(/<w:highlight[^>]*>[\s\S]*?<\/w:highlight>/g, '')
          .replace(/<w:shd[^/]*\/>/g, '')
          .replace(/<w:shd[^>]*>[\s\S]*?<\/w:shd>/g, '');
        if (rPr.includes('<w:color')) {
          rPr = rPr.replace(/<w:color[^/]*\/>/g, '<w:color w:val="000000"/>');
          rPr = rPr.replace(/<w:color[^>]*>[\s\S]*?<\/w:color>/g, '<w:color w:val="000000"/>');
        } else {
          rPr = rPr.replace('<w:rPr>', '<w:rPr><w:color w:val="000000"/>');
        }
      }
    }
  }

  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
}

function replaceParagraphXmlText(paragraphXml: string, newText: string): string {
  return buildSimpleParagraph(newText, paragraphXml).replace(
    /^<w:p>/,
    paragraphXml.match(/^<w:p\b[^>]*>/)?.[0] || '<w:p>',
  );
}

/**
 * В §1 подрядчика строки вида: [№] | [метка] | [значение].
 * Меняем ТОЛЬКО последнюю ячейку строки — без вырезания кусков таблицы.
 */
function replaceTableRowValueByLabel(
  xml: string,
  labelIncludes: string,
  values: string[],
  occurrence = 0,
): string {
  const cleanValues = values.map((v) => String(v || '').trim()).filter(Boolean);
  if (!cleanValues.length) return xml;

  const bounds = findSection1Bounds(xml);
  if (!bounds) return xml;

  const rowRe = /<w:tr\b[\s\S]*?<\/w:tr>/g;
  let match: RegExpExecArray | null;
  let found = -1;

  while ((match = rowRe.exec(xml)) !== null) {
    // Строка должна пересекаться с текстовой зоной §1
    if (match.index > bounds.end) break;
    if (match.index + match[0].length < bounds.start) continue;

    const rowXml = match[0];
    const cells = [...rowXml.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)];
    if (cells.length < 3) continue;

    const labelCellXml = cells[cells.length - 2][0];
    const labelText = fragmentPlainText(labelCellXml);
    if (!labelText.includes(labelIncludes)) continue;

    found += 1;
    if (found !== occurrence) continue;

    const valueCellMatch = cells[cells.length - 1];
    const valueCellXml = valueCellMatch[0];
    const tcPr = valueCellXml.match(/<w:tcPr[\s\S]*?<\/w:tcPr>/)?.[0] || '';
    const templatePara = valueCellXml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/)?.[0];
    const newParas = cleanValues.map((v) => buildSimpleParagraph(v, templatePara));
    const newValueCell = `<w:tc>${tcPr}${newParas.join('')}</w:tc>`;

    const valueAbs = match.index + (valueCellMatch.index || 0);
    return (
      xml.slice(0, valueAbs) +
      newValueCell +
      xml.slice(valueAbs + valueCellXml.length)
    );
  }

  return xml;
}

/**
 * На титуле подрядчика «Наименование объекта» и значение часто в соседних ячейках
 * одной строки таблицы; двоеточие может быть в отдельном <w:t>.
 */
export function replaceTitleObjectName(xml: string, objectName: string): string {
  const name = String(objectName || '').trim();
  if (!name) return xml;

  const s1 = xml.indexOf(SECTION1_START);
  const titleXml = s1 > 0 ? xml.slice(0, s1) : xml;

  const labelIdx = titleXml.indexOf('Наименование объекта');
  if (labelIdx < 0) return xml;

  const trStart = titleXml.lastIndexOf('<w:tr', labelIdx);
  if (trStart < 0) {
    let labelPStart = -1;
    {
      const head = titleXml.slice(0, labelIdx + 1);
      const re = /<w:p(?:\s|>)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(head)) !== null) labelPStart = m.index;
    }
    if (labelPStart < 0) return xml;
    const after = titleXml.slice(labelPStart);
    const paras = [...after.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)];
    for (let i = 1; i < paras.length; i++) {
      const text = paragraphPlainText(paras[i][0]);
      if (!text || text.includes('Программа составлена')) continue;
      const paraId = (paras[i][0].match(/w14:paraId="([^"]+)"/i) || [])[1];
      if (paraId) {
        return replaceParagraphTextByParaIdPreserveRunProps(xml, paraId, name);
      }
      const abs = labelPStart + (paras[i].index || 0);
      return (
        xml.slice(0, abs) +
        replaceParagraphXmlText(paras[i][0], name) +
        xml.slice(abs + paras[i][0].length)
      );
    }
    return xml;
  }

  const trEndRel = titleXml.indexOf('</w:tr>', trStart);
  if (trEndRel < 0) return xml;
  const trXml = titleXml.slice(trStart, trEndRel + '</w:tr>'.length);
  const cells = [...trXml.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map((m) => m[0]);
  if (cells.length < 2) return xml;

  const valueCell = cells[1];
  const valuePara = [...valueCell.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].find((m) => {
    const t = paragraphPlainText(m[0]);
    return t.length > 0 && !t.includes('Программа составлена');
  });
  if (!valuePara) return xml;

  const paraId = (valuePara[0].match(/w14:paraId="([^"]+)"/i) || [])[1];
  if (paraId) {
    return replaceParagraphTextByParaIdPreserveRunProps(xml, paraId, name);
  }

  const abs = titleXml.indexOf(valuePara[0], trStart);
  if (abs < 0) return xml;
  return (
    xml.slice(0, abs) +
    replaceParagraphXmlText(valuePara[0], name) +
    xml.slice(abs + valuePara[0].length)
  );
}

export function fillProgramIgiSection1(xml: string, data: ProgramIgiSection1FillData): string {
  if (!findSection1Bounds(xml)) {
    console.warn('[IGI] Не найдены границы §1 (Общие сведения → Изученность территории)');
    return xml;
  }

  let out = xml;
  const set = (label: string, values: string[], occurrence = 0) => {
    out = replaceTableRowValueByLabel(out, label, values, occurrence);
  };

  set('Наименование объекта', [data.objectName]);
  set('Местоположение объекта', [data.objectLocation]);
  set('Наименование и местонахождение заказчика', [
    data.clientNameLine,
    data.clientAddressLine,
  ].filter(Boolean));
  // Первое Ф.И.О. в §1 — контакт заказчика
  set('Ф.И.О., номер телефона', data.clientContactLines, 0);
  set('Наименование и местонахождение исполнителя', [
    data.executorNameLine,
    data.executorAddressLine,
  ].filter(Boolean));

  if (data.goalsAndTasks) {
    set('Цели и задачи инженерных изысканий', [data.goalsAndTasks]);
  }

  set('Назначение', [data.objectPurpose]);
  set('Принадлежность к объектам транспортной инфраструктуры', [
    data.transportInfrastructure,
  ]);
  set('Принадлежность к опасным производственным объектам', [data.hazardousProduction]);
  set('Пожарная и взрывопожарная опасность', [data.fireHazard]);
  set('Уровень ответственности зданий и сооружений', [data.responsibilityLevel]);
  set('Наличие помещений с постоянным нахождением людей', [data.permanentOccupancy]);
  set('Вид градостроительной деятельности', [data.urbanPlanningActivity]);
  set('Этап выполнения инженерных изысканий', [data.surveyStage]);

  if (data.technicalCharacteristics) {
    const lines = omitDemolitionPhrases(data.technicalCharacteristics);
    if (lines.length) {
      set('Краткая техническая характеристика объекта', lines);
    }
  }

  if (data.excavationDepth) {
    const depth = data.excavationDepth.replace(/^Глубина ведения земляных работ:\s*/i, '').trim();
    const depthLines = omitDemolitionPhrases(depth || data.excavationDepth);
    if (depthLines.length) {
      // Глубина обычно одной строкой с «;» между частями
      set('Глубина ведения земляных работ', [depthLines.join('; ')]);
    }
  }

  if (data.siteDescription) {
    const lines = data.siteDescription
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    set('Границы площадки', lines.length ? lines : [data.siteDescription]);
  }

  if (data.egrnLines.length) {
    const egrnLabel = out.includes('Общие сведения о категориях земель')
      ? 'Общие сведения о категориях земель'
      : 'Общие сведения о землепользовании';
    set(egrnLabel, data.egrnLines);
  }

  return out;
}

/** Находит paraId ячейки/абзаца после «Обзорная схема…» для вставки картинки. */
export function findOverviewImageTargetParaId(xml: string): string | null {
  const bounds = findSection1Bounds(xml);
  if (!bounds) return null;

  const rowRe = /<w:tr\b[\s\S]*?<\/w:tr>/g;
  let match: RegExpExecArray | null;
  while ((match = rowRe.exec(xml)) !== null) {
    if (match.index > bounds.end) break;
    if (match.index + match[0].length < bounds.start) continue;
    if (!fragmentPlainText(match[0]).includes('Обзорная схема размещения объекта')) continue;

    const cells = [...match[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)];
    const valueCell = cells.length >= 3 ? cells[cells.length - 1][0] : match[0];
    const para = valueCell.match(/<w:p\b[^>]*w14:paraId="([^"]+)"[^>]*>/);
    if (para?.[1]) return para[1];
    const anyPara = match[0].match(/w14:paraId="([^"]+)"/);
    return anyPara?.[1] || null;
  }
  return null;
}
