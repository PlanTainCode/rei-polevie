import { execFile } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { convertDocumentToPdf } from '../inquiry-requests/pdf.utils';
import sharp = require('sharp');

const execFileAsync = promisify(execFile);

/** Writer не применяет часть CSS к таблицам и max-width к изображениям из HTML. */
async function prepareHtmlForWriter(html: string): Promise<string> {
  html = html.replace(/<table\b([^>]*)>/g, (_, attrs: string) => `<table${attrs} width="100%" cellpadding="3">`);
  html = html.replace(/<(h[1-5])\b([^>]*)>/g, (_, tag: string, attrs: string) => `<${tag}${attrs} style="page-break-after: avoid;">`);
  html = html.replace(/<(td|th)\b([^>]*)>/g, (_, tag: string, attrs: string) => {
    const classes = attrs.match(/\bclass="([^"]*)"/)?.[1].split(/\s+/) ?? [];
    const existing = attrs.match(/\bstyle="([^"]*)"/)?.[1] ?? '';
    let style = 'border: 1px solid black; padding: 0.2em 0.4em;';
    if (classes.includes('not-border')) style = 'border: 0;';
    if (classes.includes('title')) style = 'border: 1px dashed black; text-align: center; padding: 1em;';
    if (classes.includes('borderdot')) style = 'border: 1px dashed black; padding: 0.2em 0.4em;';
    return `<${tag}${attrs.replace(/\s*style="[^"]*"/, '')} style="${style} ${existing}">`;
  });
  for (const match of html.matchAll(/<img\b[^>]*>/g)) {
    const src = match[0].match(/\bsrc="data:image\/[^;]+;base64,([^"]+)"/)?.[1];
    if (!src) continue;
    const { width, height } = await sharp(Buffer.from(src, 'base64')).metadata();
    if (!width || !height) throw new Error('Не удалось определить размер схемы границ');
    const scale = Math.min(168 / width, 210 / height);
    // Абсолютные размеры сохраняют пропорции и помещают всю схему в поля A4.
    html = html.replace(match[0], match[0].replace(/>$/, ` style="width: ${(width * scale).toFixed(2)}mm; height: ${(height * scale).toFixed(2)}mm;">`));
  }
  return html;
}

/** Применяем тот же XSL на сервере, без зависимости от XSLT в браузере. */
export async function renderTzHtml(xml: string, xslPath: string, outputDir: string): Promise<string> {
  const xmlPath = join(outputDir, 'task.xml');
  const htmlPath = join(outputDir, 'task.html');
  await writeFile(xmlPath, xml, 'utf8');
  await execFileAsync('xsltproc', ['--nonet', '--novalid', '--output', htmlPath, xslPath, xmlPath], { timeout: 30000 });
  const html = await prepareHtmlForWriter(await readFile(htmlPath, 'utf8'));
  await writeFile(htmlPath, html, 'utf8');
  return html;
}

export async function convertTzXmlToPdf(xml: string, xslPath: string): Promise<Buffer> {
  const outputDir = await mkdtemp(join(tmpdir(), 'tz-preview-'));
  try {
    await renderTzHtml(xml, xslPath, outputDir);
    return await convertDocumentToPdf(join(outputDir, 'task.html'));
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
}
