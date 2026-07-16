import { describe, expect, test } from 'bun:test';
import { extractProgramIeiOrderFlagsViaAi } from '../src/modules/ai/program-iei/order-flags';
import { pruneProgramIeiSection42PprRows } from '../src/modules/word/program-iei/section-42-natural-conditions';

describe('защита от ложного ППР и фразы про запечатанность', () => {
  test('эвристика не считает «в соответствии с ППР» услугой радона', async () => {
    const flags = await extractProgramIeiOrderFlagsViaAi({
      chat: async () => {
        throw new Error('AI не должен вызываться в этом тесте через успешный путь — ловим fallback');
      },
      orderText:
        'Организация и выполнение работ осуществляются в соответствии с ППР. Отбор проб почвы — 2 точки.',
      objectName: 'Тестовый объект',
    });

    expect(flags.hasPPR).toBe(false);
  });

  test('эвристика находит настоящее измерение ППР', async () => {
    const flags = await extractProgramIeiOrderFlagsViaAi({
      chat: async () => {
        throw new Error('fallback');
      },
      orderText:
        'Определение плотности потоков радона (ППР) абсорбционным методом — 10 датчиков.',
      objectName: 'Тестовый объект',
    });

    expect(flags.hasPPR).toBe(true);
  });

  test('prune удаляет строку измерения ППР без услуги', () => {
    const xml =
      '<w:tbl>' +
      '<w:tr w14:paraId="AAAA0001"><w:tc><w:p><w:r><w:t>Измерение ППР на участке строительства в контуре проектируемых зданий</w:t></w:r></w:p></w:tc></w:tr>' +
      '<w:tr w14:paraId="AAAA0002"><w:tc><w:p><w:r><w:t>Отбор проб почвы</w:t></w:r></w:p></w:tc></w:tr>' +
      '</w:tbl>';

    const result = pruneProgramIeiSection42PprRows({
      xml,
      rows: [
        {
          title: 'Измерение ППР на участке строительства в контуре проектируемых зданий',
          trIndex: 0,
          trParaId: 'AAAA0001',
          unit: 'точка',
          qtyParaId: 'Q1',
        },
        {
          title: 'Отбор проб почвы',
          trIndex: 1,
          trParaId: 'AAAA0002',
          unit: 'проба',
          qtyParaId: 'Q2',
        },
      ],
      hasPPR: false,
    });

    expect(result).not.toContain('AAAA0001');
    expect(result).toContain('AAAA0002');
    expect(result).not.toContain('Измерение ППР');
  });
});
