import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as exifr from 'exifr';
import * as sharp from 'sharp';
import heicConvert from 'heic-convert';
import { v4 as uuidv4 } from 'uuid';
import { join, extname } from 'path';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_HEIGHT = 300;
const THUMBNAIL_QUALITY = 80;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_PHOTOS_PER_ELEMENT = 4;

const SUPPORTED_MIMES = [
  'image/jpeg', 'image/jpg', 'image/png',
  'image/heic', 'image/heif', 'image/webp',
];
const SUPPORTED_LEGACY_MIMES = [
  ...SUPPORTED_MIMES,
  'application/pdf',
];

interface ExifData {
  latitude?: number;
  longitude?: number;
  dateTime?: Date;
}

@Injectable()
export class GtsPhotosService {
  private readonly logger = new Logger(GtsPhotosService.name);
  private readonly photosDir = join(process.cwd(), 'uploads', 'gts-photos');
  private readonly thumbnailsDir = join(process.cwd(), 'uploads', 'gts-photos', 'thumbnails');
  private readonly legacyDir = join(process.cwd(), 'uploads', 'gts-legacy-media');

  constructor(private prisma: PrismaService) {
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    try {
      if (!existsSync(this.photosDir)) await mkdir(this.photosDir, { recursive: true });
      if (!existsSync(this.thumbnailsDir)) await mkdir(this.thumbnailsDir, { recursive: true });
      if (!existsSync(this.legacyDir)) await mkdir(this.legacyDir, { recursive: true });
    } catch (err) {
      this.logger.error('Error creating GTS photo directories:', err);
    }
  }

