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
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InquiryRequestsService } from './inquiry-requests.service';
import { EmailService } from '../email/email.service';
import {
  type UpdateInquiryRequestDto,
  type GenerateInquiriesDto,
} from './inquiry-requests.types';

@Controller('projects/:projectId/inquiry-requests')
@UseGuards(JwtAuthGuard)
export class InquiryRequestsController {
  constructor(
    private inquiryRequestsService: InquiryRequestsService,
    private emailService: EmailService,
  ) {}

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
   * Принимает опциональный PDF файл (приложение) для объединения со справками
   */
  @Post('generate')
  @UseInterceptors(
    FileInterceptor('attachmentPdf', {
      storage: memoryStorage(),
      fileFilter: (req, file, callback) => {
        if (file.mimetype === 'application/pdf') {
          callback(null, true);
        } else {
          callback(new Error('Разрешены только PDF файлы'), false);
        }
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  )
  async generate(
    @Param('projectId') projectId: string,
    @Body() dto: { inquiryIds: string | string[] },
    @UploadedFile() attachmentPdf?: Express.Multer.File,
  ) {
    // inquiryIds может прийти как JSON строка из FormData или как массив
    let inquiryIds: string[];
    if (typeof dto.inquiryIds === 'string') {
      try {
        inquiryIds = JSON.parse(dto.inquiryIds);
      } catch {
        inquiryIds = [dto.inquiryIds];
      }
    } else {
      inquiryIds = dto.inquiryIds;
    }

    return this.inquiryRequestsService.generate(
      projectId,
      inquiryIds,
      attachmentPdf?.buffer,
    );
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

  /**
   * Отправить справку на email ведомства
   */
  @Post('send-email')
  async sendEmail(
    @Param('projectId') projectId: string,
    @Body() dto: { inquiryId: string; email: string },
  ) {
    if (!dto.email || !dto.inquiryId) {
      throw new BadRequestException('Необходимо указать inquiryId и email');
    }

    // Получаем данные проекта и запроса
    const result = await this.inquiryRequestsService.getInquiryEmailData(
      projectId,
      dto.inquiryId,
    );

    if (!result) {
      throw new NotFoundException('Справка не найдена или не сгенерирована');
    }

    // Отправляем письмо
    const emailResult = await this.emailService.sendInquiryRequest({
      to: dto.email,
      inquiryName: result.inquiryName,
      objectName: result.objectName,
      objectAddress: result.objectAddress,
      pdfBuffer: result.pdfBuffer,
      pdfFileName: result.fileName,
    });

    return {
      success: emailResult.success,
      messageId: emailResult.messageId,
      error: emailResult.error,
    };
  }

  /**
   * Проверить настройку email сервиса
   */
  @Get('email-status')
  async getEmailStatus() {
    const isConfigured = await this.emailService.verifyConnection();
    return { configured: isConfigured };
  }
}

