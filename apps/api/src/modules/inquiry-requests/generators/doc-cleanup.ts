/**
 * Общие утилиты для очистки Word документов
 */

/**
 * Удаляет разрывы страниц из документа
 */
export function removePageBreaks(xml: string): string {
  xml = xml.replace(/<w:br w:type="page"\/>/g, '');
  xml = xml.replace(/<w:br w:type="page"><\/w:br>/g, '');
  return xml;
}

/**
 * Удаляет lastRenderedPageBreak (маркеры последней отрендеренной страницы)
 * Word иногда добавляет их и это создаёт лишние страницы
 */
export function removeLastRenderedPageBreaks(xml: string): string {
  xml = xml.replace(/<w:lastRenderedPageBreak\/>/g, '');
  xml = xml.replace(/<w:lastRenderedPageBreak><\/w:lastRenderedPageBreak>/g, '');
  return xml;
}

/**
 * Удаляет sectPr с type="nextPage" внутри параграфов (не в конце документа)
 * Это section breaks которые создают новые страницы
 */
export function removeSectionPageBreaks(xml: string): string {
  // Удаляем <w:type w:val="nextPage"/> внутри sectPr
  xml = xml.replace(/<w:type w:val="nextPage"\/>/g, '');
  return xml;
}

/**
 * Комплексная очистка документа от лишних пустых страниц
 */
export function cleanupDocument(xml: string): string {
  xml = removePageBreaks(xml);
  xml = removeLastRenderedPageBreaks(xml);
  xml = removeSectionPageBreaks(xml);
  return xml;
}
