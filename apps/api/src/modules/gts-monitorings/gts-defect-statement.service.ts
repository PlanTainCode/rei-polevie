import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { join } from 'path';
import { readFile, writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { PDFDocument } from 'pdf-lib';
import { convertDocxToPdf } from '../inquiry-requests/pdf.utils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PizZip = require('pizzip');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Docxtemplater = require('docxtemplater');

@Injectable()
export class GtsDefectStatementService {
  private readonly logger = new Logger(GtsDefectStatementService.name);
  private readonly templatePath = join(process.cwd(), 'templates', 'гтс', '1 Дефектная ведомость.docx');

  constructor(private prisma: PrismaService) {}

  async generateForObject(objectId: string): Promise<{ filename: string; buffer: Buffer }> {
    const object = await this.prisma.gtsObject.findUnique({
      where: { id: objectId },
      include: {
        district: true,
        elements: { orderBy: { sortOrder: 'asc' } },
        monitoring: true,
      },
    });
    if (!object) throw new NotFoundException('Объект ГТС не найден');

    const pdfBuffer = await this.generateSingleDV(object);
    const safeName = `${object.number}_${object.settlement}`.replace(/[<>:"/\\|?*]/g, '_');
    return { filename: `ДВ_${safeName}.pdf`, buffer: pdfBuffer };
  }

  async generateForDistrict(districtId: string): Promise<{ filename: string; buffer: Buffer }> {
    const district = await this.prisma.gtsDistrict.findUnique({
      where: { id: districtId },
      include: {
        objects: {
          orderBy: { number: 'asc' },
          include: {
            elements: { orderBy: { sortOrder: 'asc' } },
            monitoring: true,
          },
        },
      },
    });
    if (!district) throw new NotFoundException('Район не найден');
    if (district.objects.length === 0) throw new NotFoundException('В районе нет объектов ГТС');

    const pdfBuffers: Buffer[] = [];
    for (const object of district.objects) {
      try {
        const buf = await this.generateSingleDV({ ...object, district });
        pdfBuffers.push(buf);
      } catch (err) {
        this.logger.error(`Ошибка генерации ДВ для объекта ${object.id}:`, err);
      }
    }

    if (pdfBuffers.length === 0) throw new Error('Не удалось сгенерировать ни одну ДВ');

    const mergedBuffer = await this.mergePdfBuffers(pdfBuffers);
    const safeName = district.name.replace(/[<>:"/\\|?*]/g, '_');
    return { filename: `ДВ_${safeName}.pdf`, buffer: mergedBuffer };
  }

  private async generateSingleDV(object: any): Promise<Buffer> {
    const templateContent = await readFile(this.templatePath);
    const zip = new PizZip(templateContent);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    const inspectionDate = object.inspectionDate
      ? new Date(object.inspectionDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
      : '«___» __________ 20__ года';

    const coords = [object.latitude, object.longitude].filter(Boolean).join(' / ');

    doc.render({
      date: inspectionDate,
      object_name: `ГТС пруда на ${object.watercourseName} у ${object.settlement}`,
      watercourse: object.watercourseName || '',
      owner: object.ownerName || '',
      coordinates: coords || '',
      volume: object.volume || '',
      area: object.area || '',
      has_technical_doc: object.hasTechnicalDoc ? 'есть' : 'нет',
      overall_condition: object.overallCondition || '',
      inspector_name: object.inspectorName || '',
      elements: (object.elements || []).map((el: any, idx: number) => ({
        num: idx + 1,
        name: el.name,
        characteristics: el.characteristics || '',
        technical_condition_defects: [
          el.technicalCondition ? `Техническое состояние: ${el.technicalCondition}` : '',
          el.defects ? `Выявленные дефекты:\n${el.defects}` : '',
        ].filter(Boolean).join('\n'),
        recommendations: el.recommendations || '',
      })),
    });

    const docxBuffer = doc.getZip().generate({ type: 'nodebuffer' });

    const tmpDir = await mkdtemp(join(tmpdir(), 'gts-dv-'));
    const tmpDocx = join(tmpDir, 'dv.docx');
    await writeFile(tmpDocx, docxBuffer);

    try {
      const pdfBuffer = await convertDocxToPdf(tmpDocx);
      return pdfBuffer;
    } finally {
      try { await rm(tmpDir, { recursive: true }); } catch { /* ignore */ }
    }
  }

  private async mergePdfBuffers(buffers: Buffer[]): Promise<Buffer> {
    if (buffers.length === 1) return buffers[0];

    const mergedPdf = await PDFDocument.create();
    for (const buf of buffers) {
      const srcPdf = await PDFDocument.load(buf);
      const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
      for (const page of pages) {
        mergedPdf.addPage(page);
      }
    }
    const mergedBytes = await mergedPdf.save();
    return Buffer.from(mergedBytes);
  }
}
