import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import * as mammoth from 'mammoth';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MonitoringsService {
  private readonly logger = new Logger(MonitoringsService.name);
  private readonly uploadsDir = join(process.cwd(), 'uploads');

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  private async getCompanyId(userId: string): Promise<string> {
    const membership = await this.prisma.companyMember.findFirst({
      where: { userId },
    });
    if (!membership) throw new ForbiddenException('Вы не состоите в компании');
    return membership.companyId;
  }

  async create(userId: string, data: { name: string; objectName?: string; objectAddress?: string }) {
    const companyId = await this.getCompanyId(userId);
    return this.prisma.monitoring.create({
      data: {
        companyId,
        name: data.name,
        objectName: data.objectName || null,
        objectAddress: data.objectAddress || null,
        createdById: userId,
      },
    });
  }

  async findAll(userId: string) {
    const companyId = await this.getCompanyId(userId);
    return this.prisma.monitoring.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { probes: true, photos: true } },
      },
    });
  }

  async findById(id: string) {
    const monitoring = await this.prisma.monitoring.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { probes: true, photos: true } },
      },
    });
    if (!monitoring) throw new NotFoundException('Мониторинг не найден');
    return monitoring;
  }

  async update(id: string, data: Record<string, any>) {
    await this.findById(id);
    return this.prisma.monitoring.update({
      where: { id },
      data,
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { probes: true, photos: true } },
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.monitoring.delete({ where: { id } });
    return { success: true };
  }

  async uploadTzAndProcess(
    monitoringId: string,
    file: Express.Multer.File,
  ) {
    const monitoring = await this.findById(monitoringId);

    const ext = extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    const filePath = join(this.uploadsDir, uniqueName);

    if (!existsSync(this.uploadsDir)) {
      await mkdir(this.uploadsDir, { recursive: true });
    }
    await writeFile(filePath, file.buffer);

    await this.prisma.monitoring.update({
      where: { id: monitoringId },
      data: {
        tzFileName: file.originalname,
        tzFileUrl: `/uploads/${uniqueName}`,
        status: 'ACTIVE',
      },
    });

    try {
      await this.processDocument(monitoringId, file.buffer);
    } catch (err) {
      this.logger.error(`Ошибка обработки документа мониторинга ${monitoringId}:`, err);
    }

    return this.findById(monitoringId);
  }

  private async processDocument(monitoringId: string, buffer: Buffer) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const rawText = result.value;

      const extraction = await this.aiService.extractMonitoringProbes(rawText);
      const { probes, customerName } = extraction;

      await this.prisma.monitoring.update({
        where: { id: monitoringId },
        data: {
          extractedData: { probes, customerName } as any,
          processedAt: new Date(),
          ...(customerName ? { customerName } : {}),
        },
      });

      if (probes.length > 0) {
        const probeData = probes.map((probe, index) => ({
          monitoringId,
          name: probe.name,
          type: probe.type as any,
          latitude: probe.latitude || null,
          longitude: probe.longitude || null,
          sortOrder: index,
        }));

        await this.prisma.monitoringProbe.createMany({ data: probeData });
      }

      this.logger.log(`Обработано ${probes.length} проб для мониторинга ${monitoringId}, заказчик: "${customerName}"`);
    } catch (err) {
      this.logger.error(`Ошибка извлечения проб: ${err}`);
      await this.prisma.monitoring.update({
        where: { id: monitoringId },
        data: { extractedData: { error: String(err) } as any },
      });
    }
  }
}
