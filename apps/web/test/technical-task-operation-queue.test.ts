import { expect, test } from 'bun:test';
import { createTaskOperationQueue } from '../src/pages/technical-tasks/task-operation-queue';

test('ручное сохранение новых правок ждёт незавершённого автосохранения', async () => {
  const enqueue = createTaskOperationQueue();
  let finishAutoSave!: () => void;
  let stored = '';
  const autoSave = enqueue(async () => {
    await new Promise<void>((resolve) => { finishAutoSave = resolve; });
    stored = 'старый снимок';
  });
  const manualSave = enqueue(async () => { stored = 'новые правки'; });
  await Bun.sleep(0);
  expect(stored).toBe('');
  finishAutoSave();
  await Promise.all([autoSave, manualSave]);
  expect(stored).toBe('новые правки');
});

test('ошибка одного сохранения не блокирует повторную попытку', async () => {
  const enqueue = createTaskOperationQueue();
  const failed = enqueue(async () => { throw new Error('Нет соединения'); });
  const retry = enqueue(async () => 'сохранено');
  await expect(failed).rejects.toThrow('Нет соединения');
  expect(await retry).toBe('сохранено');
});

test('сохранение во время генерации XML выполняется после генерации', async () => {
  const enqueue = createTaskOperationQueue();
  const calls: string[] = [];
  const generation = enqueue(async () => { calls.push('сохранение перед генерацией'); await Bun.sleep(1); calls.push('генерация XML'); });
  const save = enqueue(async () => { calls.push('сохранение новых правок'); });
  await Promise.all([generation, save]);
  expect(calls).toEqual(['сохранение перед генерацией', 'генерация XML', 'сохранение новых правок']);
});
