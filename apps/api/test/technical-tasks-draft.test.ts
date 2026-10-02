import { expect, test } from 'bun:test';
import { TechnicalTasksService } from '../src/modules/technical-tasks/technical-tasks.service';
import { createEmptyModel } from '../src/modules/technical-tasks/tz-xml';

function draftService(role = 'OWNER', createdById = 'user', status = 'DRAFT') {
  let task = { id: 'task', companyId: 'company', createdById, xmlData: createEmptyModel(), status, processingError: null };
  let writes = 0;
  const service = Object.assign(Object.create(TechnicalTasksService.prototype), {
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
