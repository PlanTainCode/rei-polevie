import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MaedProtocol, Prisma } from '@prisma/client';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { MaedPoint, parseMaed, summarizeMaed } from './maed-parser';
import { calculateMaedUncertainty, defaultMaedSettings, MaedCalculationSettings, validateMaedSettings, ZYABLIK_SOURCE } from './maed-calculation';

@Injectable()
export class MaedService {
  private readonly directory = join(process.cwd(), 'uploads', 'maed');

  constructor(private readonly prisma: PrismaService) {}

  private async checkAccess(projectId: string, userId: string, write = false) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, company: { members: { some: { userId } } } },
      select: { companyId: true, createdById: true },
    });
    if (!project) throw new NotFoundException('Объект не найден');
    if (write && project.createdById !== userId) {
      const member = await this.prisma.companyMember.findFirst({ where: { userId, companyId: project.companyId } });
      if (!member || !['OWNER', 'ADMIN'].includes(member.role)) throw new ForbiddenException('Нет прав на редактирование объекта');
    }
  }

  private present(protocol: MaedProtocol) {
    const { storedFileName, ...data } = protocol;
    const points = protocol.points as unknown as MaedPoint[];
    const settings = protocol.calculationSettings as unknown as MaedCalculationSettings | null
      ?? defaultMaedSettings(protocol.instrumentName);
    const automatic = calculateMaedUncertainty(points, settings);
    const manual = protocol.uncertainty !== null;
    return {
      ...data, points,
      summary: summarizeMaed(points, manual ? protocol.uncertainty : automatic.uncertainty),
      calculation: {
        ...automatic, settings, method: manual ? 'manual' : 'mr',
        sourceUrl: defaultMaedSettings(protocol.instrumentName) ? ZYABLIK_SOURCE : null,
      },
    };
  }

  async list(projectId: string, userId: string) {
    await this.checkAccess(projectId, userId);
    const protocols = await this.prisma.maedProtocol.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
    return protocols.map((protocol) => this.present(protocol));
  }

  async upload(projectId: string, userId: string, file: Express.Multer.File) {
    await this.checkAccess(projectId, userId, true);
    const parsed = parseMaed(file.buffer);
    const storedFileName = `${randomUUID()}${extname(file.originalname).toLowerCase()}`;
    await mkdir(this.directory, { recursive: true });
    const path = join(this.directory, storedFileName);
    await writeFile(path, file.buffer);
    try {
      const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const protocol = await this.prisma.maedProtocol.create({ data: {
        projectId, protocolNumber: parsed.protocolNumber, measurementDate: parsed.measurementDate,
        instrumentName: parsed.instrumentName,
        calculationSettings: defaultMaedSettings(parsed.instrumentName) as unknown as Prisma.InputJsonValue ?? undefined,
        points: parsed.points as unknown as Prisma.InputJsonValue,
        fileName: decodedName.includes('�') ? file.originalname : decodedName, storedFileName,
      } });
      return this.present(protocol);
    } catch (error) {
      await unlink(path).catch(() => undefined);
      throw error;
    }
  }

  async updateUncertainty(projectId: string, id: string, userId: string, uncertainty: number | null) {
    await this.checkAccess(projectId, userId, true);
    if (uncertainty !== null && (typeof uncertainty !== 'number' || !Number.isFinite(uncertainty) || uncertainty < 0)) {
      throw new BadRequestException('Неопределённость должна быть неотрицательным числом');
    }
    const protocol = await this.prisma.maedProtocol.findFirst({ where: { id, projectId } });
    if (!protocol) throw new NotFoundException('Протокол не найден');
    return this.present(await this.prisma.maedProtocol.update({ where: { id }, data: { uncertainty } }));
  }

  async delete(projectId: string, id: string, userId: string) {
    await this.checkAccess(projectId, userId, true);
    const protocol = await this.prisma.maedProtocol.findFirst({ where: { id, projectId } });
    if (!protocol) throw new NotFoundException('Протокол не найден');
    await this.prisma.maedProtocol.delete({ where: { id } });
    await unlink(join(this.directory, protocol.storedFileName)).catch(() => undefined);
    return { success: true };
  }

  async updateCalculation(projectId: string, id: string, userId: string, settings: MaedCalculationSettings) {
    await this.checkAccess(projectId, userId, true);
    validateMaedSettings(settings);
    const protocol = await this.prisma.maedProtocol.findFirst({ where: { id, projectId } });
    if (!protocol) throw new NotFoundException('Протокол не найден');
    return this.present(await this.prisma.maedProtocol.update({ where: { id }, data: {
      uncertainty: null, calculationSettings: settings as unknown as Prisma.InputJsonValue,
    } }));
  }
}
