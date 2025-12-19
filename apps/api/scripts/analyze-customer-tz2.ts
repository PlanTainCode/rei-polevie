import { readFile } from 'fs/promises';
import { join } from 'path';
import * as mammoth from 'mammoth';

async function analyze() {
  const files = [
    'templates/тз/ТЗ ИЭИ. Корпус 3 Синдика.docx',
    'templates/тз/Техническое_задание лос водоканал (1) (1).doc',
  ];
  
  for (const file of files) {
    console.log(`\n\n========== ${file} ==========\n`);
    
    try {
      const buffer = await readFile(join(process.cwd(), file));
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value;
      
      console.log(text.substring(0, 4000));
      console.log('\n... [показано 4000 символов] ...\n');
    } catch (e) {
      console.log('Error:', e);
    }
  }
}

analyze();
