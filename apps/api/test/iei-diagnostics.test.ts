import { afterEach, expect, spyOn, test } from 'bun:test';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../src/modules/ai/ai.service';
import { aiDiagnosticContext } from '../src/modules/ai/diagnostics';
import { matchProgramIeiSection42TableRowsViaAi } from '../src/modules/ai/program-iei/section-42-table-match';
import { WordService } from '../src/modules/word/word.service';
import { join } from 'node:path';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

for (const response of ['', 'not json', '{broken}', '{}', 'null', '{"keepWorkRowIndexes":[]}', '{"keepWorkRowIndexes":[99]}', '{"keepWorkRowIndexes":[0.5]}']) {
  test(`section42 rejects invalid selection: ${response}`, async () => {
    const result = await matchProgramIeiSection42TableRowsViaAi({
      chat: async () => response, orderText: 'test', servicesFromOrder: [], workRows: ['A', 'B'],
    });
    expect(result.ok).toBe(false);
  });
}

test('section42 accepts valid selection and logs no document text', async () => {
  const log = spyOn(console, 'log').mockImplementation(() => {});
  try {
    const result = await matchProgramIeiSection42TableRowsViaAi({
      chat: async () => '{"keepWorkRowIndexes":[1,1,0]}',
      orderText: 'SECRET_DOCUMENT', servicesFromOrder: [], workRows: ['A', 'B'],
    });
    expect(result).toEqual({ ok: true, keepWorkRowIndexes: [1, 0] });
    expect(JSON.stringify(log.mock.calls)).not.toContain('SECRET_DOCUMENT');
  } finally { log.mockRestore(); }
});

test('AI diagnostics correlate concurrent calls without exposing prompts or keys', async () => {
  const log = spyOn(console, 'log').mockImplementation(() => {});
  try {
    const ai = new AiService(new ConfigService({ DEEPSEEK_API_KEY: 'SECRET_KEY' }));
    globalThis.fetch = (async () => Response.json({ choices: [{ message: { content: 'SECRET_OUTPUT' }, finish_reason: 'stop' }] })) as any;
    await Promise.all(['one', 'two'].map(generationId => aiDiagnosticContext.run({ generationId, projectId: generationId },
      () => (ai as any).chat([{ role: 'user', content: 'SECRET_PROMPT' }], 'test_stage'))));
    const records = log.mock.calls.filter(c => c[0] === '[AiDiagnostics]').map(c => JSON.parse(c[1] as string));
    for (const id of ['one', 'two']) {
      const calls = records.filter(r => r.generationId === id);
      expect(calls.map(r => r.event)).toEqual(['request_started', 'response_headers', 'request_completed']);
      expect(new Set(calls.map(r => r.requestId)).size).toBe(1);
      expect(calls.every(r => r.operation === 'test_stage')).toBe(true);
    }
    const all = JSON.stringify(log.mock.calls);
    for (const secret of ['SECRET_KEY', 'SECRET_PROMPT', 'SECRET_OUTPUT']) expect(all).not.toContain(secret);
  } finally { log.mockRestore(); }
});

for (const mode of ['http', 'network', 'empty', 'truncated', 'bad_json']) {
  test(`AI diagnostics record ${mode} failure`, async () => {
    const log = spyOn(console, 'log').mockImplementation(() => {});
    try {
      const ai = new AiService(new ConfigService({ DEEPSEEK_API_KEY: 'test' }));
      globalThis.fetch = (async () => {
        if (mode === 'network') throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } });
        if (mode === 'http') return new Response('SECRET_PROVIDER_BODY', { status: 402 });
        if (mode === 'bad_json') return new Response('invalid');
        return Response.json({ choices: [{ message: { content: mode === 'empty' ? '' : '{}' }, finish_reason: 'length' }] });
      }) as any;
      await expect((ai as any).chat([{ role: 'user', content: 'test' }], 'test_stage')).rejects.toThrow();
      const records = log.mock.calls.filter(c => c[0] === '[AiDiagnostics]').map(c => JSON.parse(c[1] as string));
      expect(records.at(-1).event).toBe('request_failed');
      if (mode === 'http') expect(records.some(r => r.status === 402)).toBe(true);
      if (mode === 'network') expect(records.at(-1).causeCode).toBe('ECONNRESET');
      expect(JSON.stringify(log.mock.calls)).not.toContain('SECRET_PROVIDER_BODY');
    } finally { log.mockRestore(); }
  });
}

