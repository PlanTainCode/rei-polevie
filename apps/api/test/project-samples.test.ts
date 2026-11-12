import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { ValidationPipe } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SamplesService } from '../src/modules/projects/samples.service';
import { ProjectsService } from '../src/modules/projects/projects.service';
import { CreateSampleDto } from '../src/modules/projects/dto/create-sample.dto';

const input: CreateSampleDto = {
  cipher: 'Допотбор-01/2026', platformType: 'PP', platformNumber: 1,
  analysisCode: 'АХ', layerNumber: 1, depthFrom: 0, depthTo: 0.2, mass: '1,0 кг/Пэ',
};
const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const validate = (value: unknown): Promise<CreateSampleDto> => pipe.transform(value, {
  type: 'body', metatype: CreateSampleDto,
});

function fixture({ role = 'MANAGER', access = true, failCreate = false } = {}) {
  let writes = 0;
  let platforms: any[] = [{ id: 'existing-platform', projectId: 'project', type: 'PP', number: 1, label: 'ПП1' }];
  let samples: any[] = [{ id: 'existing-sample', projectId: 'project', platformId: 'existing-platform', cipher: '01АХ.01', status: 'COLLECTED', description: 'суглинок' }];
  const prisma = {
    project: { findFirst: async ({ where }: any) => access && where.id === 'project'
      && where.company.members.some.userId === 'user' ? { companyId: 'company' } : null },
    companyMember: { findUnique: async ({ where }: any) => where.userId_companyId.userId === 'user'
      && where.userId_companyId.companyId === 'company' ? { role } : null },
    $transaction: async (callback: (tx: any) => Promise<any>) => {
      writes++;
      const nextPlatforms = platforms.map((p) => ({ ...p }));
      const nextSamples = samples.map((s) => ({ ...s }));
      const result = await callback({
        platform: {
          upsert: async ({ where, create }: any) => {
            const key = where.projectId_type_number;
            let platform = nextPlatforms.find((p) => p.projectId === key.projectId && p.type === key.type && p.number === key.number);
            if (!platform) { platform = { id: `platform-${nextPlatforms.length}`, ...create }; nextPlatforms.push(platform); }
            return platform;
          },
        },
        sample: {
          create: async ({ data }: any) => {
            if (failCreate) throw new Error('storage failure');
            if (nextSamples.some((s) => s.projectId === data.projectId && s.cipher === data.cipher)) {
              throw new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '5.8.0', meta: { target: ['projectId', 'cipher'] } });
            }
            const sample = { id: `sample-${nextSamples.length}`, status: 'PENDING', ...data };
            nextSamples.push(sample);
            return { ...sample, platform: nextPlatforms.find((p) => p.id === data.platformId) };
          },
        },
      });
      platforms = nextPlatforms;
      samples = nextSamples;
      return result;
    },
  };
  const service = new SamplesService(prisma as any);
  return { service, state: () => ({ platforms, samples, writes }) };
}

