import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCompanyDto, UpdateCompanyRequisitesDto } from './dto/company.dto';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Post()
  async create(
    @Request() req: { user: { userId: string } },
    @Body() dto: CreateCompanyDto,
  ) {
    return this.companiesService.create(dto, req.user.userId);
  }

  @Get('my')
  async getMyCompany(@Request() req: { user: { userId: string } }) {
    return this.companiesService.getMyCompany(req.user.userId);
  }

  @Get(':id')
  async findById(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    await this.companiesService.checkMembership(id, req.user.userId);
    return this.companiesService.findById(id);
  }

  // Реквизиты компании для XML-ТЗ (организация + подписант)
  @Patch(':id/requisites')
  async updateRequisites(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCompanyRequisitesDto,
  ) {
    return this.companiesService.updateRequisites(id, dto.requisites, req.user.userId);
  }

  @Get(':id/members')
  async getMembers(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.companiesService.getMembers(id, req.user.userId);
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.companiesService.removeMember(id, memberId, req.user.userId);
  }
}

