import { expect, test } from 'bun:test';
import { execFile } from 'child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { promisify } from 'util';
import * as ts from 'typescript';
import { buildTzXml } from '../src/modules/technical-tasks/tz-xml';
import { buildSampleModel, SAMPLE_IMAGE_BASE64, SAMPLE_IMAGE_URL } from './fixtures/tz-xml-sample-model';

const execFileAsync = promisify(execFile);
const apiRoot = join(import.meta.dir, '..');
const repoRoot = join(apiRoot, '../..');
const nodeTest = Bun.which('node') && Bun.which('xsltproc') ? test : test.skip;

nodeTest('собранный CommonJS-модуль формирует просмотр с изображением под Node.js', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tz-node-test-'));
  try {
    const config = ts.readConfigFile(join(apiRoot, 'tsconfig.json'), ts.sys.readFile);
    const { options } = ts.convertCompilerOptionsFromJson(config.config.compilerOptions, apiRoot);
    // Компилируем с настоящими настройками API. Bun скрывает несовместимый default-import CommonJS.
    for (const modulePath of ['technical-tasks/pdf-preview', 'inquiry-requests/pdf.utils']) {
      const sourcePath = join(apiRoot, 'src/modules', `${modulePath}.ts`);
      const targetPath = join(dir, `${modulePath}.js`);
      await mkdir(dirname(targetPath), { recursive: true });
      const source = await readFile(sourcePath, 'utf8');
      const { outputText } = ts.transpileModule(source, { compilerOptions: options, fileName: sourcePath });
      await writeFile(targetPath, outputText);
    }
    const xmlPath = join(dir, 'input.xml');
    const xml = buildTzXml(buildSampleModel(), { images: { [SAMPLE_IMAGE_URL]: SAMPLE_IMAGE_BASE64 }, preview: true });
    await writeFile(xmlPath, xml);
    const runner = `
      const { readFileSync } = require('fs');
      const { renderTzHtml } = require(process.argv[1]);
      renderTzHtml(readFileSync(process.argv[2], 'utf8'), process.argv[3], process.argv[4])
        .then(() => console.log('OK'))
        .catch(error => { console.error(error); process.exitCode = 1; });
    `;
    const { stdout } = await execFileAsync('node', [
      '-e', runner,
      join(dir, 'technical-tasks/pdf-preview.js'), xmlPath,
      join(apiRoot, 'templates/тз/xml/EngineeringSurveysTask-01-00.xsl'), dir,
    ], { env: { ...process.env, NODE_PATH: join(repoRoot, 'node_modules') }, timeout: 30000 });
    expect(stdout.trim()).toBe('OK');
    const html = await readFile(join(dir, 'task.html'), 'utf8');
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('width: 168.00mm; height: 168.00mm;');
    expect(html).toContain('Горсвязьстрой');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
