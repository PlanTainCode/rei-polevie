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
 * Заменяет текст параграфа по w14:paraId, сохраняя <w:pPr>.
 * Вставляемый текст принудительно красим в чёрный.
 */
export function replaceParagraphTextByParaId(xml: string, paraId: string, newText: string): string {
  const escaped = escapeXml(newText);
  const re = new RegExp(
    `(<w:p[^>]*w14:paraId="${paraId}"[^>]*>)([\\s\\S]*?)(<\\/w:p>)`,
    'g',
  );

  return String(xml).replace(re, (_m, open, body, close) => {
    const pPrMatch = String(body).match(/<w:pPr[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : '';
    return `${open}${pPr}<w:r><w:rPr><w:color w:val="000000"/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r>${close}`;
  });
}

/**
 * Для таблиц/ячееек: заменяет текст параграфа, сохраняя rPr (шрифт/размер/курсив),
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

  return String(xml).replace(re, (_m, open, body, close) => {
    const bodyStr = String(body);
    const pPrMatch = bodyStr.match(/<w:pPr[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : '';

    // Берём первый rPr внутри параграфа (если есть) — так сохраняем шрифт/размер/курсив.
    const rPrMatch = bodyStr.match(/<w:rPr[\s\S]*?<\/w:rPr>/);
    let rPr = rPrMatch ? rPrMatch[0] : '<w:rPr></w:rPr>';

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
