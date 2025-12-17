import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { writeFile, mkdir, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import * as mammoth from 'mammoth';

interface UpdateProgramIeiDto {
  cadastralNumber?: string;
  egrnDescription?: string;
  nearbySouth?: string;
  nearbyEast?: string;
  nearbyWest?: string;
  nearbyNorth?: string;
  section82Text?: string;
}

@Injectable()
export class ProgramIeiService {
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'program-iei');

  constructor(private prisma: PrismaService) {}

  /**
   * Получить или создать запись программы ИЭИ для проекта
   */
  async getOrCreate(projectId: string) {
    let programIei = await this.prisma.programIei.findUnique({
      where: { projectId },
    });

    if (!programIei) {
      programIei = await this.prisma.programIei.create({
        data: { projectId },
      });
    }

    // Автозаполняем координаты из ТЗ (для ссылки на Яндекс.Карты), если они ещё не сохранены
    programIei = await this.ensureCoordinatesFromTz(projectId, programIei);

    return programIei;
  }

  /**
   * Получить данные программы ИЭИ
   */
  async get(projectId: string) {
    return this.getOrCreate(projectId);
  }

  /**
   * Обновить текстовые данные (кадастр, описание ЕГРН)
   */
  async update(projectId: string, data: UpdateProgramIeiDto) {
    await this.getOrCreate(projectId);

    return this.prisma.programIei.update({
      where: { projectId },
      data: {
        cadastralNumber: data.cadastralNumber,
        egrnDescription: data.egrnDescription,
        nearbySouth: data.nearbySouth,
        nearbyEast: data.nearbyEast,
        nearbyWest: data.nearbyWest,
        nearbyNorth: data.nearbyNorth,
        section82Text: data.section82Text,
      },
    });
  }

  private extractFirstCoordinatesPair(rawText: string): { lat: string; lon: string } | null {
    const text = String(rawText || '');

    const toNum = (s: string) => Number(String(s).replace(',', '.'));

    const isLat = (n: number) => Number.isFinite(n) && n >= 40 && n <= 70;
    const isLon = (n: number) => Number.isFinite(n) && n >= 20 && n <= 60;

    // 0) Табличный формат как в ТЗ: "№ точки <tab> 55.xxxxx, 37.xxxxx"
    // Берём первую валидную пару широта/долгота.
    {
      const re = /(?:^|\n)\s*\d+\s+(\d{2}[.,]\d{3,})\s*,\s*(\d{2}[.,]\d{3,})/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const lat = toNum(m[1]);
        const lon = toNum(m[2]);
        if (isLat(lat) && isLon(lon)) {
          return { lat: String(lat), lon: String(lon) };
        }
      }
    }

    // 1) Быстрый путь: координаты записаны рядом (в одной строке/ячейке)
    {
      const re = /(?<!\d)(\d{2}[.,]\d{3,})(?:\s*[,;]\s*|\s+)(\d{2}[.,]\d{3,})(?!\d)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const a = toNum(m[1]);
        const b = toNum(m[2]);
        if (!Number.isFinite(a) || !Number.isFinite(b)) continue;

        // пытаемся понять где широта/долгота
        if (isLat(a) && isLon(b)) return { lat: String(a), lon: String(b) };
        if (isLon(a) && isLat(b)) return { lat: String(b), lon: String(a) };
      }
    }

    // 2) Табличный случай: координаты могут быть разнесены по столбцам/строке,
    // между ними встречаются номера точек и др. значения → ищем пару в окне следующих N чисел.
    {
      const tokens = Array.from(text.matchAll(/(?<!\d)(\d{2}[.,]\d{3,})(?!\d)/g)).map((m) =>
        toNum(m[1]),
      );

      for (let i = 0; i < tokens.length; i += 1) {
        const a = tokens[i];
        if (!Number.isFinite(a)) continue;

        for (let j = i + 1; j < Math.min(tokens.length, i + 6); j += 1) {
          const b = tokens[j];
          if (!Number.isFinite(b)) continue;

          if (isLat(a) && isLon(b)) return { lat: String(a), lon: String(b) };
          if (isLon(a) && isLat(b)) return { lat: String(b), lon: String(a) };
        }
      }
    }

    return null;
  }

  private async ensureCoordinatesFromTz(projectId: string, programIei: any) {
    const hasCoords = Boolean(programIei?.coordinatesLat?.trim()) && Boolean(programIei?.coordinatesLon?.trim());
    if (hasCoords) return programIei;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { tzFileUrl: true },
    });

    if (!project?.tzFileUrl) return programIei;

    try {
      const tzPath = join(process.cwd(), 'uploads', project.tzFileUrl);
      const buffer = await readFile(tzPath);
      const tzResult = await mammoth.extractRawText({ buffer });
      const coords = this.extractFirstCoordinatesPair(tzResult.value);
      if (!coords) return programIei;

      try {
        return await this.prisma.programIei.update({
          where: { projectId },
          data: {
            coordinatesLat: coords.lat,
            coordinatesLon: coords.lon,
          },
        });
      } catch (e) {
        // Даже если не удалось сохранить (например, БД не мигрирована),
        // всё равно возвращаем координаты в ответе, чтобы UI мог построить ссылку.
        return {
          ...programIei,
          coordinatesLat: coords.lat,
          coordinatesLon: coords.lon,
        };
      }
    } catch {
      return programIei;
    }
  }

  /**
   * Загрузить обзорную схему (п.1.9.4)
   */
  async uploadOverviewImage(
    projectId: string,
    file: Express.Multer.File,
  ) {
    if (!file || !file.buffer) {
      throw new Error('Файл не получен');
    }

    await this.getOrCreate(projectId);

    // Создаём папку если не существует
    await mkdir(this.uploadsDir, { recursive: true });

    // Генерируем имя файла
    const ext = file.originalname.split('.').pop() || 'jpg';
    const fileName = `overview-${projectId}-${randomUUID()}.${ext}`;
    const filePath = join(this.uploadsDir, fileName);

    // Сохраняем файл
    await writeFile(filePath, file.buffer);

    // Получаем текущую запись для удаления старого файла
    const current = await this.prisma.programIei.findUnique({
      where: { projectId },
    });

    // Удаляем старый файл если есть
    if (current?.overviewImageName) {
      const oldPath = join(this.uploadsDir, current.overviewImageName);
      if (existsSync(oldPath)) {
        await unlink(oldPath).catch(() => {});
      }
    }

    // Обновляем запись
    return this.prisma.programIei.update({
      where: { projectId },
      data: {
        overviewImageName: fileName,
        overviewImageUrl: `/uploads/program-iei/${fileName}`,
      },
    });
  }

  /**
   * Удалить обзорную схему
   */
  async deleteOverviewImage(projectId: string) {
    const programIei = await this.prisma.programIei.findUnique({
      where: { projectId },
    });

    if (!programIei) {
      throw new NotFoundException('Программа ИЭИ не найдена');
    }

    if (programIei.overviewImageName) {
      const filePath = join(this.uploadsDir, programIei.overviewImageName);
      if (existsSync(filePath)) {
        await unlink(filePath).catch(() => {});
      }
    }

    return this.prisma.programIei.update({
      where: { projectId },
      data: {
        overviewImageName: null,
        overviewImageUrl: null,
      },
    });
  }

  /**
   * Сохранить данные о сгенерированном файле
   */
  async saveGeneratedFile(
    projectId: string,
    fileName: string,
    fileUrl: string,
  ) {
    await this.getOrCreate(projectId);

    return this.prisma.programIei.update({
      where: { projectId },
      data: {
        generatedFileName: fileName,
        generatedFileUrl: fileUrl,
        generatedAt: new Date(),
      },
    });
  }
}
