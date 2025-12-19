import { readFile } from 'fs/promises';
import { join } from 'path';
import PizZip from 'pizzip';

async function analyzeDocx() {
  const templatePath = join(process.cwd(), 'templates/тз/Задание ИИ_шаблон.docx');
  
  const buffer = await readFile(templatePath);
  const zip = new PizZip(buffer);
  
  const documentXml = zip.file('word/document.xml');
  if (!documentXml) {
    console.log('document.xml not found');
    return;
  }
  
  const content = documentXml.asText();
  
  // Ищем все <w:t> элементы и их содержимое
  const textMatches = content.match(/<w:t[^>]*>[^<]+<\/w:t>/g) || [];
  
  console.log('=== Все текстовые элементы (первые 200) ===\n');
  
  const texts = textMatches.map(t => t.replace(/<[^>]+>/g, '')).filter(t => t.trim().length > 2);
  const unique = [...new Set(texts)];
  
  unique.slice(0, 200).forEach((t, i) => {
    console.log(`[${i}] "${t}"`);
  });
  
  // Ищем конкретные тексты
  console.log('\n\n=== Проверка конкретных текстов ===\n');
  
  const searchTexts = [
    'ГОРСВЯЗЬСТРОЙ',
    'Реконструкция',
    'сетей связи',
    'Москва',
    'Бордуков',
    'gorsviaz',
    '+74997133710',
  ];
  
  for (const search of searchTexts) {
    const found = content.includes(search);
    console.log(`"${search}" найден: ${found}`);
    
    if (found) {
      // Показываем контекст
      const idx = content.indexOf(search);
      const context = content.substring(Math.max(0, idx - 50), Math.min(content.length, idx + search.length + 50));
      console.log(`  Контекст: ...${context.replace(/</g, '\n<').substring(0, 300)}...`);
    }
  }
}

analyzeDocx().catch(console.error);
