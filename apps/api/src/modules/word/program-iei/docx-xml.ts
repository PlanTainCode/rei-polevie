export function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function removeParagraphByParaId(xml: string, paraId: string): string {
  return String(xml).replace(
    new RegExp(`<w:p[^>]*w14:paraId="${paraId}"[^>]*>[\\s\\S]*?<\\/w:p>`, 'g'),
    '',
  );
}

/**
 * Заменяет текст параграфа по w14:paraId, сохраняя <w:pPr> и rPr (шрифт/размер) из run.
 * Вставляемый текст принудительно красим в чёрный.
 */
export function replaceParagraphTextByParaId(xml: string, paraId: string, newText: string): string {
  const escaped = escapeXml(newText);
  const re = new RegExp(
    `(<w:p[^>]*w14:paraId="${paraId}"[^>]*>)([\\s\\S]*?)(<\\/w:p>)`,
    'g',
  );

  // Стандартный rPr если в параграфе нет своего
  const defaultRPr = '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="000000"/></w:rPr>';

  return String(xml).replace(re, (_m, open, body, close) => {
    const bodyStr = String(body);
    const pPrMatch = bodyStr.match(/<w:pPr[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : '';

    // Ищем rPr ТОЛЬКО внутри <w:r> (не в pPr!) - берём первый run
    const runMatch = bodyStr.match(/<w:r>[\s\S]*?<\/w:r>/);
    let rPr = defaultRPr;
    if (runMatch) {
      const runRprMatch = runMatch[0].match(/<w:rPr[\s\S]*?<\/w:rPr>/);
      if (runRprMatch) {
        rPr = runRprMatch[0];
      }
    }

    // Чистим highlight/shd и принудительно ставим чёрный цвет
    rPr = rPr
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

    return `${open}${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escaped}</w:t></w:r>${close}`;
  });
}

/**
 * Для таблиц/ячееек: заменяет текст параграфа, сохраняя rPr (шрифт/размер/курсив) из run,
 * и принудительно приводит цвет к чёрному, убирая highlight/shd внутри rPr.
 */
export function replaceParagraphTextByParaIdPreserveRunProps(
  xml: string,
  paraId: string,
  newText: string,
): string {
  const escaped = escapeXml(newText);
  const re = new RegExp(
    `(<w:p[^>]*w14:paraId="${paraId}"[^>]*>)([\\s\\S]*?)(<\\/w:p>)`,
    'g',
  );

  // Стандартный rPr если в параграфе нет своего
  const defaultRPr = '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="000000"/></w:rPr>';

  return String(xml).replace(re, (_m, open, body, close) => {
    const bodyStr = String(body);
    const pPrMatch = bodyStr.match(/<w:pPr[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : '';

    // Ищем rPr ТОЛЬКО внутри <w:r> (не в pPr!) - берём первый run
    const runMatch = bodyStr.match(/<w:r>[\s\S]*?<\/w:r>/);
    let rPr = defaultRPr;
    if (runMatch) {
      const runRprMatch = runMatch[0].match(/<w:rPr[\s\S]*?<\/w:rPr>/);
      if (runRprMatch) {
        rPr = runRprMatch[0];
      }
    }

    // чистим подсветки/заливку и принудительно ставим чёрный цвет
    rPr = rPr
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

    return `${open}${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escaped}</w:t></w:r>${close}`;
  });
}

export function removeTableRowByTrParaId(xml: string, trParaId: string): string {
  return String(xml).replace(
    new RegExp(`<w:tr[^>]*w14:paraId="${trParaId}"[^>]*>[\\s\\S]*?<\\/w:tr>`, 'g'),
    '',
  );
}

/**
 * Глобальная нормализация стилей документа:
 * - Убирает все подсветки (highlight)
 * - Убирает заливку текста (shd в rPr)
 * - Убирает заливку ячеек таблиц (shd в tcPr) - меняем на "clear"
 * - Убирает фоновый цвет параграфов (shd в pPr)
 * - Меняет все цвета текста на чёрный (000000)
 */
export function normalizeDocumentStyles(xml: string): string {
  let result = xml;

  // 1. Убираем все highlight (подсветка текста)
  result = result.replace(/<w:highlight[^/]*\/>/g, '');
  result = result.replace(/<w:highlight[^>]*>[\s\S]*?<\/w:highlight>/g, '');

  // 2. Убираем заливку текста (shd внутри rPr)
  result = result.replace(/(<w:rPr[^>]*>[\s\S]*?)(<w:shd[^/]*\/>)([\s\S]*?<\/w:rPr>)/g, '$1$3');
  result = result.replace(/(<w:rPr[^>]*>[\s\S]*?)(<w:shd[^>]*>[\s\S]*?<\/w:shd>)([\s\S]*?<\/w:rPr>)/g, '$1$3');

  // 3. Убираем заливку ячеек таблиц (shd внутри tcPr) - меняем на прозрачную
  // Заменяем цветную заливку на "clear" (прозрачная)
  result = result.replace(
    /<w:shd w:val="(solid|clear)" w:color="[0-9A-Fa-f]+" w:fill="[0-9A-Fa-f]+"\/>/g,
    '<w:shd w:val="clear" w:color="auto" w:fill="auto"/>',
  );
  // Заменяем другие варианты заливки ячеек
  result = result.replace(
    /<w:shd w:val="[^"]*" w:fill="(?!auto)[0-9A-Fa-f]+"\/>/g,
    '<w:shd w:val="clear" w:color="auto" w:fill="auto"/>',
  );
  
  // 4. Убираем фоновый цвет параграфов (shd внутри pPr)
  result = result.replace(/(<w:pPr[^>]*>[\s\S]*?)(<w:shd[^/]*\/>)([\s\S]*?<\/w:pPr>)/g, '$1$3');
  result = result.replace(/(<w:pPr[^>]*>[\s\S]*?)(<w:shd[^>]*>[\s\S]*?<\/w:shd>)([\s\S]*?<\/w:pPr>)/g, '$1$3');

  // 5. Меняем все цвета текста на чёрный (кроме автоматического и уже чёрного)
  // Массив цветов для замены (наиболее часто встречающиеся в шаблонах)
  const colorPatterns = [
    'FF0000', 'ff0000', // красный
    '00FF00', '00ff00', // зеленый
    '0000FF', '0000ff', // синий
    '7030A0', '7030a0', // фиолетовый
    '00B0F0', '00b0f0', // голубой
    'FFC000', 'ffc000', // оранжевый
    'FFFF00', 'ffff00', // желтый
    'C00000', 'c00000', // темно-красный
    '00B050', '00b050', // темно-зеленый
    '0070C0', '0070c0', // темно-синий
    '808080', // серый
    '404040', // темно-серый
    'A6A6A6', 'a6a6a6', // светло-серый
    'BFBFBF', 'bfbfbf', // светло-серый 2
    'D9D9D9', 'd9d9d9', // очень светлый серый
    'F2F2F2', 'f2f2f2', // почти белый
    '92D050', '92d050', // светло-зеленый
    'ED7D31', 'ed7d31', // оранжевый Office
    '4472C4', '4472c4', // синий Office
    '70AD47', '70ad47', // зеленый Office
    '5B9BD5', '5b9bd5', // голубой Office
    'FFC000', 'ffc000', // желтый Office
    'A5A5A5', 'a5a5a5', // серый Office
    '44546A', '44546a', // темно-синий Office
    'E7E6E6', 'e7e6e6', // очень светлый серый Office
    'AEAAAA', 'aeaaaa', // серый текст
  ];

  for (const color of colorPatterns) {
    result = result.replace(
      new RegExp(`<w:color w:val="${color}"\\s*/>`, 'gi'),
      '<w:color w:val="000000"/>',
    );
    result = result.replace(
      new RegExp(`<w:color w:val="${color}"[^>]*>`, 'gi'),
      '<w:color w:val="000000"/>',
    );
  }

  // 6. Универсальная замена всех нечёрных цветов текста (кроме auto и 000000)
  // Это запасной механизм для цветов, не вошедших в список выше
  result = result.replace(
    /<w:color w:val="(?!000000|auto)[0-9A-Fa-f]{6}"\s*\/>/gi,
    '<w:color w:val="000000"/>',
  );

  return result;
}

/**
 * Генерирует XML параграфа со стандартным оформлением (Times New Roman 12pt, чёрный).
 * @param text - текст параграфа
 * @param options - опции форматирования
 */
export function generateStyledParagraph(
  text: string,
  options: {
    bold?: boolean;
    italic?: boolean;
    justify?: boolean;
    indent?: number;
    paraId?: string;
  } = {},
): string {
  const escaped = escapeXml(text);
  const { bold, italic, justify = true, indent, paraId } = options;

  // Формируем pPr
  let pPr = '<w:pPr>';
  if (justify) {
    pPr += '<w:jc w:val="both"/>';
  }
  if (indent) {
    pPr += `<w:ind w:firstLine="${indent}"/>`;
  }
  pPr += '</w:pPr>';

  // Формируем rPr
  let rPr = '<w:rPr>';
  rPr += '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>';
  rPr += '<w:sz w:val="24"/><w:szCs w:val="24"/>';
  rPr += '<w:color w:val="000000"/>';
  if (bold) rPr += '<w:b/><w:bCs/>';
  if (italic) rPr += '<w:i/><w:iCs/>';
  rPr += '</w:rPr>';

  // paraId (если задан)
  const paraIdAttr = paraId ? ` w14:paraId="${paraId}"` : '';

  return `<w:p${paraIdAttr}>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
}