describe('Ручное добавление проб', () => {
  for (const role of ['OWNER', 'ADMIN', 'MANAGER']) {
    test(`${role}: произвольный шифр, существующая площадка, сохранение старой пробы`, async () => {
      const { service, state } = fixture({ role });
      const original = structuredClone(state().samples[0]);
      const result = await service.createSample('project', 'user', await validate({ ...input, cipher: '  Допотбор-01/2026  ' }));
      expect(result).toMatchObject({ cipher: input.cipher, status: 'PENDING', type: 'SOIL', sampleNumber: 1, depthLabel: '0,0-0,2', platformId: 'existing-platform' });
      expect(result.platform.label).toBe('ПП1');
      expect(state().platforms).toHaveLength(1);
      expect(state().samples).toHaveLength(2);
      expect(state().samples[0]).toEqual(original);
    });
  }

  test('WORKER не может создавать пробы, включая собственный объект', async () => {
    const { service, state } = fixture({ role: 'WORKER' });
    await expect(service.createSample('project', 'user', input)).rejects.toMatchObject({ status: 403 });
    expect(state().writes).toBe(0);
  });

  test('Чужая компания, другой пользователь и отсутствующий объект недоступны', async () => {
    const { service, state } = fixture();
    await expect(service.createSample('other-project', 'user', input)).rejects.toMatchObject({ status: 404 });
    await expect(service.createSample('project', 'stranger', input)).rejects.toMatchObject({ status: 404 });
    await expect(fixture({ access: false }).service.createSample('project', 'user', input)).rejects.toMatchObject({ status: 404 });
    expect(state().writes).toBe(0);
  });

  test('Новая скважина создаётся с пробой, произвольный шифр не меняет сортировку и вид анализа', async () => {
    const { service, state } = fixture();
    const result = await service.createSample('project', 'user', { ...input, platformType: 'SK', platformNumber: 4, layerNumber: 3, depthFrom: 1.25, depthTo: 2.5 });
    expect(result).toMatchObject({ sampleNumber: 4, layerNumber: 3, analysisCode: 'АХ', depthLabel: '1,25-2,5' });
    expect(result.platform).toMatchObject({ label: 'СК4', projectId: 'project' });
    expect(state().platforms).toHaveLength(2);
  });

  test('Повторный шифр возвращает 409 и не оставляет новой площадки', async () => {
    const { service, state } = fixture();
    const before = structuredClone(state());
    await expect(service.createSample('project', 'user', { ...input, cipher: ' 01АХ.01 ', platformNumber: 10 })).rejects.toMatchObject({ status: 409 });
    expect(state().platforms).toEqual(before.platforms);
    expect(state().samples).toEqual(before.samples);
  });

  test('Ошибка хранилища откатывает площадку и не выдаётся за повторный шифр', async () => {
    const { service, state } = fixture({ failCreate: true });
    await expect(service.createSample('project', 'user', { ...input, platformNumber: 10 })).rejects.toThrow('storage failure');
    expect(state().platforms).toHaveLength(1);
    expect(state().samples).toHaveLength(1);
  });

  for (const [analysisCode, platformType, type, label] of [
    ['БХ', 'DO', 'SEDIMENT', 'ДО1'], ['ВХ', 'V', 'WATER', 'В1'],
    ['АМ', 'PP', 'SOIL', 'ПП1'], ['АП', 'PP', 'SOIL', 'ПП1'], ['АЭ', 'PP', 'SOIL', 'ПП1'],
  ] as const) {
    test(`${analysisCode}: совместимые поля для экспорта и документов`, async () => {
      const { service } = fixture();
      const result = await service.createSample('project', 'user', { ...input, analysisCode, platformType, depthTo: 0 });
      expect(result.type).toBe(type);
      expect(result.platform.label).toBe(label);
      expect(result.depthLabel).toBe(type === 'WATER' ? '-' : '0,0-0,0');
    });
  }

  test('Несовместимые площадки и обратный диапазон глубин отклоняются до записи', async () => {
    const { service, state } = fixture();
    for (const data of [
      { analysisCode: 'ВХ' }, { analysisCode: 'БХ' }, { platformType: 'V' }, { platformType: 'DO' },
      { depthFrom: 2, depthTo: 1 },
    ]) await expect(service.createSample('project', 'user', { ...input, ...data } as CreateSampleDto)).rejects.toMatchObject({ status: 400 });
    expect(state().writes).toBe(0);
  });

  test('Валидация DTO: пустые поля, дробная нумерация, бесконечность, отрицательная глубина и лишние поля', async () => {
    for (const invalid of [
      { cipher: '   ' }, { cipher: null }, { cipher: 'x'.repeat(201) }, { mass: '  ' },
      { platformNumber: 0 }, { platformNumber: 1.5 }, { platformNumber: 2147483648 },
      { layerNumber: 0 }, { layerNumber: 1.5 }, { platformType: 'UNKNOWN' }, { analysisCode: 'OTHER' },
      { depthFrom: -0.1 }, { depthTo: NaN }, { depthTo: Infinity }, { depthTo: '0.2' },
      { projectId: 'other' }, { platformId: 'foreign' }, { status: 'COLLECTED' }, { collectedById: 'stranger' },
    ]) await expect(validate({ ...input, ...invalid })).rejects.toMatchObject({ status: 400 });
    for (const key of Object.keys(input)) {
      const missing: Record<string, unknown> = { ...input };
      delete missing[key];
      await expect(validate(missing)).rejects.toMatchObject({ status: 400 });
    }
    expect(await validate({ ...input, cipher: '  шифр / 1  ', mass: '  750 г/Пэ  ' })).toMatchObject({ cipher: 'шифр / 1', mass: '750 г/Пэ' });
  });

  test('Страница получает право добавления по роли, независимо от авторства объекта', async () => {
    for (const role of ['OWNER', 'ADMIN', 'MANAGER', 'WORKER']) {
      for (const createdById of ['user', 'someone']) {
        const service = Object.assign(Object.create(ProjectsService.prototype), { prisma: {
          companyMember: { findFirst: async () => ({ companyId: 'company', role }) },
          project: { findUnique: async () => ({ id: 'project', companyId: 'company', createdById }) },
        } }) as ProjectsService;
        expect((await service.findById('project', 'user')).canCreateSamples).toBe(role !== 'WORKER');
      }
    }
  });
});
