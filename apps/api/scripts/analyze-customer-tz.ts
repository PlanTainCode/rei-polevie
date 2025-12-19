import { readFile } from 'fs/promises';
import { join } from 'path';
import * as mammoth from 'mammoth';

async function analyze() {
  const files = [
    'templates/тз/Задание ИЭИ_(Кокошкино_кабель).docx',
    'templates/тз/Задание ИЭИ_Горсвязьстрой_сети связи ПАО МГТС.docx',
  ];
  
  for (const file of files) {
    console.log(`\n\n=== ${file} ===\n`);
    
    try {
      const buffer = await readFile(join(process.cwd(), file));
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value;
      
      // Показываем первые 3000 символов
      console.log(text.substring(0, 3000));
      console.log('\n... [truncated] ...');
    } catch (e) {
      console.log('Error:', e);
    }
  }
}

analyze();
