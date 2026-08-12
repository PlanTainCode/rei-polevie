import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import PizZip from 'pizzip';
import {
  buildResultsWithPollutionText,
  replaceProgramIeiSection71Block,
} from '../src/modules/word/program-iei/section-71';

const baseFlags = {
  hasWaterSampling: false,
  hasSedimentSampling: false,
  hasAirSampling: false,
  hasPhysicalImpacts: false,
  hasBuildingSurvey: false,
  isCommunicationNetworksObject: false,
  hasPPR: false,
  hasGasGeochemistry: false,
  hasSurfaceWater: false,
  hasGroundwater: false,
};

function paraText(xml: string, paraId: string): string | null {
  const match = xml.match(
    new RegExp(`<w:p[^>]*w14:paraId="${paraId}"[^>]*>([\\s\\S]*?)</w:p>`),
  );
  if (!match) return null;
  return [...match[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
}

test('buildResultsWithPollutionText: условные вода/акустика/ЭМП', () => {
  const noExtras = buildResultsWithPollutionText(baseFlags);
  expect(noExtras).toContain('почв (грунтов), атмосферного воздуха; определение класса');
  expect(noExtras).not.toContain('поверхностных и подземных вод');
  expect(noExtras).not.toContain('акустическое');
  expect(noExtras).not.toContain('вибрации');

  const full = buildResultsWithPollutionText({
    ...baseFlags,
    hasWaterSampling: true,
    hasAirSampling: true,
    hasPhysicalImpacts: true,
  });
  expect(full).toContain(', поверхностных и подземных вод, атмосферного воздуха');
  expect(full).toContain('; акустическое загрязнение ОС, оценка вибрации');
  expect(full).toContain('определение класса опасности грунта');
});

test('replaceProgramIeiSection71Block: новый список + условный пункт результатов', () => {
  const xml = new PizZip(
    readFileSync(join(process.cwd(), 'templates', 'Программа ИЭИ актуальная.docx'), 'binary'),
  )
    .file('word/document.xml')!
    .asText();

  expect(paraText(xml, '1C63D642')).toBeTruthy();

  const result = replaceProgramIeiSection71Block({
    xml,
    orderFlags: {
      ...baseFlags,
      hasSurfaceWater: true,
      hasAirSampling: true,
    },
  });

  expect(paraText(result, '0CFFD41E')).toBe(
    'Результатом ИЭИ является «Технический отчет по результатам инженерно-экологических изысканий» в составе:',
  );
  expect(paraText(result, '57A9FAF2')).toContain('введение');
  expect(paraText(result, '1C63D642')).toContain('поверхностных и подземных вод');
  expect(paraText(result, '1C63D642')).toContain('акустическое загрязнение ОС');
  expect(paraText(result, '1C63D642')).not.toContain('вибрации');

  // устаревший второй блок удалён
  expect(paraText(result, '2199F848')).toBeNull();
  expect(paraText(result, '502E2747')).toBeNull();

  expect(paraText(result, '22368CF2')).toBe(
    'Срок представления: Согласно Календарному плану выполнения работ',
  );
});
