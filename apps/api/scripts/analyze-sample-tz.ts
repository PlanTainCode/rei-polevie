import * as mammoth from 'mammoth';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function analyzeSample() {
  // Пробуем docx файл
  const samplePath = join(process.cwd(), 'templates/тз/ТЗ ИЭИ. Корпус 3 Синдика.docx');
  
  try {
    const buffer = await readFile(samplePath);
    const textResult = await mammoth.extractRawText({ buffer });
    const rawText = textResult.value;
    
    console.log('=== SAMPLE TZ (Синдика) ===\n');
    console.log(rawText.substring(0, 8000));
    console.log('\n... (truncated)');
    
  } catch (err) {
    console.error('Error:', err);
  }
}

analyzeSample();
