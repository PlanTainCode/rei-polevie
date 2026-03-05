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

const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_HEIGHT = 300;
const THUMBNAIL_QUALITY = 80;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const SUPPORTED_MIMES = [
  'image/jpeg', 'image/jpg', 'image/png',
  'image/heic', 'image/heif', 'image/webp',
];

interface ExifData {
  latitude?: number;
  longitude?: number;
  dateTime?: Date;
}

@Injectable()
export class MonitoringPhotosService {
  private readonly logger = new Logger(MonitoringPhotosService.name);
  private readonly photosDir = join(process.cwd(), 'uploads', 'monitoring-photos');
  private readonly thumbnailsDir = join(process.cwd(), 'uploads', 'monitoring-photos', 'thumbnails');

  constructor(private prisma: PrismaService) {
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    try {
      if (!existsSync(this.photosDir)) await mkdir(this.photosDir, { recursive: true });
      if (!existsSync(this.thumbnailsDir)) await mkdir(this.thumbnailsDir, { recursive: true });
    } catch (err) {
      this.logger.error('Error creating monitoring photo directories:', err);
    }
  }

  async getPhotosByProbe(probeId: string) {
    return this.prisma.monitoringPhoto.findMany({
      where: { probeId },
      orderBy: { sortOrder: 'asc' },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getAllPhotosByMonitoring(monitoringId: string) {
    return this.prisma.monitoringPhoto.findMany({
      where: { monitoringId },
      orderBy: { sortOrder: 'asc' },
      include: {
        probe: { select: { id: true, name: true, type: true } },
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getPhotoById(photoId: string) {
    const photo = await this.prisma.monitoringPhoto.findUnique({ where: { id: photoId } });
    if (!photo) throw new NotFoundException('Фото не найдено');
    return photo;
  }

  async uploadPhoto(
    monitoringId: string,
    probeId: string,
    file: Express.Multer.File | { buffer: Buffer; originalname: string; mimetype: string },
    userId?: string,
  ) {
    const fileSize = 'size' in file ? file.size : file.buffer.length;
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
      throw new BadRequestException(`Неподдерживаемый формат. Разрешены: JPEG, PNG, HEIC, WebP`);
    }

    let buffer: Buffer;
    if ('buffer' in file && file.buffer) {
      buffer = file.buffer;
    } else if ('path' in file) {
      const fs = await import('fs/promises');
      buffer = await fs.readFile((file as Express.Multer.File).path);
    } else {
      throw new BadRequestException('Не удалось прочитать файл');
    }

    let extension = ext || extname(file.originalname).toLowerCase();
    const isHeic = mimetype.includes('heic') || mimetype.includes('heif');
    const exifData = await this.extractExif(buffer);

    if (isHeic) {
      try {
        const converted = await heicConvert({
          buffer: new Uint8Array(buffer).buffer,
          format: 'JPEG',
          quality: 0.92,
        });
        buffer = Buffer.from(converted);
        extension = '.jpg';
      } catch (err) {
        throw new BadRequestException('Не удалось конвертировать HEIC файл');
      }
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

    const maxOrder = await this.prisma.monitoringPhoto.aggregate({
      where: { probeId },
      _max: { sortOrder: true },
    });
    const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    return this.prisma.monitoringPhoto.create({
      data: {
        monitoringId,
        probeId,
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

  async uploadPhotos(
    monitoringId: string,
    probeId: string,
    files: Express.Multer.File[],
    userId?: string,
  ) {
    const results = [];
    for (const file of files) {
      try {
        const photo = await this.uploadPhoto(monitoringId, probeId, file, userId);
        results.push({ success: true, photo });
      } catch (err) {
        results.push({ success: false, error: err instanceof Error ? err.message : 'Unknown error', filename: file.originalname });
      }
    }
    return results;
  }

  async updatePhoto(photoId: string, data: { description?: string; photoDate?: Date; latitude?: string; longitude?: string }) {
    await this.getPhotoById(photoId);
    return this.prisma.monitoringPhoto.update({ where: { id: photoId }, data });
  }

  async reorderPhotos(probeId: string, orders: { id: string; sortOrder: number }[]) {
    const updates = orders.map((item) =>
      this.prisma.monitoringPhoto.updateMany({
        where: { id: item.id, probeId },
        data: { sortOrder: item.sortOrder },
      }),
    );
    await this.prisma.$transaction(updates);
    return this.getPhotosByProbe(probeId);
  }

  async getPhotosByPointName(monitoringId: string, pointName: string) {
    const probes = await this.prisma.monitoringProbe.findMany({
      where: { monitoringId, name: pointName },
      select: { id: true },
    });
    const probeIds = probes.map((p) => p.id);
    return this.prisma.monitoringPhoto.findMany({
      where: { monitoringId, probeId: { in: probeIds } },
      orderBy: { sortOrder: 'asc' },
      include: {
        probe: { select: { id: true, name: true, type: true } },
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async reorderPointPhotos(monitoringId: string, pointName: string, orders: { id: string; sortOrder: number }[]) {
    const probes = await this.prisma.monitoringProbe.findMany({
      where: { monitoringId, name: pointName },
      select: { id: true },
    });
    const probeIds = new Set(probes.map((p) => p.id));
    const updates = orders.map((item) =>
      this.prisma.monitoringPhoto.updateMany({
        where: { id: item.id, probeId: { in: [...probeIds] } },
        data: { sortOrder: item.sortOrder },
      }),
    );
    await this.prisma.$transaction(updates);
    return this.getPhotosByPointName(monitoringId, pointName);
  }

  async createPointPhotosArchive(monitoringId: string, pointName: string) {
    const photos = await this.getPhotosByPointName(monitoringId, pointName);
    if (photos.length === 0) throw new NotFoundException('Нет фотографий');

    const zip = new AdmZip();
    const safeName = pointName.replace(/[<>:"/\\|?*]/g, '_').trim();

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const originalPath = this.getOriginalPath(monitoringId, photo.filename);
      if (existsSync(originalPath)) {
        const fileBuffer = await readFile(originalPath);
        const ext = extname(photo.filename);
        zip.addFile(`${safeName}/${safeName}_${String(i + 1).padStart(3, '0')}${ext}`, fileBuffer);
      }
    }

    return { buffer: zip.toBuffer(), filename: `${safeName}_фото.zip` };
  }

  async deletePhoto(photoId: string) {
    const photo = await this.getPhotoById(photoId);
    const originalPath = join(this.photosDir, photo.monitoringId, photo.filename);
    const thumbnailPath = photo.thumbnailName ? join(this.thumbnailsDir, photo.thumbnailName) : null;

    try { await unlink(originalPath); } catch { /* ignore */ }
    if (thumbnailPath) { try { await unlink(thumbnailPath); } catch { /* ignore */ } }

    await this.prisma.monitoringPhoto.delete({ where: { id: photoId } });
    return { success: true };
  }

  getOriginalPath(monitoringId: string, filename: string): string {
    return join(this.photosDir, monitoringId, filename);
  }

  getThumbnailPath(thumbnailName: string): string {
    return join(this.thumbnailsDir, thumbnailName);
  }

  async createProbePhotosArchive(monitoringId: string, probeId: string, probeName: string) {
    const photos = await this.getPhotosByProbe(probeId);
    if (photos.length === 0) throw new NotFoundException('Нет фотографий');

    const zip = new AdmZip();
    const safeName = probeName.replace(/[<>:"/\\|?*]/g, '_').trim();

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const originalPath = this.getOriginalPath(monitoringId, photo.filename);
      if (existsSync(originalPath)) {
        const fileBuffer = await readFile(originalPath);
        const ext = extname(photo.filename);
        zip.addFile(`${safeName}/${safeName}_${String(i + 1).padStart(3, '0')}${ext}`, fileBuffer);
      }
    }

    return { buffer: zip.toBuffer(), filename: `${safeName}_фото.zip` };
  }

  async createAllPhotosArchive(monitoringId: string) {
    const probes = await this.prisma.monitoringProbe.findMany({
      where: { monitoringId },
      orderBy: { sortOrder: 'asc' },
    });

    const allPhotos = await this.prisma.monitoringPhoto.findMany({
      where: { monitoringId },
      orderBy: { sortOrder: 'asc' },
      include: { probe: { select: { name: true } } },
    });

    if (allPhotos.length === 0) throw new NotFoundException('Нет фотографий');

    const zip = new AdmZip();
    const probePhotoCounters: Record<string, number> = {};

    for (const photo of allPhotos) {
      const probeName = photo.probe.name.replace(/[<>:"/\\|?*]/g, '_').trim();
      probePhotoCounters[probeName] = (probePhotoCounters[probeName] || 0) + 1;
      const idx = String(probePhotoCounters[probeName]).padStart(3, '0');
      const originalPath = this.getOriginalPath(monitoringId, photo.filename);
      if (existsSync(originalPath)) {
        const fileBuffer = await readFile(originalPath);
        const ext = extname(photo.filename);
        zip.addFile(`${probeName}/${probeName}_${idx}${ext}`, fileBuffer);
      }
    }

    const monitoring = await this.prisma.monitoring.findUnique({ where: { id: monitoringId } });
    const safeName = (monitoring?.name || 'monitoring').replace(/[<>:"/\\|?*]/g, '_').trim();

    return { buffer: zip.toBuffer(), filename: `${safeName}_все_фото.zip` };
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
