import * as XLSX from 'xlsx';
import { join } from 'path';

const filePath = join(__dirname, '../templates/Задание ПБ2-шб.xlsx');

console.log('Анализ файла:', filePath);
console.log('='.repeat(80));

const workbook = XLSX.readFile(filePath);

console.log('\n📚 ЛИСТЫ В ФАЙЛЕ:');
console.log(workbook.SheetNames.join(', '));

// Анализируем только первый лист
const firstSheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[firstSheetName];

console.log(`\n📄 ПЕРВЫЙ ЛИСТ: "${firstSheetName}"`);
console.log('='.repeat(80));

// Получаем диапазон ячеек
const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
console.log(`\n📐 Диапазон: ${sheet['!ref']}`);
console.log(`   Строки: ${range.s.r + 1} - ${range.e.r + 1} (всего ${range.e.r - range.s.r + 1})`);
console.log(`   Столбцы: ${XLSX.utils.encode_col(range.s.c)} - ${XLSX.utils.encode_col(range.e.c)} (всего ${range.e.c - range.s.c + 1})`);

// Информация о объединённых ячейках
if (sheet['!merges']) {
  console.log(`\n🔗 ОБЪЕДИНЁННЫЕ ЯЧЕЙКИ (${sheet['!merges'].length}):`);
  sheet['!merges'].slice(0, 30).forEach((merge, i) => {
    const startCell = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
    const endCell = XLSX.utils.encode_cell({ r: merge.e.r, c: merge.e.c });
    const cellValue = sheet[startCell]?.v || '';
    console.log(`   ${i + 1}. ${startCell}:${endCell} = "${String(cellValue).substring(0, 50)}${String(cellValue).length > 50 ? '...' : ''}"`);
  });
  if (sheet['!merges'].length > 30) {
    console.log(`   ... и ещё ${sheet['!merges'].length - 30} объединений`);
  }
}

// Ширина столбцов
if (sheet['!cols']) {
  console.log('\n📏 ШИРИНА СТОЛБЦОВ:');
  sheet['!cols'].forEach((col, i) => {
    if (col && col.wch) {
      console.log(`   ${XLSX.utils.encode_col(i)}: ${col.wch}`);
    }
  });
}

// Выводим содержимое ячеек построчно
console.log('\n📝 СОДЕРЖИМОЕ ПЕРВОГО ЛИСТА (построчно):');
console.log('='.repeat(80));

for (let r = range.s.r; r <= Math.min(range.e.r, 100); r++) {
  const rowData: string[] = [];
  let hasContent = false;
  
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cellRef = XLSX.utils.encode_cell({ r, c });
    const cell = sheet[cellRef];
    
    if (cell && cell.v !== undefined && cell.v !== '') {
      hasContent = true;
      const value = String(cell.v).replace(/\n/g, '↵');
      rowData.push(`${XLSX.utils.encode_col(c)}${r + 1}="${value.substring(0, 40)}${value.length > 40 ? '...' : ''}"`);
    }
  }
  
  if (hasContent) {
    console.log(`\nСтрока ${r + 1}:`);
    rowData.forEach(d => console.log(`   ${d}`));
  }
}

// Выводим как таблицу для наглядности
console.log('\n\n📊 ТАБЛИЧНОЕ ПРЕДСТАВЛЕНИЕ (первые 50 строк):');
console.log('='.repeat(80));

const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as string[][];

jsonData.slice(0, 50).forEach((row, i) => {
  const nonEmptyCells = row.map((cell, j) => {
    if (cell !== '') {
      return `[${XLSX.utils.encode_col(j)}]${String(cell).substring(0, 30)}`;
    }
    return null;
  }).filter(Boolean);
  
  if (nonEmptyCells.length > 0) {
    console.log(`${String(i + 1).padStart(3)}: ${nonEmptyCells.join(' | ')}`);
  }
});

console.log('\n✅ Анализ завершён');

