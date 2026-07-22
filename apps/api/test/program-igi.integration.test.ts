import { expect, test } from 'bun:test';
import { copyFile, mkdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import PizZip from 'pizzip';
import { WordService } from '../src/modules/word/word.service';

function visibleText(xml: string): string {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1])
    .join('');
}

test('generateProgramIgi адаптирует титул/§1 и сохраняет §2+ подрядчика', async () => {
  const apiDir = join(import.meta.dir, '..');
  const previousCwd = process.cwd();
  const keepGeneratedFile = process.env.KEEP_IGI_TEST_OUTPUT === '1';
  const sourceName = `igi-source-test-${Date.now()}.docx`;
  const sourceDir = join(apiDir, 'uploads', 'program-igi');
  const sourcePath = join(sourceDir, sourceName);
  let generatedPath = '';

  await mkdir(sourceDir, { recursive: true });
  await copyFile(join(import.meta.dir, 'fixtures', 'program-igi-sample.docx'), sourcePath);

  const prisma = {
    project: {
      findUnique: async () => ({
        id: 'project-igi-test',
        name: 'Тестовый проект ИГИ',
        objectName: 'Тестовый объект ИГИ для титула',
        objectAddress: 'г. Москва, СЗАО, район Покровское-Стрешнево',
        objectPurpose: 'Инженерные сети, сети связи',
        clientName: 'АО «Тестовый заказчик»',
        clientAddress: 'г. Москва, ул. Тестовая, 1',
        documentNumber: '801-199-25',
        distanceKm: null,
        tzFileUrl: null,
      }),
    },
    programIei: {
      findUnique: async () => ({
        igiSourceFileName: sourceName,
        overviewImageName: null,
        cadastralNumber: '77:01:0000000',
        egrnDescription: 'Земли населённых пунктов\nИспользование: улично-дорожная сеть',
      }),
      upsert: async () => ({}),
    },
  };
  const aiService = {};
  const distanceService = {};

  process.chdir(apiDir);
  try {
    const service = new WordService(prisma as never, aiService as never, distanceService as never);
    const result = await service.generateProgramIgi({
      projectId: 'project-igi-test',
      userId: 'user-igi-test',
    });
    generatedPath = result.filePath;

    const zip = new PizZip(await readFile(result.filePath));
    const documentXml = zip.file('word/document.xml')?.asText() ?? '';
    const documentText = visibleText(documentXml);

    expect(documentText).toContain('Тестовый объект ИГИ для титула');
    expect(documentText).toContain('инженерно-геологических изысканий');
    expect(documentText).toContain('инженерно-геологических'); // цели подрядчика
    expect(documentText).toContain('Бурение скважин');
    expect(documentText).toContain('Статическое зондирование грунтов');
    expect(documentText).toContain('77:01:0000000');
    expect(result.fileName).toContain('ПГИ');
  } finally {
    process.chdir(previousCwd);
    await unlink(sourcePath).catch(() => {});
    if (generatedPath && !keepGeneratedFile) {
      await unlink(generatedPath).catch(() => {});
    }
  }
});
