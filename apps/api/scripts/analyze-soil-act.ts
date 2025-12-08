import * as XLSX from 'xlsx';
import { join } from 'path';

const filePath = join(__dirname, '../templates/Задание ПБ2-шб.xlsx');

const workbook = XLSX.readFile(filePath);

// Ищем лист с актом отбора почв
const soilSheetName = workbook.SheetNames.find(name => 
  name.toLowerCase().includes('акт') && name.toLowerCase().includes('почв')
);

console.log('📚 Все листы:', workbook.SheetNames.join(', '));
console.log('\n📄 Найден лист:', soilSheetName);

if (!soilSheetName) {
  console.log('Лист не найден!');
  process.exit(1);
}

const sheet = workbook.Sheets[soilSheetName];

// Получаем диапазон
const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
console.log(`\n📐 Диапазон: ${sheet['!ref']}`);
console.log(`   Строки: ${range.s.r + 1} - ${range.e.r + 1}`);
console.log(`   Столбцы: ${XLSX.utils.encode_col(range.s.c)} - ${XLSX.utils.encode_col(range.e.c)}`);

// Объединённые ячейки
if (sheet['!merges']) {
  console.log(`\n🔗 ОБЪЕДИНЁННЫЕ ЯЧЕЙКИ (${sheet['!merges'].length}):`);
  sheet['!merges'].slice(0, 50).forEach((merge, i) => {
    const startCell = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
    const endCell = XLSX.utils.encode_cell({ r: merge.e.r, c: merge.e.c });
    const cellValue = sheet[startCell]?.v || '';
    console.log(`   ${i + 1}. ${startCell}:${endCell} = "${String(cellValue).substring(0, 60)}${String(cellValue).length > 60 ? '...' : ''}"`);
  });
}

// Содержимое построчно
console.log('\n📝 СОДЕРЖИМОЕ ЛИСТА:');
console.log('='.repeat(100));

for (let r = range.s.r; r <= Math.min(range.e.r, 60); r++) {
  const rowData: string[] = [];
  let hasContent = false;
  
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cellRef = XLSX.utils.encode_cell({ r, c });
    const cell = sheet[cellRef];
    
    if (cell && cell.v !== undefined && cell.v !== '') {
      hasContent = true;
      const value = String(cell.v).replace(/\n/g, '↵').substring(0, 50);
      rowData.push(`${XLSX.utils.encode_col(c)}="${value}"`);
    }
  }
  
  if (hasContent) {
    console.log(`\nСтрока ${r + 1}:`);
    rowData.forEach(d => console.log(`   ${d}`));
  }
}

// Табличное представление
console.log('\n\n📊 ТАБЛИЧНОЕ ПРЕДСТАВЛЕНИЕ:');
console.log('='.repeat(100));

const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as string[][];

jsonData.slice(0, 60).forEach((row, i) => {
  const nonEmptyCells = row.map((cell, j) => {
    if (cell !== '') {
      return `[${XLSX.utils.encode_col(j)}]${String(cell).substring(0, 25)}`;
    }
    return null;
  }).filter(Boolean);
  
  if (nonEmptyCells.length > 0) {
    console.log(`${String(i + 1).padStart(3)}: ${nonEmptyCells.join(' | ')}`);
  }
});

console.log('\n✅ Анализ завершён');

