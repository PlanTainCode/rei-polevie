import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCompanyDto } from './dto/company.dto';
import { CompanyRole } from '@prisma/client';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCompanyDto, ownerId: string) {
    // Проверяем, не состоит ли пользователь уже в компании
    const existingMembership = await this.prisma.companyMember.findFirst({
      where: { userId: ownerId },
    });

    if (existingMembership) {
      throw new ConflictException('Вы уже состоите в компании');
    }

    const company = await this.prisma.company.create({
      data: {
        name: dto.name,
        inn: dto.inn,
        members: {
          create: {
            userId: ownerId,
            role: CompanyRole.OWNER,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return company;
  }

  async findById(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Компания не найдена');
    }

    return company;
  }

  async getMyCompany(userId: string) {
    const membership = await this.prisma.companyMember.findFirst({
      where: { userId },
      include: {
        company: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!membership) {
      return null;
    }

    return {
      ...membership.company,
      myRole: membership.role,
    };
  }

  async getMembers(companyId: string, requesterId: string) {
    await this.checkMembership(companyId, requesterId);

    return this.prisma.companyMember.findMany({
      where: { companyId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async removeMember(companyId: string, memberId: string, requesterId: string) {
    const requesterMembership = await this.checkMembership(companyId, requesterId);

    // Только OWNER и ADMIN могут удалять участников
    if (!['OWNER', 'ADMIN'].includes(requesterMembership.role)) {
      throw new ForbiddenException('Недостаточно прав');
    }

    const memberToRemove = await this.prisma.companyMember.findFirst({
      where: { companyId, userId: memberId },
    });

    if (!memberToRemove) {
      throw new NotFoundException('Участник не найден');
    }

    // Нельзя удалить владельца
    if (memberToRemove.role === 'OWNER') {
      throw new ForbiddenException('Нельзя удалить владельца компании');
    }

    // ADMIN не может удалить другого ADMIN
    if (requesterMembership.role === 'ADMIN' && memberToRemove.role === 'ADMIN') {
      throw new ForbiddenException('Администратор не может удалить другого администратора');
    }

    await this.prisma.companyMember.delete({
      where: { id: memberToRemove.id },
    });

    return { success: true };
  }

  async checkMembership(companyId: string, userId: string) {
    const membership = await this.prisma.companyMember.findFirst({
      where: { companyId, userId },
    });

    if (!membership) {
      throw new ForbiddenException('Вы не являетесь участником этой компании');
    }

    return membership;
  }

  async checkRole(companyId: string, userId: string, allowedRoles: CompanyRole[]) {
    const membership = await this.checkMembership(companyId, userId);

    if (!allowedRoles.includes(membership.role)) {
      throw new ForbiddenException('Недостаточно прав');
    }

    return membership;
  }
}

