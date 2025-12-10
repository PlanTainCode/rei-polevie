import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PhotosService } from './photos.service';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PptxGenJS = require('pptxgenjs');

// Размеры слайда 4:3 в дюймах
const SLIDE_WIDTH = 10;
const SLIDE_HEIGHT = 7.5;

@Injectable()
export class PresentationService {
  private readonly logger = new Logger(PresentationService.name);

  constructor(
    private prisma: PrismaService,
    private photosService: PhotosService,
  ) {}

  /**
   * Генерирует фотоальбом в формате PPTX
   */
  async generatePhotoAlbum(
    projectId: string,
    crewMembers: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
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
          // Читаем файл и конвертируем в base64
          const imageBuffer = await readFile(photoPath);
          const base64 = imageBuffer.toString('base64');
          const ext = photo.filename.split('.').pop()?.toLowerCase() || 'jpg';
          const mimeType = ext === 'png' ? 'png' : 'jpeg';

          // Добавляем фото на весь слайд
          slide.addImage({
            data: `image/${mimeType};base64,${base64}`,
            x: 0,
            y: 0,
            w: SLIDE_WIDTH,
            h: SLIDE_HEIGHT,
            sizing: { type: 'cover', w: SLIDE_WIDTH, h: SLIDE_HEIGHT },
          });
        } catch (err) {
          this.logger.error(`Error adding image ${photo.filename}:`, err);
          // Добавляем placeholder если не удалось загрузить фото
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

    // Генерируем файл
    const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' });

    // Формируем имя файла (используем официальное название)
    const safeName = objectName.replace(/[<>:"/\\|?*]/g, '_').trim();
    const filename = `${safeName}_фотоальбом.pptx`;

    this.logger.log(`Album generated: ${filename}`);

    return {
      buffer: pptxBuffer,
      filename,
    };
  }
}
