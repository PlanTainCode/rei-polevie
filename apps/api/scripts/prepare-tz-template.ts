import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import * as PizZip from 'pizzip';
import * as Docxtemplater from 'docxtemplater';

async function prepareTemplate() {
  const templatePath = join(process.cwd(), 'templates/тз/Задание ИИ_шаблон.docx');
  
  try {
    const buffer = await readFile(templatePath);
    const zip = new PizZip(buffer);
    
    // Читаем document.xml для анализа структуры
    const docXml = zip.file('word/document.xml');
    if (docXml) {
      const content = docXml.asText();
      // Ищем все текстовые элементы
      const textMatches = content.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
      if (textMatches) {
        console.log('Found text elements:', textMatches.length);
        // Выводим уникальные тексты для анализа
        const uniqueTexts = [...new Set(textMatches.map(t => 
          t.replace(/<[^>]+>/g, '').substring(0, 80)
        ))].filter(t => t.trim());
        
        uniqueTexts.slice(0, 100).forEach(t => console.log('-', t));
      }
    }
    
    // Пробуем создать документ с docxtemplater
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
    });
    
    // Получаем теги из шаблона
    const tags = doc.getFullText();
    console.log('\n=== Full text length:', tags.length);
    console.log('\n=== Sample text (first 3000 chars) ===');
    console.log(tags.substring(0, 3000));
    
  } catch (err) {
    console.error('Error:', err);
  }
}

prepareTemplate();
