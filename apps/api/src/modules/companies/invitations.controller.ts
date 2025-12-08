import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InviteUserDto, AcceptInviteDto } from './dto/company.dto';

@Controller('invitations')
export class InvitationsController {
  constructor(private invitationsService: InvitationsService) {}

  // Публичный эндпоинт - получение информации о приглашении
  @Get(':token')
  async getInvitation(@Param('token') token: string) {
    return this.invitationsService.getInvitationByToken(token);
  }

  // Публичный эндпоинт - принятие приглашения
  @Post('accept')
  async acceptInvitation(@Body() dto: AcceptInviteDto) {
    return this.invitationsService.acceptInvitation(dto.token, {
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
  }

  // Защищённые эндпоинты
  @UseGuards(JwtAuthGuard)
  @Post('company/:companyId')
  async createInvitation(
    @Request() req: { user: { userId: string } },
    @Param('companyId') companyId: string,
    @Body() dto: InviteUserDto,
  ) {
    return this.invitationsService.createInvitation(
      companyId,
      dto.email,
      dto.role,
      req.user.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('company/:companyId')
  async getCompanyInvitations(
    @Request() req: { user: { userId: string } },
    @Param('companyId') companyId: string,
  ) {
    return this.invitationsService.getCompanyInvitations(companyId, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async cancelInvitation(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.invitationsService.cancelInvitation(id, req.user.userId);
  }
}

