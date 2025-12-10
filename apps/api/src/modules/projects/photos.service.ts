import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as exifr from 'exifr';
import * as sharp from 'sharp';
import heicConvert from 'heic-convert';
import { v4 as uuidv4 } from 'uuid';
import { join, extname } from 'path';
import { mkdir, unlink, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AdmZip = require('adm-zip');

// Размеры превью
const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_HEIGHT = 300;
const THUMBNAIL_QUALITY = 80;

// Лимиты
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// Поддерживаемые форматы
const SUPPORTED_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
];

interface ExifData {
  latitude?: number;
  longitude?: number;
  dateTime?: Date;
}

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);
  private readonly photosDir = join(process.cwd(), 'uploads', 'photos');
  private readonly thumbnailsDir = join(process.cwd(), 'uploads', 'photos', 'thumbnails');

  constructor(private prisma: PrismaService) {
    // Создаём директории при запуске
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    try {
      if (!existsSync(this.photosDir)) {
        await mkdir(this.photosDir, { recursive: true });
      }
      if (!existsSync(this.thumbnailsDir)) {
        await mkdir(this.thumbnailsDir, { recursive: true });
      }
    } catch (err) {
      this.logger.error('Error creating photo directories:', err);
    }
  }

  /**
   * Получает все фото проекта
   */
  async getPhotosByProject(projectId: string) {
    return this.prisma.photo.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Получает фото по ID
   */
  async getPhotoById(photoId: string) {
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      throw new NotFoundException('Фото не найдено');
    }

    return photo;
  }

  /**
   * Загружает фото для проекта
   * Поддерживает загрузку из файла или из Buffer (для Telegram)
   */
  async uploadPhoto(
    projectId: string,
    file: Express.Multer.File | { buffer: Buffer; originalname: string; mimetype: string },
    userId?: string,
  ) {
    // Проверяем размер
    const fileSize = 'size' in file ? file.size : file.buffer.length;
    if (fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException(`Файл слишком большой. Максимум ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Проверяем формат
    const mimetype = file.mimetype.toLowerCase();
    if (!SUPPORTED_MIMES.includes(mimetype)) {
      throw new BadRequestException('Неподдерживаемый формат. Разрешены: JPEG, PNG, HEIC, WebP');
    }

    // Получаем buffer
    let buffer: Buffer;
    if ('buffer' in file && file.buffer) {
      buffer = file.buffer;
    } else if ('path' in file) {
      // Multer сохранил на диск — читаем
      const fs = await import('fs/promises');
      buffer = await fs.readFile((file as Express.Multer.File).path);
    } else {
      throw new BadRequestException('Не удалось прочитать файл');
    }

    // Определяем расширение
    let extension = extname(file.originalname).toLowerCase();
    const isHeic = mimetype.includes('heic') || mimetype.includes('heif') || 
                   extension === '.heic' || extension === '.heif';

    // Извлекаем EXIF до конвертации
    const exifData = await this.extractExif(buffer);
    this.logger.log(`EXIF extracted: lat=${exifData.latitude}, lon=${exifData.longitude}, date=${exifData.dateTime}`);

    // Конвертируем HEIC в JPEG для хранения
    if (isHeic) {
      try {
        const converted = await heicConvert({
          buffer: new Uint8Array(buffer).buffer,
          format: 'JPEG',
          quality: 0.92,
        });
        buffer = Buffer.from(converted);
        extension = '.jpg';
        this.logger.log('HEIC converted to JPEG');
      } catch (err) {
        this.logger.error('Error converting HEIC:', err);
        throw new BadRequestException('Не удалось конвертировать HEIC файл');
      }
    }

    // Генерируем уникальное имя файла
    const filename = `${uuidv4()}${extension}`;
    const thumbnailName = `thumb-${filename.replace(extension, '.jpg')}`;

    // Создаём директорию проекта если нужно
    const projectDir = join(this.photosDir, projectId);
    if (!existsSync(projectDir)) {
      await mkdir(projectDir, { recursive: true });
    }

    // Сохраняем оригинал
    const originalPath = join(projectDir, filename);
    await writeFile(originalPath, buffer);
    this.logger.log(`Original saved: ${originalPath}`);

    // Создаём превью
    const thumbnailPath = join(this.thumbnailsDir, thumbnailName);
    try {
      await sharp(buffer)
        .rotate() // Автоматически поворачивает согласно EXIF ориентации
        .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: THUMBNAIL_QUALITY })
        .toFile(thumbnailPath);
      this.logger.log(`Thumbnail saved: ${thumbnailPath}`);
    } catch (err) {
      this.logger.error('Error creating thumbnail:', err);
      // Продолжаем без превью
    }

    // Определяем следующий sortOrder
    const maxOrder = await this.prisma.photo.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    });
    const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    // Форматируем координаты
    const latitude = exifData.latitude 
      ? exifData.latitude.toFixed(5) 
      : null;
    const longitude = exifData.longitude 
      ? exifData.longitude.toFixed(5).padStart(9, '0')
      : null;

    // Сохраняем в БД
    const photo = await this.prisma.photo.create({
      data: {
        projectId,
        filename,
        originalName: file.originalname,
        thumbnailName: existsSync(thumbnailPath) ? thumbnailName : null,
        latitude,
        longitude,
        photoDate: exifData.dateTime || new Date(),
        sortOrder: nextOrder,
        uploadedById: userId,
      },
    });

    return photo;
  }

  /**
   * Загружает несколько фото
   */
  async uploadPhotos(
    projectId: string,
    files: (Express.Multer.File | { buffer: Buffer; originalname: string; mimetype: string })[],
    userId?: string,
  ) {
    const results = [];
    
    for (const file of files) {
      try {
        const photo = await this.uploadPhoto(projectId, file, userId);
        results.push({ success: true, photo });
      } catch (err) {
        results.push({ 
          success: false, 
          error: err instanceof Error ? err.message : 'Unknown error',
          filename: file.originalname,
        });
      }
    }

    return results;
  }

  /**
   * Обновляет данные фото
   */
  async updatePhoto(
    photoId: string,
    data: {
      description?: string;
      photoDate?: Date;
      latitude?: string;
      longitude?: string;
    },
  ) {
    const photo = await this.getPhotoById(photoId);

    return this.prisma.photo.update({
      where: { id: photo.id },
      data: {
        description: data.description,
        photoDate: data.photoDate,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });
  }

  /**
   * Изменяет порядок фото
   */
  async reorderPhotos(projectId: string, orders: { id: string; sortOrder: number }[]) {
    const updates = orders.map((item) =>
      this.prisma.photo.updateMany({
        where: { id: item.id, projectId },
        data: { sortOrder: item.sortOrder },
      }),
    );

    await this.prisma.$transaction(updates);

    return this.getPhotosByProject(projectId);
  }

  /**
   * Удаляет фото
   */
  async deletePhoto(photoId: string) {
    const photo = await this.getPhotoById(photoId);

    // Удаляем файлы
    const originalPath = join(this.photosDir, photo.projectId, photo.filename);
    const thumbnailPath = photo.thumbnailName 
      ? join(this.thumbnailsDir, photo.thumbnailName)
      : null;

    try {
      await unlink(originalPath);
    } catch {
      this.logger.warn(`Could not delete original: ${originalPath}`);
    }

    if (thumbnailPath) {
      try {
        await unlink(thumbnailPath);
      } catch {
        this.logger.warn(`Could not delete thumbnail: ${thumbnailPath}`);
      }
    }

    // Удаляем из БД
    await this.prisma.photo.delete({
      where: { id: photoId },
    });

    return { success: true };
  }

  /**
   * Получает путь к оригиналу
   */
  getOriginalPath(projectId: string, filename: string): string {
    return join(this.photosDir, projectId, filename);
  }

  /**
   * Получает путь к превью
   */
  getThumbnailPath(thumbnailName: string): string {
    return join(this.thumbnailsDir, thumbnailName);
  }

  /**
   * Извлекает EXIF данные из фото
   */
  private async extractExif(buffer: Buffer): Promise<ExifData> {
    const result: ExifData = {};

    try {
      // Пробуем извлечь GPS
      const gps = await exifr.gps(buffer);
      if (gps?.latitude && gps?.longitude) {
        result.latitude = gps.latitude;
        result.longitude = gps.longitude;
      }
    } catch (err) {
      this.logger.warn('Could not extract GPS from EXIF:', err);
    }

    try {
      // Пробуем извлечь дату
      const parsed = await exifr.parse(buffer, {
        pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'],
      });
      
      result.dateTime = parsed?.DateTimeOriginal || parsed?.CreateDate || parsed?.ModifyDate;
    } catch (err) {
      this.logger.warn('Could not extract date from EXIF:', err);
    }

    return result;
  }

  /**
   * Получает количество фото в проекте
   */
  async getPhotosCount(projectId: string): Promise<number> {
    return this.prisma.photo.count({
      where: { projectId },
    });
  }

  /**
   * Формирует имя файла для скачивания
   * Формат: "Название объекта_001.jpg"
   */
  getDownloadFilename(projectName: string, index: number, extension: string): string {
    // Убираем спецсимволы из имени проекта
    const safeName = projectName.replace(/[<>:"/\\|?*]/g, '_').trim();
    const paddedIndex = String(index).padStart(3, '0');
    return `${safeName}_${paddedIndex}${extension}`;
  }

  /**
   * Создаёт ZIP-архив всех фото проекта
   */
  async createPhotosArchive(projectId: string, projectName: string): Promise<{ buffer: Buffer; filename: string }> {
    const photos = await this.getPhotosByProject(projectId);
    
    if (photos.length === 0) {
      throw new NotFoundException('Нет фотографий для скачивания');
    }

    const zip = new AdmZip();
    
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const originalPath = this.getOriginalPath(projectId, photo.filename);
      
      if (existsSync(originalPath)) {
        const fileBuffer = await readFile(originalPath);
        const extension = extname(photo.filename);
        const downloadName = this.getDownloadFilename(projectName, i + 1, extension);
        
        zip.addFile(downloadName, fileBuffer);
      }
    }

    const safeName = projectName.replace(/[<>:"/\\|?*]/g, '_').trim();
    
    return {
      buffer: zip.toBuffer(),
      filename: `${safeName}_фотоальбом.zip`,
    };
  }
}
