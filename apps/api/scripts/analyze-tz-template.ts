import * as mammoth from 'mammoth';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function analyzeTemplate() {
  const templatePath = join(process.cwd(), 'templates/тз/Задание ИИ_шаблон.docx');
  
  try {
    const buffer = await readFile(templatePath);
    
    // Извлекаем текст
    const textResult = await mammoth.extractRawText({ buffer });
    const rawText = textResult.value;
    
    // Извлекаем HTML для структуры
    const htmlResult = await mammoth.convertToHtml({ buffer });
    
    console.log('=== RAW TEXT ===\n');
    console.log(rawText);
    console.log('\n\n=== PARAGRAPHS ===\n');
    
    const paragraphs = rawText.split('\n').filter(p => p.trim());
    paragraphs.forEach((p, i) => {
      console.log(`[${i}] ${p.substring(0, 100)}${p.length > 100 ? '...' : ''}`);
    });
    
  } catch (err) {
    console.error('Error:', err);
  }
}

analyzeTemplate();
