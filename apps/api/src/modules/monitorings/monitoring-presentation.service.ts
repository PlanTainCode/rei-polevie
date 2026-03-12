import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MonitoringPhotosService } from './monitoring-photos.service';
import { existsSync } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as sharp from 'sharp';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PptxGenJS = require('pptxgenjs');

const ALBUM_IMAGE_MAX_WIDTH = 1920;
const ALBUM_IMAGE_MAX_HEIGHT = 1440;
const ALBUM_IMAGE_QUALITY = 80;

@Injectable()
export class MonitoringPresentationService {
  private readonly logger = new Logger(MonitoringPresentationService.name);
  private readonly generatedDir = join(process.cwd(), 'generated');

  constructor(
    private prisma: PrismaService,
    private photosService: MonitoringPhotosService,
  ) {
    if (!existsSync(this.generatedDir)) {
      mkdir(this.generatedDir, { recursive: true }).catch(() => {});
    }
  }

  async generatePointAlbum(
    monitoringId: string,
    pointName: string,
    crewMembers?: string,
  ): Promise<{ fileName: string; downloadUrl: string }> {
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

      try {
        const slide = pptx.addSlide();
        const resized = await sharp(photoPath)
          .rotate()
          .resize(ALBUM_IMAGE_MAX_WIDTH, ALBUM_IMAGE_MAX_HEIGHT, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: ALBUM_IMAGE_QUALITY })
          .toBuffer();

        const base64 = resized.toString('base64');

        slide.addImage({
          data: `image/jpeg;base64,${base64}`,
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
      } catch (err) {
        this.logger.error(`Error adding image ${photo.filename}:`, err);
      }
    }

    const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
    const safeName = pointName.replace(/[<>:"/\\|?*]/g, '_').trim();
    const fileName = `${uuidv4()}_${safeName}_фотоальбом.pptx`;
    await writeFile(join(this.generatedDir, fileName), pptxBuffer);

    this.logger.log(`Point album saved: ${fileName} (${(pptxBuffer.length / 1024 / 1024).toFixed(1)} MB)`);

    return { fileName, downloadUrl: `/generated/${encodeURIComponent(fileName)}` };
  }

  async generateProbeAlbum(
    monitoringId: string,
    probeId: string,
    crewMembers?: string,
  ): Promise<{ fileName: string; downloadUrl: string }> {
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

      try {
        const slide = pptx.addSlide();
        const resized = await sharp(photoPath)
          .rotate()
          .resize(ALBUM_IMAGE_MAX_WIDTH, ALBUM_IMAGE_MAX_HEIGHT, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: ALBUM_IMAGE_QUALITY })
          .toBuffer();

        const base64 = resized.toString('base64');

        slide.addImage({
          data: `image/jpeg;base64,${base64}`,
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
      } catch (err) {
        this.logger.error(`Error adding image ${photo.filename}:`, err);
      }
    }

    const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
    const safeName = probe.name.replace(/[<>:"/\\|?*]/g, '_').trim();
    const fileName = `${uuidv4()}_${safeName}_фотоальбом.pptx`;
    await writeFile(join(this.generatedDir, fileName), pptxBuffer);

    this.logger.log(`Probe album saved: ${fileName} (${(pptxBuffer.length / 1024 / 1024).toFixed(1)} MB)`);

    return { fileName, downloadUrl: `/generated/${encodeURIComponent(fileName)}` };
  }
}
