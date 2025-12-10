import * as ExcelJS from 'exceljs';
import { join } from 'path';

const TEMPLATE_PATH = join(process.cwd(), 'templates', 'Задание ПБ2-шб.xlsx');

// Сопоставление старых кодов с новыми
const MAPPING = [
  {
    oldRow: 16,
    oldCode: '1',
    oldName: 'Радиометрическое обследование территории (1 га)',
    newCode: '11.018',
    newName: 'Радиометрическое обследование территории (с оформлением схемы) на 1 га',
    note: 'Код изменён',
  },
  {
    oldRow: 17,
    oldCode: '3',
    oldName: 'Определение плотности потоков радона (ППР) абсорбционным методом',
    newCode: '11.010 + 11.009',
    newName: '11.010 - ППР (датчик), 11.009 - Установка датчиков',
    note: 'Разбито на 2 позиции',
  },
  {
    oldRow: 18,
    oldCode: '4',
    oldName: 'Радиометрическое обследование здания/помещений (1000 кв.м)',
    newCode: '11.015',
    newName: 'Радиометрическое обследование здания / помещения на 1000 м2',
    note: 'Код изменён',
  },
  {
    oldRow: 19,
    oldCode: '5',
    oldName: 'Определение объемной активности (ОА) / ЭРОА радона',
    newCode: '11.013',
    newName: 'Определение ОА/ЭРОА радона инспекционным методом',
    note: 'Код изменён',
  },
  {
    oldRow: 20,
    oldCode: '6',
    oldName: 'Комплекс 1.4. Санитарно-гигиеническое обследование почв (СанПиН)',
    newCode: '1.193',
    newName: 'Комплекс 1.04. Санитарно-химическое обследование почв (СанПиН стандарт)',
    note: 'Номер комплекса: 1.4 → 1.04, код 1.193',
  },
  {
    oldRow: 21,
    oldCode: '7',
    oldName: 'Комплекс 13.2. Определение острой токсичности',
    newCode: '13.051',
    newName: 'Комплекс 13.01. Определение острой токсичности (Daphnia + Chlorella)',
    note: 'Номер комплекса: 13.2 → 13.01, код 13.051',
  },
  {
    oldRow: 22,
    oldCode: '8 (МБ)',
    oldName: 'Микробиология почвы (ОКБ, E.coli, сальмонеллы, гельминты)',
    newCode: '13.052',
    newName: 'Комплекс 13.02. Исследование почвы на бактериологию и паразитологию',
    note: 'Новый комплекс 13.02',
  },
  {
    oldRow: 23,
    oldCode: '8',
    oldName: 'Преимагинальные формы синантропных мух',
    newCode: '13.001',
    newName: 'Преимагинальные формы синатропных мух (личинки и куколки)',
    note: 'Код изменён',
  },
  {
    oldRow: 24,
    oldCode: '9',
    oldName: 'Комплекс 1.11. Обследование почв (МГСН 1.02-02)',
    newCode: '1.200',
    newName: 'Комплекс 1.11. Обследование почв при комплексном благоустройстве (МГСН)',
    note: 'Номер комплекса сохранён, код 1.200',
  },
  {
    oldRow: 25,
    oldCode: '10',
    oldName: 'Хлориды (водорастворимая форма)',
    newCode: '1.033',
    newName: 'Хлорид-ион',
    note: 'Код изменён',
  },
  {
    oldRow: 26,
    oldCode: '11',
    oldName: 'Удельная электрическая проводимость (УЭП)',
    newCode: '1.017',
    newName: 'Удельная электрическая проводимость (УЭП)',
    note: 'Код изменён',
  },
  {
    oldRow: 27,
    oldCode: '12',
    oldName: 'Комплекс 1.23. Исследование свойств вскрышных пород (ГОСТ)',
    newCode: '1.205',
    newName: 'Комплекс 1.16. Исследование свойств вскрышных пород (ГОСТ 17.5.1.03-86)',
    note: 'Номер комплекса: 1.23 → 1.16, код 1.205',
  },
  {
    oldRow: 28,
    oldCode: '13',
    oldName: 'Поверхностная вода (органолептика, ХПК, БПК, металлы и т.д.)',
    newCode: '4.182',
    newName: 'Комплекс 4.02. Обследование воды поверхностных водоисточников (стандартный)',
    note: 'Новый комплекс 4.02, код 4.182',
  },
  {
    oldRow: 29,
    oldCode: '14',
    oldName: 'Донные отложения (общие свойства, металлы, нефтепродукты)',
    newCode: '16.082',
    newName: 'Комплекс 16.03. Санитарно-химическое обследование донных отложений',
    note: 'Новый комплекс 16.03, код 16.082',
  },
  {
    oldRow: 30,
    oldCode: '15',
    oldName: 'Подземная вода (органолептика, химический состав)',
    newCode: '4.190',
    newName: 'Комплекс 4.10. Исследование состава подземных вод (СП 502)',
    note: 'Новый комплекс 4.10, код 4.190',
  },
  {
    oldRow: 31,
    oldCode: '16',
    oldName: 'Инструментальные исследования шума на территории',
    newCode: '12.006',
    newName: 'Инструментальные исследования шума на территории жилой застройки',
    note: 'Код изменён',
  },
  {
    oldRow: 32,
    oldCode: '17',
    oldName: 'Инструментальные исследования ЭМП',
    newCode: '12.015',
    newName: 'Инструментальные исследования параметров ЭМП промышленной частоты',
    note: 'Код изменён',
  },
  {
    oldRow: 33,
    oldCode: '18',
    oldName: 'Инструментальные исследования вибрации',
    newCode: '12.014',
    newName: 'Инструментальные исследования вибрации в помещениях жилых зданий',
    note: 'Код изменён',
  },
  {
    oldRow: 34,
    oldCode: '19',
    oldName: 'Оформление комплекта протоколов по одной заявке',
    newCode: '15.031',
    newName: 'Оформление протоколов по одной заявке (комплект)',
    note: 'Код изменён',
  },
];

