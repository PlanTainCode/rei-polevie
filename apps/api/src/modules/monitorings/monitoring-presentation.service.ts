import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MonitoringPhotosService } from './monitoring-photos.service';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { extname } from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PptxGenJS = require('pptxgenjs');

@Injectable()
export class MonitoringPresentationService {
  private readonly logger = new Logger(MonitoringPresentationService.name);

  constructor(
    private prisma: PrismaService,
    private photosService: MonitoringPhotosService,
  ) {}

  async generatePointAlbum(
    monitoringId: string,
    pointName: string,
    crewMembers?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const monitoring = await this.prisma.monitoring.findUnique({ where: { id: monitoringId } });
    if (!monitoring) throw new NotFoundException('Мониторинг не найден');

    const photos = await this.photosService.getPhotosByPointName(monitoringId, pointName);
    if (photos.length === 0) throw new NotFoundException('Нет фотографий для генерации альбома');

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_4x3';

    const titleSlide = pptx.addSlide();
    titleSlide.addText(monitoring.objectName || monitoring.name, {
      x: 0.5, y: 1.5, w: 9, h: 1.5,
      fontSize: 24, bold: true, align: 'center',
      color: '333333',
    });

    titleSlide.addText(`Точка: ${pointName}`, {
      x: 0.5, y: 3, w: 9, h: 0.8,
      fontSize: 18, align: 'center',
      color: '555555',
    });

    if (crewMembers) {
      titleSlide.addText(`Состав ПБ: ${crewMembers}`, {
        x: 0.5, y: 4, w: 9, h: 0.5,
        fontSize: 12, align: 'center',
        color: '777777',
      });
    }

    const firstPhotoDate = photos[0]?.photoDate;
    if (firstPhotoDate) {
      const dateStr = new Date(firstPhotoDate).toLocaleDateString('ru-RU');
      titleSlide.addText(`Дата выезда: ${dateStr}`, {
        x: 0.5, y: 4.8, w: 9, h: 0.5,
        fontSize: 12, align: 'center',
        color: '777777',
      });
    }

    for (const photo of photos) {
      const photoPath = this.photosService.getOriginalPath(monitoringId, photo.filename);
      if (!existsSync(photoPath)) continue;

      const slide = pptx.addSlide();
      const imageBuffer = await readFile(photoPath);
      const base64 = imageBuffer.toString('base64');
      const ext = extname(photo.filename).toLowerCase();
      const mimeType = ext === '.png' ? 'png' : 'jpeg';

      slide.addImage({
        data: `image/${mimeType};base64,${base64}`,
        x: 0, y: 0, w: 10, h: 7.5,
        sizing: { type: 'contain', w: 10, h: 7.5 },
      });

      const coordParts: string[] = [];
      if (photo.latitude && photo.longitude) coordParts.push(`${photo.latitude}, ${photo.longitude}`);
      if (photo.photoDate) coordParts.push(new Date(photo.photoDate).toLocaleDateString('ru-RU'));
      if (coordParts.length > 0) {
        slide.addText(coordParts.join('  '), {
          x: 5, y: 6.8, w: 4.8, h: 0.5,
          fontSize: 8, align: 'right',
          color: 'FFFF00',
        });
      }

      if (photo.description) slide.addNotes(photo.description);
    }

    const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
    const safeName = pointName.replace(/[<>:"/\\|?*]/g, '_').trim();
    return { buffer: pptxBuffer, filename: `${safeName}_фотоальбом.pptx` };
  }

  async generateProbeAlbum(
    monitoringId: string,
    probeId: string,
    crewMembers?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const monitoring = await this.prisma.monitoring.findUnique({ where: { id: monitoringId } });
    if (!monitoring) throw new NotFoundException('Мониторинг не найден');

    const probe = await this.prisma.monitoringProbe.findUnique({ where: { id: probeId } });
    if (!probe) throw new NotFoundException('Проба не найдена');

    const photos = await this.photosService.getPhotosByProbe(probeId);
    if (photos.length === 0) throw new NotFoundException('Нет фотографий для генерации альбома');

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_4x3';

    const titleSlide = pptx.addSlide();
    titleSlide.addText(monitoring.objectName || monitoring.name, {
      x: 0.5, y: 1.5, w: 9, h: 1.5,
      fontSize: 24, bold: true, align: 'center',
      color: '333333',
    });

    titleSlide.addText(`Проба: ${probe.name}`, {
      x: 0.5, y: 3, w: 9, h: 0.8,
      fontSize: 18, align: 'center',
      color: '555555',
    });

    if (crewMembers) {
      titleSlide.addText(`Состав ПБ: ${crewMembers}`, {
        x: 0.5, y: 4, w: 9, h: 0.5,
        fontSize: 12, align: 'center',
        color: '777777',
      });
    }

    const firstPhotoDate = photos[0]?.photoDate;
    if (firstPhotoDate) {
      const dateStr = new Date(firstPhotoDate).toLocaleDateString('ru-RU');
      titleSlide.addText(`Дата выезда: ${dateStr}`, {
        x: 0.5, y: 4.8, w: 9, h: 0.5,
        fontSize: 12, align: 'center',
        color: '777777',
      });
    }

    for (const photo of photos) {
      const photoPath = this.photosService.getOriginalPath(monitoringId, photo.filename);
      if (!existsSync(photoPath)) continue;

      const slide = pptx.addSlide();

      const imageBuffer = await readFile(photoPath);
      const base64 = imageBuffer.toString('base64');
      const ext = extname(photo.filename).toLowerCase();
      const mimeType = ext === '.png' ? 'png' : 'jpeg';

      slide.addImage({
        data: `image/${mimeType};base64,${base64}`,
        x: 0, y: 0, w: 10, h: 7.5,
        sizing: { type: 'contain', w: 10, h: 7.5 },
      });

      const coordParts: string[] = [];
      if (photo.latitude && photo.longitude) {
        coordParts.push(`${photo.latitude}, ${photo.longitude}`);
      }
      if (photo.photoDate) {
        coordParts.push(new Date(photo.photoDate).toLocaleDateString('ru-RU'));
      }
      if (coordParts.length > 0) {
        slide.addText(coordParts.join('  '), {
          x: 5, y: 6.8, w: 4.8, h: 0.5,
          fontSize: 8, align: 'right',
          color: 'FFFF00',
        });
      }

      if (photo.description) {
        slide.addNotes(photo.description);
      }
    }

    const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
    const safeName = probe.name.replace(/[<>:"/\\|?*]/g, '_').trim();

    return {
      buffer: pptxBuffer,
      filename: `${safeName}_фотоальбом.pptx`,
    };
  }
}