  async getPhotosByObject(objectId: string) {
    return this.prisma.gtsPhoto.findMany({
      where: { gtsObjectId: objectId },
      orderBy: { sortOrder: 'asc' },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getPhotosByElement(elementId: string) {
    return this.prisma.gtsPhoto.findMany({
      where: { gtsElementId: elementId },
      orderBy: { sortOrder: 'asc' },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getLegacyMediaByObject(objectId: string) {
    return this.prisma.gtsLegacyMedia.findMany({
      where: { gtsObjectId: objectId },
      orderBy: { uploadedAt: 'asc' },
    });
  }

  async getPhotoById(photoId: string) {
    const photo = await this.prisma.gtsPhoto.findUnique({ where: { id: photoId } });
    if (!photo) throw new NotFoundException('Фото не найдено');
    return photo;
  }

  async uploadPhotos(
    monitoringId: string,
    objectId: string,
    elementId: string,
    files: Express.Multer.File[],
    userId?: string,
  ) {
    const element = await this.prisma.gtsElement.findUnique({ where: { id: elementId } });
    if (!element || element.gtsObjectId !== objectId) {
      throw new NotFoundException('Элемент ГТС не найден');
    }

    const existingCount = await this.prisma.gtsPhoto.count({
      where: { gtsObjectId: objectId, gtsElementId: elementId },
    });
    if (existingCount + files.length > MAX_PHOTOS_PER_ELEMENT) {
      throw new BadRequestException(`Для одного элемента разрешено максимум ${MAX_PHOTOS_PER_ELEMENT} фото`);
    }

    const results = [];
    for (const file of files) {
      try {
        const photo = await this.uploadPhoto(monitoringId, objectId, elementId, file, userId);
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

  async uploadLegacyMedia(
    monitoringId: string,
    objectId: string,
    files: Express.Multer.File[],
  ) {
    const object = await this.prisma.gtsObject.findUnique({ where: { id: objectId } });
    if (!object || object.gtsMonitoringId !== monitoringId) {
      throw new NotFoundException('Объект ГТС не найден');
    }

    const objectDir = join(this.legacyDir, monitoringId);
    if (!existsSync(objectDir)) await mkdir(objectDir, { recursive: true });

    const result = [];
    for (const file of files) {
      const fileSize = file.size || file.buffer.length;
      if (fileSize > MAX_FILE_SIZE) {
        throw new BadRequestException(`Файл слишком большой. Максимум ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      }

      const ext = extname(file.originalname).toLowerCase();
      const extToMime: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.heic': 'image/heic',
        '.heif': 'image/heif',
        '.webp': 'image/webp',
        '.pdf': 'application/pdf',
      };
      let mimetype = file.mimetype?.toLowerCase() || '';
      if (!SUPPORTED_LEGACY_MIMES.includes(mimetype) && extToMime[ext]) mimetype = extToMime[ext];
      if (!SUPPORTED_LEGACY_MIMES.includes(mimetype)) {
        throw new BadRequestException('Разрешены только изображения и PDF');
      }

      let buffer = file.buffer;
      let extension = ext || (mimetype === 'application/pdf' ? '.pdf' : '.jpg');

      const isHeic = mimetype.includes('heic') || mimetype.includes('heif');
      if (isHeic) {
        const converted = await heicConvert({
          buffer: new Uint8Array(buffer).buffer,
          format: 'JPEG',
          quality: 0.92,
        });
        buffer = Buffer.from(converted);
        extension = '.jpg';
        mimetype = 'image/jpeg';
      }

      const filename = `${uuidv4()}${extension}`;
      await writeFile(join(objectDir, filename), buffer);

      const created = await this.prisma.gtsLegacyMedia.create({
        data: {
          gtsMonitoringId: monitoringId,
          gtsObjectId: objectId,
          filename,
          originalName: file.originalname,
          mimeType: mimetype,
        },
      });
      result.push(created);
    }

    return result;
  }

  async getLegacyMediaById(mediaId: string) {
    const media = await this.prisma.gtsLegacyMedia.findUnique({ where: { id: mediaId } });
    if (!media) throw new NotFoundException('Файл не найден');
    return media;
  }

  private async uploadPhoto(
    monitoringId: string,
    objectId: string,
    elementId: string,
    file: Express.Multer.File,
    userId?: string,
  ) {
    const fileSize = file.size || file.buffer.length;
    if (fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException(`Файл слишком большой. Максимум ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    const ext = extname(file.originalname).toLowerCase();
    const extToMime: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.heic': 'image/heic', '.heif': 'image/heif', '.webp': 'image/webp',
    };
    let mimetype = file.mimetype?.toLowerCase() || '';
    if (!SUPPORTED_MIMES.includes(mimetype) && extToMime[ext]) mimetype = extToMime[ext];
    if (!SUPPORTED_MIMES.includes(mimetype)) {
      throw new BadRequestException('Неподдерживаемый формат. Разрешены: JPEG, PNG, HEIC, WebP');
    }

    let buffer = file.buffer;
    let extension = ext;
    const isHeic = mimetype.includes('heic') || mimetype.includes('heif');
    const exifData = await this.extractExif(buffer);

    if (isHeic) {
      const converted = await heicConvert({
        buffer: new Uint8Array(buffer).buffer,
        format: 'JPEG',
        quality: 0.92,
      });
      buffer = Buffer.from(converted);
      extension = '.jpg';
    }

    const filename = `${uuidv4()}${extension}`;
    const thumbnailName = `thumb-${filename.replace(extension, '.jpg')}`;

    const monitoringDir = join(this.photosDir, monitoringId);
    if (!existsSync(monitoringDir)) await mkdir(monitoringDir, { recursive: true });

    await writeFile(join(monitoringDir, filename), buffer);

    try {
      await sharp(buffer)
        .rotate()
        .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, { fit: 'cover', position: 'center' })
        .jpeg({ quality: THUMBNAIL_QUALITY })
        .toFile(join(this.thumbnailsDir, thumbnailName));
    } catch {
      // продолжаем без превью
    }

    const maxOrder = await this.prisma.gtsPhoto.aggregate({
      where: { gtsObjectId: objectId, gtsElementId: elementId },
      _max: { sortOrder: true },
    });
    const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    return this.prisma.gtsPhoto.create({
      data: {
        gtsMonitoringId: monitoringId,
        gtsObjectId: objectId,
        gtsElementId: elementId,
        filename,
        originalName: file.originalname,
        thumbnailName: existsSync(join(this.thumbnailsDir, thumbnailName)) ? thumbnailName : null,
        latitude: exifData.latitude ? exifData.latitude.toFixed(5) : null,
        longitude: exifData.longitude ? exifData.longitude.toFixed(5).padStart(9, '0') : null,
        photoDate: exifData.dateTime || new Date(),
        sortOrder: nextOrder,
        uploadedById: userId,
      },
    });
  }

  async updatePhoto(photoId: string, data: {
    description?: string;
    photoDate?: Date;
    latitude?: string;
    longitude?: string;
  }) {
    await this.getPhotoById(photoId);
    return this.prisma.gtsPhoto.update({ where: { id: photoId }, data });
  }

  async reorderPhotos(objectId: string, elementId: string, orders: { id: string; sortOrder: number }[]) {
    const updates = orders.map((item) =>
      this.prisma.gtsPhoto.updateMany({
        where: { id: item.id, gtsObjectId: objectId, gtsElementId: elementId },
        data: { sortOrder: item.sortOrder },
      }),
    );
    await this.prisma.$transaction(updates);
    return this.getPhotosByElement(elementId);
  }

  async deletePhoto(photoId: string) {
    const photo = await this.getPhotoById(photoId);
    const originalPath = join(this.photosDir, photo.gtsMonitoringId, photo.filename);
    const thumbnailPath = photo.thumbnailName ? join(this.thumbnailsDir, photo.thumbnailName) : null;

    try { await unlink(originalPath); } catch { /* ignore */ }
    if (thumbnailPath) { try { await unlink(thumbnailPath); } catch { /* ignore */ } }

    await this.prisma.gtsPhoto.delete({ where: { id: photoId } });
    return { success: true };
  }

  getOriginalPath(monitoringId: string, filename: string): string {
    return join(this.photosDir, monitoringId, filename);
  }

  getThumbnailPath(thumbnailName: string): string {
    return join(this.thumbnailsDir, thumbnailName);
  }

  getLegacyPath(monitoringId: string, filename: string): string {
    return join(this.legacyDir, monitoringId, filename);
  }

  private async extractExif(buffer: Buffer): Promise<ExifData> {
    const result: ExifData = {};
    try {
      const gps = await exifr.gps(buffer);
      if (gps?.latitude && gps?.longitude) {
        result.latitude = gps.latitude;
        result.longitude = gps.longitude;
      }
    } catch { /* ignore */ }
    try {
      const parsed = await exifr.parse(buffer, { pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'] });
      result.dateTime = parsed?.DateTimeOriginal || parsed?.CreateDate || parsed?.ModifyDate;
    } catch { /* ignore */ }
    return result;
  }
}
