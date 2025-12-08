import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { CompaniesService } from './companies.service';

@Injectable()
export class InvitationsService {
  constructor(
    private prisma: PrismaService,
    private companiesService: CompaniesService,
  ) {}

  async createInvitation(companyId: string, email: string, role: CompanyRole, inviterId: string) {
    // Проверяем права приглашающего
    await this.companiesService.checkRole(companyId, inviterId, ['OWNER', 'ADMIN']);

    // Проверяем, не состоит ли пользователь уже в компании
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      include: {
        companyMemberships: true,
      },
    });

    if (existingUser?.companyMemberships.some(m => m.companyId === companyId)) {
      throw new ConflictException('Пользователь уже состоит в компании');
    }

    // Удаляем старые приглашения для этого email в эту компанию
    await this.prisma.invitation.deleteMany({
      where: {
        email,
        companyId,
        acceptedAt: null,
      },
    });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 дней

    const invitation = await this.prisma.invitation.create({
      data: {
        email,
        role,
        companyId,
        token,
        expiresAt,
      },
      include: {
        company: {
          select: {
            name: true,
          },
        },
      },
    });

    return invitation;
  }

  async getInvitationByToken(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Приглашение не найдено');
    }

    if (invitation.acceptedAt) {
      throw new BadRequestException('Приглашение уже использовано');
    }

    if (new Date() > invitation.expiresAt) {
      throw new BadRequestException('Срок действия приглашения истёк');
    }

    return invitation;
  }

  async acceptInvitation(
    token: string,
    data: { password: string; firstName: string; lastName: string },
  ) {
    const invitation = await this.getInvitationByToken(token);

    // Проверяем, существует ли пользователь
    let user = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });

    if (user) {
      // Пользователь существует - проверяем, не состоит ли уже в компании
      const existingMembership = await this.prisma.companyMember.findFirst({
        where: { userId: user.id, companyId: invitation.companyId },
      });

      if (existingMembership) {
        throw new ConflictException('Вы уже состоите в этой компании');
      }
    } else {
      // Создаём нового пользователя
      const passwordHash = await bcrypt.hash(data.password, 10);

      user = await this.prisma.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
        },
      });
    }

    // Добавляем в компанию
    await this.prisma.companyMember.create({
      data: {
        userId: user.id,
        companyId: invitation.companyId,
        role: invitation.role,
      },
    });

    // Помечаем приглашение как принятое
    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    return { success: true, companyId: invitation.companyId };
  }

  async getCompanyInvitations(companyId: string, requesterId: string) {
    await this.companiesService.checkRole(companyId, requesterId, ['OWNER', 'ADMIN']);

    return this.prisma.invitation.findMany({
      where: {
        companyId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelInvitation(invitationId: string, requesterId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Приглашение не найдено');
    }

    await this.companiesService.checkRole(invitation.companyId, requesterId, ['OWNER', 'ADMIN']);

    await this.prisma.invitation.delete({
      where: { id: invitationId },
    });

    return { success: true };
  }
}

