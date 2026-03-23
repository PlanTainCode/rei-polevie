import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GtsPhotosService } from './gts-photos.service';
import { existsSync } from 'fs';
import { writeFile, mkdir, mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { convertDocxToPdf } from '../inquiry-requests/pdf.utils';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PptxGenJS = require('pptxgenjs');

const ALBUM_IMAGE_MAX_WIDTH = 1920;
const ALBUM_IMAGE_MAX_HEIGHT = 1440;
const ALBUM_IMAGE_QUALITY = 85;
const PHOTOS_PER_SLIDE = 6;

@Injectable()
export class GtsPresentationService {
  private readonly logger = new Logger(GtsPresentationService.name);
  private readonly generatedDir = join(process.cwd(), 'generated');

  constructor(
    private prisma: PrismaService,
    private photosService: GtsPhotosService,
  ) {
    if (!existsSync(this.generatedDir)) {
      mkdir(this.generatedDir, { recursive: true }).catch(() => {});
    }
  }

  async generateForObject(objectId: string): Promise<{ filename: string; buffer: Buffer }> {
    const object = await this.prisma.gtsObject.findUnique({
      where: { id: objectId },
      include: { district: true, monitoring: true },
    });
    if (!object) throw new NotFoundException('Объект ГТС не найден');

    const photos = await this.photosService.getPhotosByObject(objectId);
    if (photos.length === 0) throw new NotFoundException('Нет фотографий для генерации альбома');

    const pptxBuffer = await this.buildObjectAlbum(object, photos);

    const safeName = `${object.number}_${object.settlement}`.replace(/[<>:"/\\|?*]/g, '_');
    return { filename: `Фотоальбом_${safeName}.pptx`, buffer: pptxBuffer };
  }

  async generateForDistrict(districtId: string): Promise<{ filename: string; buffer: Buffer }> {
    const district = await this.prisma.gtsDistrict.findUnique({
      where: { id: districtId },
      include: {
        monitoring: true,
        objects: {
          orderBy: { number: 'asc' },
          include: { district: true, monitoring: true },
        },
      },
    });
    if (!district) throw new NotFoundException('Район не найден');

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_4x3';
    let hasSlides = false;

    for (const object of district.objects) {
      const photos = await this.photosService.getPhotosByObject(object.id);
      if (photos.length === 0) continue;

      await this.addObjectSlides(pptx, object, photos);
      hasSlides = true;
    }

    if (!hasSlides) throw new NotFoundException('Нет фотографий в районе');

    const pptxBuffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
    const safeName = district.name.replace(/[<>:"/\\|?*]/g, '_');
    return { filename: `Фотоальбом_${safeName}.pptx`, buffer: pptxBuffer };
  }

  private async buildObjectAlbum(object: any, photos: any[]): Promise<Buffer> {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_4x3';
    await this.addObjectSlides(pptx, object, photos);
    return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  }

  private async addObjectSlides(pptx: any, object: any, photos: any[]) {
    const districtName = object.district?.name || '';
    const gtsTitle = `${districtName}, ГТС на ${object.watercourseName} у ${object.settlement}`;
    const coords = { lat: object.latitude || '', lon: object.longitude || '' };

    for (let i = 0; i < photos.length; i += PHOTOS_PER_SLIDE) {
      const chunk = photos.slice(i, i + PHOTOS_PER_SLIDE);
      const slide = pptx.addSlide();

      slide.addText(`№${object.number}`, {
        x: 0.2, y: 0.15, w: 0.8, h: 0.4,
        fontSize: 12, bold: true, color: '333333',
      });

      slide.addText(gtsTitle, {
        x: 1.0, y: 0.15, w: 6.0, h: 0.4,
        fontSize: 10, color: '333333',
      });

      if (coords.lat || coords.lon) {
        slide.addText(`${coords.lat}`, {
          x: 7.2, y: 0.05, w: 2.5, h: 0.3,
          fontSize: 9, align: 'center', color: '555555',
        });
        slide.addText(`${coords.lon}`, {
          x: 7.2, y: 0.30, w: 2.5, h: 0.3,
          fontSize: 9, align: 'center', color: '555555',
        });
      }

      const cols = 3;
      const rows = 2;
      const startY = 0.7;
      const imgW = 3.1;
      const imgH = 3.2;
      const gapX = 0.15;
      const gapY = 0.15;

      for (let j = 0; j < chunk.length; j++) {
        const photo = chunk[j];
        const col = j % cols;
        const row = Math.floor(j / cols);
        const x = 0.2 + col * (imgW + gapX);
        const y = startY + row * (imgH + gapY);

        const photoPath = this.photosService.getOriginalPath(
          object.gtsMonitoringId || object.monitoring?.id,
          photo.filename,
        );
        if (!existsSync(photoPath)) continue;

        try {
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
            x, y, w: imgW, h: imgH,
            sizing: { type: 'contain', w: imgW, h: imgH },
          });
        } catch (err) {
          this.logger.error(`Error adding image ${photo.filename}:`, err);
        }
      }
    }
  }
}
