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

/**
 * Для значений таблицы 4.2: заменяет текст с принудительным курсивом
 */
export function replaceParagraphTextByParaIdWithItalic(
  xml: string,
  paraId: string,
  newText: string,
): string {
  const escaped = escapeXml(newText);
  const re = new RegExp(
    `(<w:p[^>]*w14:paraId="${paraId}"[^>]*>)([\\s\\S]*?)(<\\/w:p>)`,
    'g',
  );

  // rPr с курсивом, 11pt для колонки количества
  const italicRPr = '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:i/><w:iCs/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="000000"/></w:rPr>';

  return String(xml).replace(re, (_m, open, body, close) => {
    const bodyStr = String(body);
    const pPrMatch = bodyStr.match(/<w:pPr[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : '';

    return `${open}${pPr}<w:r>${italicRPr}<w:t xml:space="preserve">${escaped}</w:t></w:r>${close}`;
  });
}

export function removeTableRowByTrParaId(xml: string, trParaId: string): string {
  return String(xml).replace(
    new RegExp(`<w:tr[^>]*w14:paraId="${trParaId}"[^>]*>[\\s\\S]*?<\\/w:tr>`, 'g'),
    '',
  );
}

/**
 * Вставляет новую строку таблицы после строки с указанным trParaId,
 * копируя структуру следующей строки (чтобы сохранить стили)
 * @param xml - XML документа
 * @param afterTrParaId - paraId строки, после которой вставлять
 * @param rowNumber - номер строки (ячейка 1)
 * @param title - название работы (ячейка 2)
 * @param unit - единица измерения (ячейка 3)
 * @param quantity - количество (ячейка 4), курсивом
 */
export function insertTableRowAfterTrParaId(
  xml: string,
  afterTrParaId: string,
  rowNumber: string,
  title: string,
  unit: string,
  quantity: string,
): string {
  // paraId находится на <w:p> внутри строки, а не на <w:tr>
  // Ищем позицию параграфа с нужным paraId
  const paraIdPattern = `w14:paraId="${afterTrParaId}"`;
  const paraIdPos = xml.indexOf(paraIdPattern);
  if (paraIdPos === -1) {
    console.log(`[insertTableRowAfterTrParaId] paraId ${afterTrParaId} не найден в XML`);
    return xml;
  }
  
  // Находим начало строки <w:tr> которая содержит этот параграф
  const trStartPos = xml.lastIndexOf('<w:tr', paraIdPos);
  if (trStartPos === -1) {
    console.log(`[insertTableRowAfterTrParaId] <w:tr> не найден перед paraId`);
    return xml;
  }
  
  // Находим конец этой строки </w:tr>
  const trEndPos = xml.indexOf('</w:tr>', paraIdPos);
  if (trEndPos === -1) {
    console.log(`[insertTableRowAfterTrParaId] </w:tr> не найден после paraId`);
    return xml;
  }
  
  const headerRowEnd = trEndPos + 7;
  
  // Находим следующую строку таблицы (она будет шаблоном для стилей)
  const restXml = xml.slice(headerRowEnd);
  const nextRowRe = /<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/;
  const nextRowMatch = restXml.match(nextRowRe);
  
  if (!nextRowMatch) {
    console.log(`[insertTableRowAfterTrParaId] Следующая строка таблицы не найдена`);
    return xml;
  }
  
  // Копируем структуру следующей строки
  let templateRow = nextRowMatch[0];
  
  // Убираем paraId из новой строки (чтобы не было дублей)
  templateRow = templateRow.replace(/w14:paraId="[^"]*"/g, '');
  templateRow = templateRow.replace(/w14:textId="[^"]*"/g, '');
  
  // Находим все ячейки
  const tcRe = /<w:tc\b[\s\S]*?<\/w:tc>/g;
  const cells = templateRow.match(tcRe) || [];
  
  if (cells.length < 4) {
    console.log(`[insertTableRowAfterTrParaId] В шаблоне менее 4 ячеек: ${cells.length}`);
    return xml;
  }
  
  // Функция для замены текста в ячейке
  const replaceCellText = (cellXml: string, newText: string, italic?: boolean): string => {
    // Очищаем все <w:t> и вставляем новый текст
    let result = cellXml.replace(/<w:t[^>]*>[^<]*<\/w:t>/g, '<w:t></w:t>');
    
    // Заменяем первый пустой <w:t> на текст
    const escapedText = escapeXml(newText);
    result = result.replace(/<w:t><\/w:t>/, `<w:t xml:space="preserve">${escapedText}</w:t>`);
    
    // Добавляем курсив если нужно
    if (italic && !result.includes('<w:i/>')) {
      result = result.replace(/<w:rPr>/, '<w:rPr><w:i/><w:iCs/>');
    }
    
    return result;
  };
  
  // Заменяем содержимое ячеек
  const newCells = [
    replaceCellText(cells[0]!, rowNumber),      // Номер
    replaceCellText(cells[1]!, title),          // Название
    replaceCellText(cells[2]!, unit),           // Единица
    replaceCellText(cells[3]!, quantity, true), // Количество (курсив)
  ];
  
  // Собираем новую строку
  let newRow = templateRow;
  for (let i = 0; i < 4; i++) {
    newRow = newRow.replace(cells[i]!, newCells[i]);
  }
  
  // Вставляем новую строку после header
  console.log(`[insertTableRowAfterTrParaId] Вставляем новую строку после позиции ${headerRowEnd}`);
  return xml.slice(0, headerRowEnd) + newRow + xml.slice(headerRowEnd);
}

/**
 * Находит строку таблицы по тексту и заменяет значение в последней (4-й) ячейке.
 * Используется для подстановки значений в существующие строки шаблона.
 */
export function replaceTableCellValueByRowText(
  xml: string,
  searchTextLower: string,
  newValue: string,
): string {
  // Ищем текст в XML
  const textPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match;
  let foundTextPos = -1;
  
  while ((match = textPattern.exec(xml)) !== null) {
    const text = match[1].toLowerCase().replace(/\s+/g, ' ').trim();
    if (text.includes(searchTextLower)) {
      foundTextPos = match.index;
      console.log(`[replaceTableCellValueByRowText] Найден текст "${searchTextLower}" на позиции ${foundTextPos}`);
      break;
    }
  }
  
  if (foundTextPos === -1) {
    console.log(`[replaceTableCellValueByRowText] Текст "${searchTextLower}" не найден`);
    return xml;
  }
  
  // Находим строку таблицы
  const trStartPos = xml.lastIndexOf('<w:tr', foundTextPos);
  const trEndPos = xml.indexOf('</w:tr>', foundTextPos);
  
  if (trStartPos === -1 || trEndPos === -1) {
    console.log(`[replaceTableCellValueByRowText] Строка таблицы не найдена`);
    return xml;
  }
  
  const rowXml = xml.slice(trStartPos, trEndPos + 7);
  
  // Находим все ячейки в строке
  const cells: { start: number; end: number; content: string }[] = [];
  let searchPos = 0;
  while (searchPos < rowXml.length) {
    const tcStart = rowXml.indexOf('<w:tc', searchPos);
    if (tcStart === -1) break;
    const tcEnd = rowXml.indexOf('</w:tc>', tcStart);
    if (tcEnd === -1) break;
    cells.push({
      start: tcStart,
      end: tcEnd + 7,
      content: rowXml.slice(tcStart, tcEnd + 7),
    });
    searchPos = tcEnd + 7;
  }
  
  console.log(`[replaceTableCellValueByRowText] Найдено ячеек: ${cells.length}`);
  
  if (cells.length < 4) {
    console.log(`[replaceTableCellValueByRowText] Менее 4 ячеек, пропускаем`);
    return xml;
  }
  
  // Заменяем значение в 4-й ячейке (индекс 3)
  const lastCell = cells[3];
  let newCellContent = lastCell.content;
  const escapedValue = escapeXml(newValue);
  
  // Проверяем есть ли <w:t> теги в ячейке
  const hasWt = /<w:t[^>]*>[^<]*<\/w:t>/.test(newCellContent);
  console.log(`[replaceTableCellValueByRowText] 4-я ячейка содержит <w:t>: ${hasWt}`);
  
  if (hasWt) {
    // Заменяем текст в первом <w:t> теге, остальные очищаем
    let replaced = false;
    newCellContent = newCellContent.replace(/<w:t[^>]*>[^<]*<\/w:t>/g, (m) => {
      if (!replaced) {
        replaced = true;
        return `<w:t xml:space="preserve">${escapedValue}</w:t>`;
      }
      return '<w:t></w:t>';
    });
  } else {
    // Нет <w:t> тегов — вставляем run с текстом перед </w:p> в ячейке
    const rPr = '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:i/><w:iCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>';
    const newRun = `<w:r>${rPr}<w:t xml:space="preserve">${escapedValue}</w:t></w:r>`;
    // Вставляем перед последним </w:p> в ячейке
    const lastPClose = newCellContent.lastIndexOf('</w:p>');
    if (lastPClose !== -1) {
      newCellContent = newCellContent.slice(0, lastPClose) + newRun + newCellContent.slice(lastPClose);
    }
  }
  
  // Собираем новую строку
  const newRowXml = rowXml.slice(0, lastCell.start) + newCellContent + rowXml.slice(lastCell.end);
  
  console.log(`[replaceTableCellValueByRowText] Значение "${newValue}" подставлено`);
  
  return xml.slice(0, trStartPos) + newRowXml + xml.slice(trEndPos + 7);
}

/**
 * Вставляет строку таблицы ПЕРЕД строкой содержащей указанный текст.
 * Копирует найденную строку как шаблон, меняет содержимое ячеек.
 * После вставки сдвигает нумерацию в исходной строке на +1.
 */
export function insertTableRowBeforeByText(
  xml: string,
  searchTextLower: string,
  rowNumber: string,
  title: string,
  unit: string,
  quantity: string,
): string {
  // Извлекаем все тексты из <w:t> тегов с их позициями
  const textPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match;
  let foundTextPos = -1;
  
  while ((match = textPattern.exec(xml)) !== null) {
    const text = match[1].toLowerCase().replace(/\s+/g, ' ').trim();
    if (text.includes(searchTextLower)) {
      foundTextPos = match.index;
      console.log(`[insertTableRowBeforeByText] Найден текст "${searchTextLower}" на позиции ${foundTextPos}`);
      break;
    }
  }
  
  if (foundTextPos === -1) {
    console.log(`[insertTableRowBeforeByText] Текст "${searchTextLower}" не найден в XML`);
    return xml;
  }
  
  // Находим начало строки <w:tr> которая содержит этот текст
  const trStartPos = xml.lastIndexOf('<w:tr', foundTextPos);
  if (trStartPos === -1) {
    console.log(`[insertTableRowBeforeByText] <w:tr> не найден перед текстом`);
    return xml;
  }
  
  // Находим конец этой строки </w:tr>
  const trEndPos = xml.indexOf('</w:tr>', foundTextPos);
  if (trEndPos === -1) {
    console.log(`[insertTableRowBeforeByText] </w:tr> не найден после текста`);
    return xml;
  }
  
  const trEndFull = trEndPos + 7; // 7 = '</w:tr>'.length
  
  // Копируем найденную строку как шаблон
  let templateRow = xml.slice(trStartPos, trEndFull);
  
  // Убираем paraId из новой строки (чтобы не было дублей)
  let newRow = templateRow.replace(/w14:paraId="[^"]*"/g, '');
  newRow = newRow.replace(/w14:textId="[^"]*"/g, '');
  
  // Находим все ячейки в шаблоне - простой подход: ищем все <w:tc>...</w:tc>
  // В Word таблицах ячейки НЕ вложены друг в друга, поэтому просто ищем пары
  const cells: string[] = [];
  let searchPos = 0;
  
  while (searchPos < newRow.length) {
    // Ищем открывающий тег - может быть <w:tc> или <w:tc ...>
    const tcStartTag = newRow.indexOf('<w:tc', searchPos);
    if (tcStartTag === -1) break;
    
    // Находим конец открывающего тега
    const tcStartEnd = newRow.indexOf('>', tcStartTag);
    if (tcStartEnd === -1) break;
    
    // Ищем закрывающий </w:tc>
    const tcCloseTag = newRow.indexOf('</w:tc>', tcStartEnd);
    if (tcCloseTag === -1) break;
    
    // Извлекаем ячейку целиком
    const cellContent = newRow.slice(tcStartTag, tcCloseTag + 7);
    cells.push(cellContent);
    
    searchPos = tcCloseTag + 7;
  }
  
  console.log(`[insertTableRowBeforeByText] Найдено ячеек: ${cells.length}`);
  
  if (cells.length < 4) {
    console.log(`[insertTableRowBeforeByText] В шаблоне менее 4 ячеек: ${cells.length}`);
    console.log(`[insertTableRowBeforeByText] Первые 500 символов строки: ${templateRow.substring(0, 500)}`);
    return xml;
  }
  
  // Функция для замены текста в ячейке
  const replaceCellText = (cellXml: string, newText: string): string => {
    // Заменяем содержимое всех <w:t> тегов
    const escapedText = escapeXml(newText);
    // Сначала очищаем все <w:t>
    let result = cellXml.replace(/<w:t[^>]*>[^<]*<\/w:t>/g, '<w:t></w:t>');
    // Заменяем первый пустой на текст
    result = result.replace(/<w:t><\/w:t>/, `<w:t xml:space="preserve">${escapedText}</w:t>`);
    return result;
  };
  
  // Заменяем содержимое ячеек в новой строке
  const newCells = [
    replaceCellText(cells[0]!, rowNumber),
    replaceCellText(cells[1]!, title),
    replaceCellText(cells[2]!, unit),
    replaceCellText(cells[3]!, quantity),
  ];
  
  // Собираем новую строку
  for (let i = 0; i < 4; i++) {
    newRow = newRow.replace(cells[i]!, newCells[i]);
  }
  
  // Теперь нужно сдвинуть номер в оригинальной строке на +1
  // Находим первую ячейку (номер) в оригинальной строке и меняем 1 на 2
  let originalRow = templateRow;
  // Используем ту же логику поиска ячеек для оригинальной строки
  const origCells: string[] = [];
  let origSearchPos = 0;
  while (origSearchPos < originalRow.length) {
    const tcStartTag = originalRow.indexOf('<w:tc', origSearchPos);
    if (tcStartTag === -1) break;
    const tcStartEnd = originalRow.indexOf('>', tcStartTag);
    if (tcStartEnd === -1) break;
    const tcCloseTag = originalRow.indexOf('</w:tc>', tcStartEnd);
    if (tcCloseTag === -1) break;
    origCells.push(originalRow.slice(tcStartTag, tcCloseTag + 7));
    origSearchPos = tcCloseTag + 7;
  }
  
  if (origCells.length >= 1 && origCells[0]) {
    // Ищем номер в первой ячейке
    const firstCell = origCells[0];
    const numberMatch = firstCell.match(/<w:t[^>]*>(\d+)<\/w:t>/);
    if (numberMatch && numberMatch[1]) {
      const oldNum = parseInt(numberMatch[1], 10);
      const newNum = oldNum + 1;
      const updatedFirstCell = firstCell.replace(
        /<w:t([^>]*)>\d+<\/w:t>/,
        `<w:t$1>${newNum}</w:t>`
      );
      originalRow = originalRow.replace(firstCell, updatedFirstCell);
    }
  }
  
  console.log(`[insertTableRowBeforeByText] Вставляем новую строку перед позицией ${trStartPos}`);
  
  // Вставляем: до trStartPos + новая строка + изменённая оригинальная строка + после trEndFull
  return xml.slice(0, trStartPos) + newRow + originalRow + xml.slice(trEndFull);
}

/**
 * Удаляет префикс из текста параграфа, сохраняя все стили
 */
export function removePrefixFromParagraph(xml: string, paraId: string, prefix: string): string {
  const paraPattern = new RegExp(
    `(<w:p\\b[^>]*w14:paraId="${paraId}"[^>]*>[\\s\\S]*?</w:p>)`,
  );

  return xml.replace(paraPattern, (match) => {
    let result = match;

    // Простой случай: префикс целиком в одном <w:t>
    result = result.replace(
      new RegExp(`(<w:t[^>]*>)${escapeRegexPattern(prefix)}`, 'g'),
      '$1',
    );

    // Также попробуем удалить если он в начале текста с xml:space
    result = result.replace(
      new RegExp(`(<w:t xml:space="preserve">)${escapeRegexPattern(prefix)}`, 'g'),
      '$1',
    );

    return result;
  });
}

/**
 * Экранирует спецсимволы для использования в RegExp
 */
function escapeRegexPattern(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Удаляет run (w:r) содержащий указанный маркер из параграфа.
 * Также удаляет следующий run если он содержит только пробел.
 * Сохраняет все остальные стили и runs (ведущие пробелы не трогаем — иначе слипание).
 */
export function removeMarkerRunFromParagraph(xml: string, paraId: string, marker: string): string {
  const paraPattern = new RegExp(
    `(<w:p\\b[^>]*w14:paraId="${paraId}"[^>]*>)([\\s\\S]*?)(</w:p>)`,
  );

  return xml.replace(paraPattern, (_match, open, body, close) => {
    let newBody = body;

    const markerEscaped = escapeRegexPattern(marker);
    const markerRunPattern = new RegExp(
      `<w:r(?:\\s[^>]*)?>[^]*?<w:t[^>]*>${markerEscaped}</w:t>[^]*?</w:r>`,
      'g',
    );
    newBody = newBody.replace(markerRunPattern, '');

    newBody = newBody.replace(
      /<w:r(?:\s[^>]*)?>[^]*?<w:t[^>]*>\s<\/w:t>[^]*?<\/w:r>/g,
      '',
    );

    return open + newBody + close;
  });
}

/** Нужен ли пробел между двумя соседними текстовыми фрагментами (run'ами). */
function needsSpaceBetweenTextParts(left: string, right: string): boolean {
  if (!left || !right) return false;
  const a = left[left.length - 1];
  const b = right[0];
  if (!a || !b) return false;
  if (/\s/.test(a) || /\s/.test(b)) return false;

  // буква/цифра + буква → пробел
  if (/[0-9А-Яа-яЁёA-Za-z]/.test(a) && /[А-Яа-яЁёA-Za-z]/.test(b)) {
    return true;
  }

  // после . : ; , ) » " перед буквой обычно нужен пробел
  if (/[.:;,)»"]/.test(a) && /[А-Яа-яЁёA-Za-z]/.test(b)) {
    // г.Москва / р.Москвы / п.10 — без пробела
    if (/[гГрРпПдДсСвВ]\.$/.test(left.slice(-2))) return false;
    // инициалы Т.С.
    if (/[А-ЯA-Z]\.$/.test(left.slice(-2)) && /^[А-ЯA-Z]\./.test(right)) return false;
    // десятичные 1.2
    if (/\d\.$/.test(left.slice(-2)) && /^\d/.test(right)) return false;
    return true;
  }

  return false;
}

function decodeXmlTextEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#xa0;/gi, '\u00a0')
    .replace(/&nbsp;/gi, '\u00a0');
}

function ensureWtPreserveSpace(openTag: string): string {
  if (/xml:space\s*=/.test(openTag)) return openTag;
  return openTag.replace(/^<w:t\b/, '<w:t xml:space="preserve"');
}

/**
 * Блок подписей в конце программы ИЭИ — всё после последней таблицы до sectPr
 * (Матвеева / Штефанова / Бурнацкая + пустые абзацы + сноска НРС).
 */
export function extractProgramIeiEndSignaturesBlock(xml: string): string | null {
  const lastTbl = xml.lastIndexOf('</w:tbl>');
  const sectPr = xml.lastIndexOf('<w:sectPr');
  if (lastTbl < 0 || sectPr < 0 || lastTbl >= sectPr) return null;
  return xml.slice(lastTbl + '</w:tbl>'.length, sectPr);
}

/** Возвращает блок подписей в конец документа как в шаблоне (после всех правок). */
export function restoreProgramIeiEndSignaturesBlock(
  xml: string,
  endBlock: string | null,
): string {
  if (!endBlock) return xml;
  const lastTbl = xml.lastIndexOf('</w:tbl>');
  const sectPr = xml.lastIndexOf('<w:sectPr');
  if (lastTbl < 0 || sectPr < 0 || lastTbl >= sectPr) return xml;
  return xml.slice(0, lastTbl + '</w:tbl>'.length) + endBlock + xml.slice(sectPr);
}

/**
 * Вставляет пропущенные пробелы между соседними <w:t> в параграфах,
 * где в шаблоне Word текст разбит на runs без пробела (слипание слов).
 */
export function fixMissingSpacesInDocxXml(xml: string): string {
  return xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (para) => {
    const re = /(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g;
    const parts: { open: string; text: string; close: string; start: number; end: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(para)) !== null) {
      parts.push({
        open: m[1],
        text: m[2],
        close: m[3],
        start: m.index,
        end: m.index + m[0].length,
      });
    }
    if (parts.length < 2) return para;

    const meaningful = parts
      .map((p, idx) => ({ ...p, idx }))
      .filter((p) => decodeXmlTextEntities(p.text).length > 0);

    const updates = new Map<number, { open: string; text: string }>();
    for (let i = 0; i < meaningful.length - 1; i++) {
      const left = meaningful[i];
      const right = meaningful[i + 1];
      const leftDecoded = decodeXmlTextEntities(left.text);
      const rightDecoded = decodeXmlTextEntities(right.text);
      if (!needsSpaceBetweenTextParts(leftDecoded, rightDecoded)) continue;
      updates.set(right.idx, {
        open: ensureWtPreserveSpace(right.open),
        text: escapeXml(' ' + rightDecoded),
      });
    }

    if (updates.size === 0) return para;

    let result = para;
    const idxs = [...updates.keys()].sort((a, b) => b - a);
    for (const idx of idxs) {
      const part = parts[idx];
      const upd = updates.get(idx)!;
      const replacement = `${upd.open}${upd.text}${part.close}`;
      result = result.slice(0, part.start) + replacement + result.slice(part.end);
    }
    return result;
  });
}

/**
 * Глобальная нормализация стилей документа:
 * - Убирает все подсветки (highlight)
 * - Убирает заливку текста (shd в rPr)
 * - Убирает заливку ячеек таблиц (shd в tcPr) - меняем на "clear"
 * - Убирает фоновый цвет параграфов (shd в pPr)
 * - Меняет все цвета текста на чёрный (000000)
 * - Убирает подчёркивания текста
 */
export function normalizeDocumentStyles(xml: string): string {
  let result = xml;

  // 0. ПРЯМАЯ замена синего цвета 0000FF и серого 999999 на чёрный (самый надёжный способ)
  result = result.replace(/w:val="0000FF"/gi, 'w:val="000000"');
  result = result.replace(/w:val="999999"/gi, 'w:val="000000"');

  // 0.1. Убираем стиль Hyperlink (синий подчёркнутый текст) — все варианты ID
  result = result.replace(/<w:rStyle w:val="ae"\/>/g, '');
  result = result.replace(/<w:rStyle w:val="24"\/>/g, '');
  result = result.replace(/<w:rStyle w:val="Hyperlink"\/>/gi, '');

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

  // 6.1. Убираем themeColor (синие цвета часто заданы через тему)
  result = result.replace(/<w:color[^>]*w:themeColor="[^"]*"[^>]*\/>/g, '<w:color w:val="000000"/>');
  result = result.replace(/w:themeColor="[^"]*"/g, '');
  result = result.replace(/w:themeTint="[^"]*"/g, '');
  result = result.replace(/w:themeShade="[^"]*"/g, '');

  // 7. Подчёркивания НЕ удаляем — они используются осмысленно (п.1.3, колонтитулы и т.д.).
  // Подчёркивание HYPERLINK'ов убирается через удаление rStyle "24"/"ae"/"Hyperlink" (шаг 0.1)
  // и очистку стиля Hyperlink в styles.xml.

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

