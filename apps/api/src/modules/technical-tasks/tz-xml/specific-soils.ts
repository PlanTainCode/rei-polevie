import type { DangerousProcesses } from './model';

/** В ЗнП по Окской грунт указан отдельной строкой в описании опасных процессов. */
export function classifyTechnogenicSoil(dangerous: DangerousProcesses): DangerousProcesses {
  const description = dangerous.processesAdditional;
  if (!description || description.title || description.paragraphs.length !== 1) return dangerous;

  const statement = description.paragraphs[0].trim();
  if (!/^(?:на площадке изысканий предполагается наличие:\s*)?(?:техногенный\s+грунт|техногенные\s+грунты)\.?$/iu.test(statement)) return dangerous;

  return {
    ...dangerous,
    processesAdditional: undefined,
    soils: [...new Set([...dangerous.soils, 'техногенные'])],
    soilsAdditional: dangerous.soilsAdditional ?? {
      paragraphs: ['На площадке изысканий предполагается наличие: техногенный грунт'],
    },
  };
}
