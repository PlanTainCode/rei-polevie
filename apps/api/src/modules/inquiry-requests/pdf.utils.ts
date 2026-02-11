import { PDFDocument } from 'pdf-lib';
import { writeFile, readFile, unlink, mkdtemp, rm } from 'fs/promises';
import { join, basename } from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Кэш пути к LibreOffice (определяется один раз)
let cachedSofficePath: string | null = null;

/**
 * Находит исполняемый файл LibreOffice на системе
 */
async function findSoffice(): Promise<string> {
  const paths = [
    'soffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    '/usr/local/bin/soffice',
    '/usr/local/bin/libreoffice',
  ];

  for (const p of paths) {
    try {
      await execAsync(`"${p}" --version`, { timeout: 10000 });
      return p;
    } catch {
      continue;
    }
  }

  throw new Error(
    'LibreOffice не найден. Установите:\n' +
    '  macOS: brew install --cask libreoffice\n' +
    '  Linux: sudo apt install libreoffice',
  );
}

/**
 * Конвертирует Word документ (.docx) в PDF через LibreOffice (headless)
 */
export async function convertDocxToPdf(docxPath: string): Promise<Buffer> {
  console.log(`[PDF] Начинаю конвертацию: ${docxPath}`);

  if (!cachedSofficePath) {
    cachedSofficePath = await findSoffice();
    console.log(`[PDF] LibreOffice найден: ${cachedSofficePath}`);
  }

  // Временная директория для выходного файла и профиля LibreOffice
  const tmpDir = await mkdtemp(join(tmpdir(), 'docx-pdf-'));
  const profileDir = join(tmpDir, 'profile');

  try {
    // Конвертируем через LibreOffice headless
    // -env:UserInstallation — изолированный профиль, чтобы не конфликтовать с открытым LibreOffice
    const cmd =
      `"${cachedSofficePath}" --headless --convert-to pdf ` +
      `--outdir "${tmpDir}" ` +
      `-env:UserInstallation=file://${profileDir} ` +
      `"${docxPath}"`;

    console.log(`[PDF] Запускаю: ${cmd}`);
    await execAsync(cmd, { timeout: 120000 });

    // Читаем сконвертированный PDF
    const pdfFileName = basename(docxPath).replace(/\.docx$/i, '.pdf');
    const pdfPath = join(tmpDir, pdfFileName);
    const pdfBuffer = await readFile(pdfPath);

    console.log(`[PDF] PDF сконвертирован, размер: ${pdfBuffer.length} байт`);
    return pdfBuffer;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[PDF] Ошибка конвертации:', error);
    throw new Error(`Ошибка конвертации Word в PDF: ${message}`);
  } finally {
    // Удаляем временную директорию
    try {
      await rm(tmpDir, { recursive: true });
    } catch {
      /* ignore cleanup errors */
    }
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
  console.log(
    `[PDF] Сгенерированный PDF: ${allPageIndices.length} стр., берём ${pagesToCopy.length}`,
  );

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

  console.log(
    `[PDF] PDF объединён, итоговый размер: ${mergedPdfBytes.byteLength} байт`,
  );

  return Buffer.from(mergedPdfBytes);
}

/**
 * Конвертация Word в PDF без объединения с другим PDF.
 * Используется когда PDF-приложение не загружено.
 */
export async function processInquiryToPdfOnly(
  docxPath: string,
  outputDir: string,
  baseFileName: string,
): Promise<{ fileName: string; filePath: string; buffer: Buffer }> {
  console.log(`[PDF] Конвертация в PDF (без приложения): ${baseFileName}`);

  // 1. Конвертируем Word в PDF через LibreOffice
  const pdfBuffer = await convertDocxToPdf(docxPath);

  // 2. Формируем имя файла (меняем расширение на .pdf)
  const pdfFileName = baseFileName.replace(/\.docx$/i, '.pdf');
  const pdfFilePath = join(outputDir, pdfFileName);

  // 3. Сохраняем результат
  await writeFile(pdfFilePath, pdfBuffer);
  console.log(`[PDF] Файл сохранён: ${pdfFilePath}`);

  // 4. Удаляем промежуточный docx файл
  try {
    await unlink(docxPath);
  } catch {
    // Игнорируем ошибку удаления
  }

  return {
    fileName: pdfFileName,
    filePath: pdfFilePath,
    buffer: pdfBuffer,
  };
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

  // 1. Конвертируем Word в PDF через LibreOffice
  const generatedPdfBuffer = await convertDocxToPdf(docxPath);

  // 2. Объединяем PDF
  const mergedPdfBuffer = await mergePdfs(
    generatedPdfBuffer,
    uploadedPdfBuffer,
  );

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
