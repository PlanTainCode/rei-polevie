import * as XLSX from 'xlsx';
import { join } from 'path';

const filePath = join(__dirname, '../templates/Задание ПБ2-шб.xlsx');

const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets['Заявка в ИЛЦ'];

console.log('='.repeat(80));
console.log('📋 ПОЛНОЕ СОДЕРЖИМОЕ ЯЧЕЙКИ D11 (Назначения объекта):');
console.log('='.repeat(80));
const d11 = sheet['D11'];
if (d11) {
  console.log(d11.v);
  console.log('\n--- Разбивка по строкам: ---');
  const lines = String(d11.v).split('\n');
  lines.forEach((line, i) => {
    console.log(`  ${i + 1}. "${line.trim()}"`);
  });
}

console.log('\n' + '='.repeat(80));
console.log('📋 ПОЛНЫЙ СПИСОК УСЛУГ ИЗ ШАБЛОНА (строки 16-34):');
console.log('='.repeat(80));

const services: Array<{
  row: number;
  category: string;
  num: string;
  code: string;
  name: string;
  unit: string;
  qty: string;
  note: string;
}> = [];

let currentCategory = '';

for (let r = 15; r <= 34; r++) {
  const rowNum = r + 1;
  
  const aCell = sheet[`A${rowNum}`];
  const bCell = sheet[`B${rowNum}`];
  const cCell = sheet[`C${rowNum}`];
  const dCell = sheet[`D${rowNum}`];
  const eCell = sheet[`E${rowNum}`];
  const fCell = sheet[`F${rowNum}`];
  const gCell = sheet[`G${rowNum}`];
  const hCell = sheet[`H${rowNum}`];
  
  if (aCell?.v) {
    currentCategory = String(aCell.v);
  }
  
  const name = dCell?.v || eCell?.v || '';
  
  if (bCell?.v && name) {
    services.push({
      row: rowNum,
      category: currentCategory,
      num: String(bCell.v || ''),
      code: String(cCell?.v || ''),
      name: String(name),
      unit: String(fCell?.v || ''),
      qty: String(gCell?.v || ''),
      note: String(hCell?.v || ''),
    });
  }
}

services.forEach((s, i) => {
  console.log(`\n${i + 1}. [Строка ${s.row}]`);
  console.log(`   Категория: ${s.category}`);
  console.log(`   № пп: ${s.num}`);
  console.log(`   Код: ${s.code}`);
  console.log(`   Наименование: ${s.name}`);
  console.log(`   Ед.изм.: ${s.unit}`);
  console.log(`   Кол-во: ${s.qty || '(пусто)'}`);
});

console.log('\n' + '='.repeat(80));
console.log('📋 СВОДКА КАТЕГОРИЙ И УСЛУГ:');
console.log('='.repeat(80));

const categories = new Map<string, string[]>();
services.forEach(s => {
  if (!categories.has(s.category)) {
    categories.set(s.category, []);
  }
  categories.get(s.category)!.push(s.name);
});

categories.forEach((names, cat) => {
  console.log(`\n[${cat}]`);
  names.forEach((n, i) => {
    console.log(`  ${i + 1}. ${n.substring(0, 70)}${n.length > 70 ? '...' : ''}`);
  });
});