test('generation stops before writing document or replacing last result when section42 fails', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'iei-diagnostic-test-'));
  const log = spyOn(console, 'log').mockImplementation(() => {});
  const warn = spyOn(console, 'warn').mockImplementation(() => {});
  const error = spyOn(console, 'error').mockImplementation(() => {});
  let saves = 0;
  let matches = 0;
  try {
    const templateDir = join(import.meta.dir, '../templates');
    const services = [{ row: 16, name: 'Радиометрическое обследование территории', quantity: 0.2 }];
    const prisma = {
      project: { findUnique: async () => ({ id: 'test', name: 'Тест', distanceKm: 1, services, orderFileUrl: 'Поручение (все работы, почти).docx' }), findMany: async () => [] },
      programIei: { findUnique: async () => null, upsert: async () => { saves++; } },
    };
    const ai = {
      extractProgramIeiSection31: async () => null,
      extractProgramIeiOrderFlags: async () => null,
      extractSection47Layers: async () => null,
      matchServicesFromOrder: async () => services,
      extractOrderServiceQuantities: async () => ({ ok: true, byRow: { 16: 0.2 } }),
      matchProgramIeiSection42TableRows: async () => { matches++; return { ok: false, keepWorkRowIndexes: [] }; },
    };
    const service = new WordService(prisma as any, ai as any, {} as any);
    Object.assign(service, { templateDir, uploadsDir: templateDir, outputDir });
    await expect(service.generateProgramIei({ projectId: 'test', userId: 'test' })).rejects.toThrow('Не удалось проверить состав работ');
    expect(matches).toBe(1);
    expect(saves).toBe(0);
    expect(await readdir(outputDir)).toEqual([]);
    expect(log.mock.calls.some(c => c[0] === '[AiDiagnostics]' && String(c[1]).includes('generation_failed'))).toBe(true);
  } finally {
    log.mockRestore(); warn.mockRestore(); error.mockRestore();
    await rm(outputDir, { recursive: true, force: true });
  }
});

for (const response of ['', 'not json', '{}', '{"objectName":"","siteDescription":""}']) {
  test(`strict section1 rejects unusable response: ${response}`, async () => {
    const ai = new AiService(new ConfigService({ DEEPSEEK_API_KEY: 'test' }));
    globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.thinking).toEqual({ type: 'disabled' });
      return Response.json({ choices: [{ message: { content: response }, finish_reason: 'stop' }] });
    }) as any;
    await expect(ai.extractProgramIeiSection1('ТЗ', 'Шаблон', { strict: true })).rejects.toThrow();
  });
}

test('strict section1 accepts extracted data with thinking disabled', async () => {
  const ai = new AiService(new ConfigService({ DEEPSEEK_API_KEY: 'test' }));
  globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
    expect(JSON.parse(String(init.body)).thinking).toEqual({ type: 'disabled' });
    return Response.json({ choices: [{ message: { content: '{"objectName":"Тестовый объект"}' }, finish_reason: 'stop' }] });
  }) as any;
  const result = await ai.extractProgramIeiSection1('ТЗ', 'Шаблон', { strict: true });
  expect(result.objectName).toBe('Тестовый объект');
});

test('section1 failure aborts IEI before later AI calls and leaves last document untouched', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'iei-section1-test-'));
  const log = spyOn(console, 'log').mockImplementation(() => {});
  const error = spyOn(console, 'error').mockImplementation(() => {});
  let saves = 0;
  let requests = 0;
  try {
    const templateDir = join(import.meta.dir, '../templates');
    const prisma = {
      project: {
        findUnique: async () => ({ id: 'test', name: 'Тест', distanceKm: 1, tzFileUrl: 'Программа ИЭИ актуальная.docx' }),
        findMany: async () => [],
      },
      programIei: { upsert: async () => { saves++; } },
    };
    const ai = new AiService(new ConfigService({ DEEPSEEK_API_KEY: 'test' }));
    globalThis.fetch = (async () => {
      requests++;
      return Response.json({ choices: [{ message: { content: '', reasoning_content: 'reasoning' }, finish_reason: 'length' }] });
    }) as any;
    const service = new WordService(prisma as any, ai, {} as any);
    Object.assign(service, { templateDir, uploadsDir: templateDir, outputDir });
    await expect(service.generateProgramIei({ projectId: 'test', userId: 'test' })).rejects.toThrow('Не удалось извлечь раздел 1');
    expect(requests).toBe(1);
    expect(saves).toBe(0);
    expect(await readdir(outputDir)).toEqual([]);
    expect(log.mock.calls.some(c => c[0] === '[AiDiagnostics]' && String(c[1]).includes('section1_generation_aborted'))).toBe(true);
  } finally {
    log.mockRestore(); error.mockRestore();
    await rm(outputDir, { recursive: true, force: true });
  }
});
