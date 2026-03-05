import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MonitoringProbesService {
  private readonly logger = new Logger(MonitoringProbesService.name);

  constructor(private prisma: PrismaService) {}

  async findByMonitoring(monitoringId: string) {
    return this.prisma.monitoringProbe.findMany({
      where: { monitoringId },
      orderBy: { sortOrder: 'asc' },
      include: {
        collectedBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { photos: true } },
      },
    });
  }

  async findById(probeId: string) {
    const probe = await this.prisma.monitoringProbe.findUnique({
      where: { id: probeId },
      include: {
        collectedBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { photos: true } },
      },
    });
    if (!probe) throw new NotFoundException('Проба не найдена');
    return probe;
  }

  async create(monitoringId: string, data: {
    name: string;
    type: 'WATER' | 'SEDIMENT';
    latitude?: string;
    longitude?: string;
    container?: string;
    containerVolume?: string;
    containerCount?: number;
    depth?: string;
  }) {
    const maxOrder = await this.prisma.monitoringProbe.aggregate({
      where: { monitoringId },
      _max: { sortOrder: true },
    });
    const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    return this.prisma.monitoringProbe.create({
      data: {
        monitoringId,
        name: data.name,
        type: data.type,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        container: data.container || null,
        containerVolume: data.containerVolume || null,
        containerCount: data.containerCount || 1,
        depth: data.depth || null,
        sortOrder: nextOrder,
      },
      include: {
        collectedBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { photos: true } },
      },
    });
  }

  async update(probeId: string, data: Record<string, any>) {
    await this.findById(probeId);
    return this.prisma.monitoringProbe.update({
      where: { id: probeId },
      data,
      include: {
        collectedBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { photos: true } },
      },
    });
  }

  async collect(probeId: string, userId: string) {
    await this.findById(probeId);
    return this.prisma.monitoringProbe.update({
      where: { id: probeId },
      data: {
        status: 'COLLECTED',
        collectedAt: new Date(),
        collectedById: userId,
      },
      include: {
        collectedBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { photos: true } },
      },
    });
  }

  async delete(probeId: string) {
    await this.findById(probeId);
    await this.prisma.monitoringProbe.delete({ where: { id: probeId } });
    return { success: true };
  }
}
