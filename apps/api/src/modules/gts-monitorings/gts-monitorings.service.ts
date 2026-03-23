import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GtsMonitoringsService {
  private readonly logger = new Logger(GtsMonitoringsService.name);

  constructor(private prisma: PrismaService) {}

  private async getCompanyId(userId: string): Promise<string> {
    const membership = await this.prisma.companyMember.findFirst({
      where: { userId },
    });
    if (!membership) throw new ForbiddenException('Вы не состоите в компании');
    return membership.companyId;
  }

  // ========== МОНИТОРИНГИ ==========

  async create(userId: string, data: { name: string; year: number }) {
    const companyId = await this.getCompanyId(userId);
    return this.prisma.gtsMonitoring.create({
      data: {
        companyId,
        name: data.name,
        year: data.year,
        createdById: userId,
      },
    });
  }

  async findAll(userId: string) {
    const companyId = await this.getCompanyId(userId);
    return this.prisma.gtsMonitoring.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { districts: true, objects: true, photos: true } },
      },
    });
  }

  async findById(id: string) {
    const monitoring = await this.prisma.gtsMonitoring.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { districts: true, objects: true, photos: true } },
      },
    });
    if (!monitoring) throw new NotFoundException('Мониторинг ГТС не найден');
    return monitoring;
  }

  async update(id: string, data: Record<string, any>) {
    await this.findById(id);
    return this.prisma.gtsMonitoring.update({
      where: { id },
      data,
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { districts: true, objects: true, photos: true } },
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.gtsMonitoring.delete({ where: { id } });
    return { success: true };
  }

  // ========== РАЙОНЫ ==========

  async getDistricts(monitoringId: string) {
    return this.prisma.gtsDistrict.findMany({
      where: { gtsMonitoringId: monitoringId },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { objects: true } },
      },
    });
  }

  async getDistrictById(districtId: string) {
    const district = await this.prisma.gtsDistrict.findUnique({
      where: { id: districtId },
      include: { _count: { select: { objects: true } } },
    });
    if (!district) throw new NotFoundException('Район не найден');
    return district;
  }

  // ========== ОБЪЕКТЫ ==========

  async getObjects(monitoringId: string, districtId?: string) {
    return this.prisma.gtsObject.findMany({
      where: {
        gtsMonitoringId: monitoringId,
        ...(districtId ? { gtsDistrictId: districtId } : {}),
      },
      orderBy: { number: 'asc' },
      include: {
        district: { select: { id: true, name: true } },
        _count: { select: { elements: true, photos: true } },
      },
    });
  }

  async getObjectById(objectId: string) {
    const object = await this.prisma.gtsObject.findUnique({
      where: { id: objectId },
      include: {
        district: { select: { id: true, name: true } },
        elements: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { photos: true } },
      },
    });
    if (!object) throw new NotFoundException('Объект ГТС не найден');
    return object;
  }

  async updateObject(objectId: string, data: {
    inspectionDate?: string;
    inspectorName?: string;
    overallCondition?: string;
    hasTechnicalDoc?: boolean;
  }) {
    await this.getObjectById(objectId);
    const updateData: any = {};
    if (data.inspectorName !== undefined) updateData.inspectorName = data.inspectorName;
    if (data.overallCondition !== undefined) updateData.overallCondition = data.overallCondition;
    if (data.hasTechnicalDoc !== undefined) updateData.hasTechnicalDoc = data.hasTechnicalDoc;
    if (data.inspectionDate) updateData.inspectionDate = new Date(data.inspectionDate);

    return this.prisma.gtsObject.update({
      where: { id: objectId },
      data: updateData,
      include: {
        district: { select: { id: true, name: true } },
        elements: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { photos: true } },
      },
    });
  }

  // ========== ЭЛЕМЕНТЫ ==========

  async updateElement(elementId: string, data: {
    characteristics?: string;
    technicalCondition?: string;
    defects?: string;
    recommendations?: string;
  }) {
    const element = await this.prisma.gtsElement.findUnique({ where: { id: elementId } });
    if (!element) throw new NotFoundException('Элемент ГТС не найден');

    return this.prisma.gtsElement.update({
      where: { id: elementId },
      data: {
        ...(data.characteristics !== undefined ? { characteristics: data.characteristics } : {}),
        ...(data.technicalCondition !== undefined ? { technicalCondition: data.technicalCondition } : {}),
        ...(data.defects !== undefined ? { defects: data.defects } : {}),
        ...(data.recommendations !== undefined ? { recommendations: data.recommendations } : {}),
      },
    });
  }
}
