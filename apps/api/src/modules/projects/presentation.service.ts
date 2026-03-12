import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PhotosService } from './photos.service';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as sharp from 'sharp';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PptxGenJS = require('pptxgenjs');

// Размеры слайда 4:3 в дюймах
const SLIDE_WIDTH = 10;
const SLIDE_HEIGHT = 7.5;

// Макс. размер фото для PPTX (достаточно для 10"x7.5" слайда при 150 DPI)
const ALBUM_IMAGE_MAX_WIDTH = 1920;
const ALBUM_IMAGE_MAX_HEIGHT = 1440;
const ALBUM_IMAGE_QUALITY = 80;

@Injectable()
export class PresentationService {
  private readonly logger = new Logger(PresentationService.name);
  private readonly generatedDir = join(process.cwd(), 'generated');

  constructor(
    private prisma: PrismaService,
    private photosService: PhotosService,
  ) {
    if (!existsSync(this.generatedDir)) {
      mkdir(this.generatedDir, { recursive: true }).catch(() => {});
    }
  }

  async generatePhotoAlbum(
    projectId: string,
    crewMembers: string,
  ): Promise<{ fileName: string; downloadUrl: string }> {
    // Получаем данные проекта
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Проект не найден');
    }

    // Получаем фотографии
    const photos = await this.photosService.getPhotosByProject(projectId);

    if (photos.length === 0) {
      throw new NotFoundException('Нет фотографий для генерации альбома');
    }

    // Используем официальное название объекта из ТЗ/поручения
    const objectName = project.objectName || project.name;
    
    this.logger.log(`Generating album for project "${objectName}" with ${photos.length} photos`);

    // Создаём презентацию
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_4x3';
    pptx.author = 'Polevie';
    pptx.title = objectName;
    pptx.subject = 'Фотоальбом';

    // === Титульный слайд ===
    const titleSlide = pptx.addSlide();
    
    // Заголовок — официальное название объекта
    titleSlide.addText(objectName, {
      x: 0.5,
      y: 1,
      w: SLIDE_WIDTH - 1,
      h: 3.5,
      fontSize: 36,
      fontFace: 'Arial',
      color: '000000',
      align: 'center',
      valign: 'middle',
      wrap: true,
    });

    // Дата выезда (берём из первого фото)
    const firstPhotoDate = photos[0]?.photoDate 
      ? new Date(photos[0].photoDate).toLocaleDateString('ru-RU')
      : new Date().toLocaleDateString('ru-RU');

    // Подзаголовок — состав ПБ и дата
    titleSlide.addText([
      { text: 'Состав ПБ: ', options: { bold: false } },
      { text: crewMembers, options: { bold: false } },
      { text: '\n' + firstPhotoDate, options: { bold: false } },
    ], {
      x: 5,
      y: 5.5,
      w: 4.5,
      h: 1.5,
      fontSize: 18,
      fontFace: 'Arial',
      color: '666666',
      align: 'right',
      valign: 'top',
    });

    // === Слайды с фотографиями ===
    for (const photo of photos) {
      const slide = pptx.addSlide();

      // Путь к файлу фото
      const photoPath = this.photosService.getOriginalPath(projectId, photo.filename);

      if (existsSync(photoPath)) {
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
            x: 0,
            y: 0,
            w: SLIDE_WIDTH,
            h: SLIDE_HEIGHT,
            sizing: { type: 'cover', w: SLIDE_WIDTH, h: SLIDE_HEIGHT },
          });
        } catch (err) {
          this.logger.error(`Error adding image ${photo.filename}:`, err);
          slide.addText('Фото не найдено', {
            x: 0,
            y: 3,
            w: SLIDE_WIDTH,
            h: 1.5,
            fontSize: 24,
            color: '999999',
            align: 'center',
          });
        }
      }

      // Формируем текст с координатами и датой
      const coordParts: string[] = [];
      
      if (photo.latitude && photo.longitude) {
        coordParts.push(`${photo.latitude}; ${photo.longitude}`);
      }
      
      if (photo.photoDate) {
        coordParts.push(new Date(photo.photoDate).toLocaleDateString('ru-RU'));
      }

      if (coordParts.length > 0) {
        // Текст координат — жёлтый с тенью, справа внизу
        slide.addText(coordParts.join('  '), {
          x: 5,
          y: 6.5,
          w: 4.8,
          h: 0.7,
          fontSize: 18,
          fontFace: 'Times New Roman',
          color: 'FFFF00',
          align: 'right',
          valign: 'middle',
          shadow: {
            type: 'outer',
            blur: 3,
            offset: 2,
            angle: 45,
            color: '000000',
            opacity: 0.5,
          },
        });
      }

      // Описание в заметках слайда
      if (photo.description) {
        slide.addNotes(photo.description);
      }
    }

    const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' });

    const safeName = objectName.replace(/[<>:"/\\|?*]/g, '_').trim().slice(0, 80);
    const fileName = `${uuidv4()}_${safeName}_фотоальбом.pptx`;
    const filePath = join(this.generatedDir, fileName);
    await writeFile(filePath, pptxBuffer);

    this.logger.log(`Album saved: ${fileName} (${(pptxBuffer.length / 1024 / 1024).toFixed(1)} MB)`);

    return {
      fileName,
      downloadUrl: `/generated/${encodeURIComponent(fileName)}`,
    };
  }
}
