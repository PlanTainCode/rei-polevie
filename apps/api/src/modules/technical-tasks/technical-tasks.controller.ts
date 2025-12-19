import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { existsSync } from 'fs';
import { TechnicalTasksService } from './technical-tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTechnicalTaskDto, UpdateTechnicalTaskDto } from './dto/technical-task.dto';

@Controller('technical-tasks')
@UseGuards(JwtAuthGuard)
export class TechnicalTasksController {
  constructor(private technicalTasksService: TechnicalTasksService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, callback) => {
        const allowedMimes = [
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'application/pdf',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new Error('Разрешены только файлы Word (.doc, .docx) и PDF'), false);
        }
      },
    }),
  )
  async create(
    @Request() req: { user: { userId: string } },
    @Body() dto: CreateTechnicalTaskDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.technicalTasksService.create(dto, file, req.user.userId);
  }

  @Get()
  async findAll(@Request() req: { user: { userId: string } }) {
    return this.technicalTasksService.findAll(req.user.userId);
  }

  @Get(':id')
  async findById(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.technicalTasksService.findById(id, req.user.userId);
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, callback) => {
        const allowedMimes = [
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'application/pdf',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new Error('Разрешены только файлы Word (.doc, .docx) и PDF'), false);
        }
      },
    }),
  )
  async update(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateTechnicalTaskDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.technicalTasksService.update(id, dto, file, req.user.userId);
  }

  @Delete(':id')
  async delete(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.technicalTasksService.delete(id, req.user.userId);
  }

  // Скачивание исходного файла ТЗ
  @Get(':id/files/source')
  async downloadSourceFile(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { path, fileName } = await this.technicalTasksService.getFilePath(
      id,
      'source',
      req.user.userId,
    );

    if (!existsSync(path)) {
      throw new NotFoundException('Файл не найден');
    }

    const name = fileName || 'document';
    const encodedName = encodeURIComponent(name);
    res.setHeader('Content-Disposition', `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
    res.sendFile(path);
  }

  // Скачивание сгенерированного файла ТЗ
  @Get(':id/files/generated')
  async downloadGeneratedFile(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { path, fileName } = await this.technicalTasksService.getFilePath(
      id,
      'generated',
      req.user.userId,
    );

    if (!existsSync(path)) {
      throw new NotFoundException('Файл не найден');
    }

    const name = fileName || 'document';
    const encodedName = encodeURIComponent(name);
    res.setHeader('Content-Disposition', `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
    res.sendFile(path);
  }

  // Повторная обработка ТЗ
  @Post(':id/reprocess')
  async reprocess(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.technicalTasksService.reprocess(id, req.user.userId);
  }

  // Получить HTML содержимое документа
  @Get(':id/document/html')
  async getDocumentHtml(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.technicalTasksService.getDocumentHtml(id, req.user.userId);
  }

  // Сохранить изменённый HTML документа
  @Post(':id/document/html')
  async saveDocumentHtml(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() body: { html: string },
  ) {
    return this.technicalTasksService.saveDocumentHtml(id, body.html, req.user.userId);
  }
}
