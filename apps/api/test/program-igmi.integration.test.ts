import { expect, test } from 'bun:test';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import PizZip from 'pizzip';
import { WordService } from '../src/modules/word/word.service';

function visibleText(xml: string): string {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1])
    .join('');
}

test('generateProgramIgmi заполняет объединённый шаблон без конфликтов изображений', async () => {
  const apiDir = join(import.meta.dir, '..');
  const previousCwd = process.cwd();
  const keepGeneratedFile = process.env.KEEP_IGMI_TEST_OUTPUT === '1';
  const imageName = `igmi-test-${Date.now()}.png`;
  const imageDir = join(apiDir, 'uploads', 'program-iei');
  const imagePath = join(imageDir, imageName);
  let generatedPath = '';

  await mkdir(imageDir, { recursive: true });
  await writeFile(
    imagePath,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  );

  const prisma = {
    project: {
      findUnique: async () => ({
        id: 'project-igmi-test',
        name: 'Тестовый проект',
        objectName: 'Тестовый объект ИГМИ',
        objectAddress: 'г. Москва, тестовый адрес',
        objectPurpose: 'Инженерные сети',
        clientName: 'АО «Тестовый заказчик»',
        clientAddress: 'г. Москва',
        documentNumber: '801-145-25',
        distanceKm: 12.5,
        tzFileUrl: null,
      }),
    },
    programIei: {
      findUnique: async () => ({
        overviewImageName: imageName,
        cadastralNumber: '77:01:0000000',
        egrnDescription: 'Земли населённых пунктов',
        nearbySouth: 'жилой дом',
        nearbyEast: null,
        nearbyWest: null,
        nearbyNorth: 'автомобильная дорога',
        nearbyText: null,
        customObjectAddress: null,
      }),
      upsert: async () => ({}),
    },
  };
  const aiService = {};
  const distanceService = {
    getDistanceToAddress: async () => 99,
  };

  process.chdir(apiDir);
  try {
    const service = new WordService(prisma as never, aiService as never, distanceService as never);
    const result = await service.generateProgramIgmi({
      projectId: 'project-igmi-test',
      userId: 'user-igmi-test',
    });
    generatedPath = result.filePath;

    const zip = new PizZip(await readFile(result.filePath));
    const documentXml = zip.file('word/document.xml')?.asText() ?? '';
    const documentText = visibleText(documentXml);
    const relationshipsXml = zip.file('word/_rels/document.xml.rels')?.asText() ?? '';
    const footerText = visibleText(
      [zip.file('word/footer1.xml')?.asText(), zip.file('word/footer2.xml')?.asText()]
        .filter(Boolean)
        .join(''),
    );

    expect(documentText).toContain('Тестовый объект ИГМИ');
    expect(documentText).toContain('К югу: жилой дом');
    expect(documentText).toContain('К северу: автомобильная дорога');
    expect(documentText).toContain('12,5 км');
    expect(documentText).not.toContain('96 км');
    expect(documentText).not.toContain('НазваниеОрганизации');
    expect(documentText).not.toContain('ДиректорФИО');
    expect(relationshipsXml).toContain('media/igmi-overview.png');
    expect(relationshipsXml).toContain('media/igmi-signature-matveeva.png');
    expect(zip.file('word/media/igmi-overview.png')).not.toBeNull();
    expect(zip.file('word/media/igmi-signature-matveeva.png')).not.toBeNull();
    expect(footerText).toContain('№ 801-145-25-ПГМ-1');
    expect(footerText).toContain('2025');
    if (keepGeneratedFile) {
      console.log(`[IGMI_TEST_OUTPUT] ${result.filePath}`);
    }
  } finally {
    process.chdir(previousCwd);
    await unlink(imagePath).catch(() => undefined);
    if (generatedPath && !keepGeneratedFile) {
      await unlink(generatedPath).catch(() => undefined);
    }
  }
});
