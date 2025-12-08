import * as mammoth from 'mammoth';
import { readFileSync } from 'fs';
import { join } from 'path';

async function analyzeOrderFile(filePath: string) {
  console.log(`\n📄 Анализ файла: ${filePath}`);
  console.log('='.repeat(100));
  
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;
    
    // Ищем таблицу отбора проб
    console.log('\n🔍 Ищем "Отбор проб":');
    
    const lines = text.split('\n');
    let inSamplingSection = false;
    let lineCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.toLowerCase().includes('отбор проб') || line.toLowerCase().includes('в слое')) {
        inSamplingSection = true;
        lineCount = 0;
      }
      
      if (inSamplingSection && line) {
        console.log(`${i + 1}: ${line}`);
        lineCount++;
        
        if (lineCount > 30) {
          console.log('...');
          break;
        }
      }
      
      if (inSamplingSection && line.includes('Итого') && lineCount > 5) {
        console.log('\n--- Конец секции ---');
        break;
      }
    }
    
    // Поиск микробиологии
    console.log('\n🦠 Ищем микробиологию:');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.toLowerCase().includes('микробиолог') || line.toLowerCase().includes('мб')) {
        console.log(`${i + 1}: ${line}`);
      }
    }
    
    // Поиск заказчика
    console.log('\n👤 Ищем заказчика:');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.toLowerCase().includes('заказчик') || line.toLowerCase().includes('исполнител')) {
        console.log(`${i + 1}: ${line}`);
      }
    }
    
    // Весь текст (первые 5000 символов)
    console.log('\n📝 ПОЛНЫЙ ТЕКСТ (фрагмент):');
    console.log(text.substring(0, 5000));
    
  } catch (err) {
    console.error('Ошибка:', err);
  }
}

async function main() {
  const files = [
    join(__dirname, '../uploads/4b7c297c-0193-4e7f-9875-ba1245e1adc8.docx'),
    join(__dirname, '../uploads/747b52ea-bc52-4832-945d-774ba945f798.docx'),
  ];
  
  for (const file of files) {
    await analyzeOrderFile(file);
  }
}

main();

