import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Res,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InquiryRequestsService } from './inquiry-requests.service';
import {
  type UpdateInquiryRequestDto,
  type GenerateInquiriesDto,
} from './inquiry-requests.types';

@Controller('projects/:projectId/inquiry-requests')
@UseGuards(JwtAuthGuard)
export class InquiryRequestsController {
  constructor(private inquiryRequestsService: InquiryRequestsService) {}

  /**
   * Получить или создать запрос справок для проекта
   */
  @Get()
  async get(@Param('projectId') projectId: string) {
    return this.inquiryRequestsService.getOrCreate(projectId);
  }

  /**
   * Получить список доступных справок для проекта (зависит от региона)
   */
  @Get('available')
  async getAvailable(@Param('projectId') projectId: string) {
    return this.inquiryRequestsService.getAvailableInquiries(projectId);
  }

  /**
   * Обновить выбранные справки и дополнительные данные
   */
  @Patch()
  async update(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateInquiryRequestDto,
  ) {
    return this.inquiryRequestsService.update(projectId, dto);
  }

  /**
   * Сгенерировать справки
   */
  @Post('generate')
  async generate(
    @Param('projectId') projectId: string,
    @Body() dto: GenerateInquiriesDto,
  ) {
    return this.inquiryRequestsService.generate(projectId, dto.inquiryIds);
  }

  /**
   * Скачать сгенерированный файл справки
   */
  @Get('download/:fileName')
  async download(
    @Param('projectId') projectId: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    // Проверяем что файл принадлежит этому проекту
    const inquiryRequest = await this.inquiryRequestsService.get(projectId);
    if (!inquiryRequest) {
      throw new NotFoundException('Запрос справок не найден');
    }

    const fileExists = inquiryRequest.generatedFiles?.some(
      (f) => f.fileName === fileName,
    );
    if (!fileExists) {
      throw new NotFoundException('Файл не найден');
    }

    const { path, exists } = await this.inquiryRequestsService.getGeneratedFile(fileName);
    if (!exists) {
      throw new NotFoundException('Файл не найден на сервере');
    }

    res.download(path, fileName);
  }
}

