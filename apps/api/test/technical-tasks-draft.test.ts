import { expect, test } from 'bun:test';
import { TechnicalTasksService } from '../src/modules/technical-tasks/technical-tasks.service';
import { createEmptyModel } from '../src/modules/technical-tasks/tz-xml';

function draftService(role = 'OWNER', createdById = 'user', status = 'DRAFT') {
  let task = { id: 'task', companyId: 'company', createdById, xmlData: createEmptyModel(), status, processingError: null };
  let writes = 0;
  const service = Object.assign(Object.create(TechnicalTasksService.prototype), {
    counterparties: { rememberFromModel: async () => 0 },
    logger: { warn: () => {} },
    prisma: {
      companyMember: { findFirst: async () => ({ companyId: 'company', role, company: {} }) },
      technicalTask: {
        findUnique: async () => task,
        update: async ({ data }: { data: Partial<typeof task> }) => { writes++; task = { ...task, ...data }; return task; },
      },
    },
  }) as TechnicalTasksService;
  return { service, writes: () => writes };
}

test('пустые обязательные поля и неверный ИНН сохраняются в черновике', async () => {
  const { service } = draftService();
  const m = createEmptyModel();
  m.requisites.number = '';
  m.approver.organization.inn = 'неверный ИНН';
  m.approver.representatives = [];
  m.surveys = [];
  const result = await service.update('task', { xmlData: m as never }, 'user');
  expect(result.xmlData).toEqual(m);
  expect(result.issues.length).toBeGreaterThan(0);
});

test('после ошибки проверки XML можно продолжить заполнение и сохранить', async () => {
  const { service } = draftService();
  await expect(service.generate('task', 'user')).rejects.toThrow('Задание заполнено не полностью');
  const m = createEmptyModel();
  m.object.name = 'Объект после ошибки генерации';
  const result = await service.update('task', { xmlData: m as never }, 'user');
  expect(result.xmlData).toEqual(m);
  expect(result.status).toBe('DRAFT');
});

test('ручное сохранение после ошибки извлечения переводит ТЗ в черновик', async () => {
  const { service } = draftService('OWNER', 'user', 'ERROR');
  const result = await service.update('task', { xmlData: createEmptyModel() as never }, 'user');
  expect(result.status).toBe('DRAFT');
  expect(result.processingError).toBeNull();
});

test('сохранение без изменения сформированного задания не сбрасывает статус', async () => {
  const { service } = draftService('OWNER', 'user', 'COMPLETED');
  const task = await service.findById('task', 'user');
  const result = await service.update('task', { xmlData: task.xmlData as never }, 'user');
  expect(result.status).toBe('COMPLETED');
});

test('сохранение черновика сохраняет проверку прав редактирования', async () => {
  const { service, writes } = draftService('MEMBER', 'another-user');
  await expect(service.update('task', { xmlData: createEmptyModel() as never }, 'user')).rejects.toThrow('Нет прав на редактирование ТЗ');
  expect(writes()).toBe(0);
});

test('реестр пополняется только при явном сохранении и с companyId самого ТЗ', async () => {
  const { service } = draftService();
  const calls: string[] = [];
  Object.assign(service, { counterparties: { rememberFromModel: async (companyId: string) => { calls.push(companyId); return 2; } } });
  const model = createEmptyModel();
  await service.update('task', { xmlData: model as never }, 'user');
  expect(calls).toEqual([]);
  const saved = await service.update('task', { xmlData: model as never, rememberCounterparties: true }, 'user');
  expect(calls).toEqual(['company']);
  expect(saved).toHaveProperty('counterpartiesAdded', 2);
  expect(saved.xmlData).toEqual(model);
});

test('сбой реестра не мешает сохранению ТЗ и возвращает понятное сообщение', async () => {
  const { service, writes } = draftService();
  Object.assign(service, { counterparties: { rememberFromModel: async () => { throw new Error('Реестр недоступен'); } } });
  const model = createEmptyModel();
  const saved = await service.update('task', { xmlData: model as never, rememberCounterparties: true }, 'user');
  expect(saved.xmlData).toEqual(model);
  expect(saved).toHaveProperty('registryWarning');
  expect(writes()).toBe(1);
});

test('чужое ТЗ не может пополнять реестр через сохранение', async () => {
  const { service } = draftService('WORKER', 'another-user');
  let called = false;
  Object.assign(service, { counterparties: { rememberFromModel: async () => { called = true; return 0; } } });
  await expect(service.update('task', { xmlData: createEmptyModel() as never, rememberCounterparties: true }, 'user')).rejects.toThrow('Нет прав');
  expect(called).toBe(false);
});
