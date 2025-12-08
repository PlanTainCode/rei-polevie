import * as XLSX from 'xlsx';
import { join } from 'path';

const filePath = join(__dirname, '../templates/Задание ПБ2-шб.xlsx');
const workbook = XLSX.readFile(filePath);

const soilSheetName = 'Акт отбора проб Почва';
const sheet = workbook.Sheets[soilSheetName];

const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');

console.log('📝 СОДЕРЖИМОЕ ЛИСТА (строки 60-148):');
console.log('='.repeat(100));

for (let r = 60; r <= range.e.r; r++) {
  const rowData: string[] = [];
  let hasContent = false;
  
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cellRef = XLSX.utils.encode_cell({ r, c });
    const cell = sheet[cellRef];
    
    if (cell && cell.v !== undefined && cell.v !== '') {
      hasContent = true;
      const value = String(cell.v).replace(/\n/g, '↵').substring(0, 70);
      rowData.push(`${XLSX.utils.encode_col(c)}="${value}"`);
    }
  }
  
  if (hasContent) {
    console.log(`\nСтрока ${r + 1}:`);
    rowData.forEach(d => console.log(`   ${d}`));
  }
}

// Ширина колонок
if (sheet['!cols']) {
  console.log('\n\n📏 ШИРИНА КОЛОНОК:');
  sheet['!cols'].forEach((col: any, i: number) => {
    if (col && col.wch) {
      console.log(`   ${XLSX.utils.encode_col(i)}: ${col.wch}`);
    }
  });
}

// Высота строк
if (sheet['!rows']) {
  console.log('\n\n📐 ВЫСОТА СТРОК:');
  sheet['!rows'].forEach((row: any, i: number) => {
    if (row && row.hpt) {
      console.log(`   Строка ${i + 1}: ${row.hpt}pt`);
    }
  });
}

console.log('\n✅ Анализ завершён');

