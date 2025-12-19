import { readFile } from 'fs/promises';
import { join } from 'path';
import PizZip from 'pizzip';

async function analyzeTemplate() {
  const templatePath = join(process.cwd(), 'templates/тз/Задание ИИ_шаблон.docx');
  
  const buffer = await readFile(templatePath);
  const zip = new PizZip(buffer);
  
  const documentXml = zip.file('word/document.xml');
  if (!documentXml) {
    console.log('document.xml not found');
    return;
  }
  
  const content = documentXml.asText();
  
  // Извлекаем все текстовые элементы
  const textMatches = content.match(/<w:t[^>]*>[^<]*<\/w:t>/g) || [];
  
  const texts = textMatches.map(t => t.replace(/<[^>]+>/g, '')).filter(t => t.trim().length > 0);
  
  console.log('=== ПОЛНЫЙ СПИСОК ТЕКСТОВ В ШАБЛОНЕ ===\n');
  
  texts.forEach((t, i) => {
    console.log(`[${i}] ${t}`);
  });
  
  console.log('\n\n=== ВСЕГО ЭЛЕМЕНТОВ: ' + texts.length + ' ===');
}

analyzeTemplate().catch(console.error);