async function addMappingSheet() {
  console.log('=== Добавление листа сопоставления ===\n');

  const templateWb = new ExcelJS.Workbook();
  await templateWb.xlsx.readFile(TEMPLATE_PATH);
  
  // Удаляем старый лист если есть
  const existingSheet = templateWb.getWorksheet('Сопоставление кодов');
  if (existingSheet) {
    templateWb.removeWorksheet(existingSheet.id);
  }
  
  // Создаём лист
  const sheet = templateWb.addWorksheet('Сопоставление кодов');
  
  // Ширина колонок
  sheet.getColumn(1).width = 8;   // Строка в заявке
  sheet.getColumn(2).width = 12;  // Старый код
  sheet.getColumn(3).width = 50;  // Старое наименование
  sheet.getColumn(4).width = 15;  // Новый код
  sheet.getColumn(5).width = 55;  // Новое наименование
  sheet.getColumn(6).width = 35;  // Примечание
  
  // Заголовок
  sheet.mergeCells('A1:F1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Сопоставление кодов услуг: Заявка в ИЛЦ → Прейскурант № 14 (с 04.08.2025)';
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center' };
  
  // Заголовки таблицы
  const headerRow = sheet.getRow(3);
  headerRow.values = ['Row', 'Старый код', 'Старое наименование', 'Новый код', 'Новое наименование', 'Примечание'];
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  headerRow.height = 25;
  
  for (let col = 1; col <= 6; col++) {
    const cell = headerRow.getCell(col);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2EFDA' },
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  }
  
  // Данные
  let rowIndex = 4;
  for (const item of MAPPING) {
    const row = sheet.getRow(rowIndex);
    row.values = [
      item.oldRow,
      item.oldCode,
      item.oldName,
      item.newCode,
      item.newName,
      item.note,
    ];
    
    row.alignment = { wrapText: true, vertical: 'top' };
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(4).alignment = { horizontal: 'center' };
    
    // Подсветка изменённых кодов
    if (item.note.includes('Разбито') || item.note.includes('Новый')) {
      row.getCell(4).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF2CC' },
      };
    }
    
    for (let col = 1; col <= 6; col++) {
      row.getCell(col).border = {
        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      };
    }
    
    rowIndex++;
  }
  
  // Примечание
  rowIndex += 2;
  sheet.mergeCells(`A${rowIndex}:F${rowIndex}`);
  const noteCell = sheet.getCell(`A${rowIndex}`);
  noteCell.value = '⚠️ ВАЖНО: Номера комплексов в прейскуранте изменились! Например, старый "Комплекс 1.4" теперь "Комплекс 1.04" с кодом 1.193';
  noteCell.font = { bold: true, color: { argb: 'FFCC0000' } };
  
  await templateWb.xlsx.writeFile(TEMPLATE_PATH);
  console.log('✅ Лист "Сопоставление кодов" добавлен в шаблон!');
}

addMappingSheet().catch(console.error);
