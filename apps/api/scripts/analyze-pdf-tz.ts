import { readFile } from 'fs/promises';
import { join } from 'path';
import pdfParse from 'pdf-parse';

async function analyze() {
  const file = 'templates/тз/ТЗ Лужки, перекладка сетей_0001 [MruUGV].pdf';
  
  console.log(`\n========== ${file} ==========\n`);
  
  try {
    const buffer = await readFile(join(process.cwd(), file));
    const data = await pdfParse(buffer);
    console.log(data.text.substring(0, 4000));
    console.log('\n... [показано 4000 символов] ...\n');
  } catch (e) {
    console.log('Error:', e);
  }
}

analyze();
