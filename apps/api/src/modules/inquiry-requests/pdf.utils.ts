import { PDFDocument } from 'pdf-lib';
import ConvertApi from 'convertapi';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

// Инициализация ConvertAPI
const CONVERT_API_SECRET = process.env.CONVERT_API_SECRET || 'wadvohgfQJsERFh3BwYSArFXkHrrVDr9';
const convertApi = new ConvertApi(CONVERT_API_SECRET);

/**
 * Конвертирует Word документ (.docx) в PDF через ConvertAPI
 */
export async function convertDocxToPdf(docxPath: string): Promise<Buffer> {
  console.log(`[PDF] Начинаю конвертацию: ${docxPath}`);
  
  if (!CONVERT_API_SECRET) {
    throw new Error('CONVERT_API_SECRET не задан');
  }
  
  try {
    // Конвертируем через ConvertAPI
    console.log('[PDF] Отправляю запрос в ConvertAPI...');
    const result = await convertApi.convert('pdf', {
      File: docxPath,
    }, 'docx');

    console.log(`[PDF] Получен результат, файлов: ${result.files?.length}`);
    
    if (!result.files || !result.files[0]) {
      throw new Error('ConvertAPI не вернул файлы');
    }

    // Получаем URL результата и скачиваем
    const pdfFile = result.files[0];
    console.log(`[PDF] Скачиваю PDF: ${pdfFile.url}`);
    
    const response = await fetch(pdfFile.url);
    if (!response.ok) {
      throw new Error(`Ошибка скачивания PDF: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log(`[PDF] PDF скачан, размер: ${arrayBuffer.byteLength} байт`);
    
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('[PDF] Ошибка конвертации:', error);
    throw error;
  }
}

/**
 * Объединяет два PDF документа
 * Первый PDF - сгенерированный из Word (вертикальная ориентация)
 * Второй PDF - загруженный пользователем (альбомная ориентация)
 * 
 * @param maxGeneratedPages - максимальное количество страниц из сгенерированного PDF (по умолчанию 1)
 */
export async function mergePdfs(
  generatedPdfBuffer: Buffer,
  uploadedPdfBuffer: Buffer,
  maxGeneratedPages: number = 1,
): Promise<Buffer> {
  console.log('[PDF] Объединяю PDF файлы...');
  
  // Создаём новый PDF документ
  const mergedPdf = await PDFDocument.create();
  
  // Загружаем сгенерированный PDF (вертикальная ориентация)
  const generatedPdf = await PDFDocument.load(generatedPdfBuffer);
  const allPageIndices = generatedPdf.getPageIndices();
  
  // Берём только первые N страниц (по умолчанию 1)
  const pagesToCopy = allPageIndices.slice(0, maxGeneratedPages);
  console.log(`[PDF] Сгенерированный PDF: ${allPageIndices.length} стр., берём ${pagesToCopy.length}`);
  
  const generatedPages = await mergedPdf.copyPages(generatedPdf, pagesToCopy);
  
  // Добавляем страницы из сгенерированного PDF
  for (const page of generatedPages) {
    mergedPdf.addPage(page);
  }
  
  // Загружаем загруженный PDF (альбомная ориентация)
  const uploadedPdf = await PDFDocument.load(uploadedPdfBuffer);
  const uploadedPages = await mergedPdf.copyPages(
    uploadedPdf,
    uploadedPdf.getPageIndices(),
  );
  
  // Добавляем страницы из загруженного PDF
  // Ориентация страниц сохраняется автоматически
  for (const page of uploadedPages) {
    mergedPdf.addPage(page);
  }
  
  // Сохраняем объединённый PDF
  const mergedPdfBytes = await mergedPdf.save();
  
  console.log(`[PDF] PDF объединён, итоговый размер: ${mergedPdfBytes.byteLength} байт`);
  
  return Buffer.from(mergedPdfBytes);
}

/**
 * Полный процесс: конвертация Word в PDF и объединение с загруженным PDF
 */
export async function processInquiryWithPdf(
  docxPath: string,
  uploadedPdfBuffer: Buffer,
  outputDir: string,
  baseFileName: string,
): Promise<{ fileName: string; filePath: string; buffer: Buffer }> {
  console.log(`[PDF] Начинаю обработку: ${baseFileName}`);
  
  // 1. Конвертируем Word в PDF через ConvertAPI
  const generatedPdfBuffer = await convertDocxToPdf(docxPath);
  
  // 2. Объединяем PDF
  const mergedPdfBuffer = await mergePdfs(generatedPdfBuffer, uploadedPdfBuffer);
  
  // 3. Формируем имя файла (меняем расширение на .pdf)
  const pdfFileName = baseFileName.replace(/\.docx$/i, '.pdf');
  const pdfFilePath = join(outputDir, pdfFileName);
  
  // 4. Сохраняем результат
  await writeFile(pdfFilePath, mergedPdfBuffer);
  console.log(`[PDF] Файл сохранён: ${pdfFilePath}`);
  
  // 5. Удаляем промежуточный docx файл
  try {
    await unlink(docxPath);
  } catch {
    // Игнорируем ошибку удаления
  }
  
  return {
    fileName: pdfFileName,
    filePath: pdfFilePath,
    buffer: mergedPdfBuffer,
  };
}
