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
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { existsSync } from 'fs';
import { TechnicalTasksService } from './technical-tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTechnicalTaskDto, UpdateTechnicalTaskDto } from './dto/technical-task.dto';

type Req = { user: { userId: string } };

const SOURCE_MIMES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/pdf',
  'application/xml',
  'text/xml',
];

function sendFile(res: Response, path: string, name: string) {
  if (!existsSync(path)) throw new NotFoundException('Файл не найден');
  const encodedName = encodeURIComponent(name);
  res.setHeader('Content-Disposition', `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
  res.sendFile(path);
}

@Controller('technical-tasks')
@UseGuards(JwtAuthGuard)
export class TechnicalTasksController {
  constructor(private technicalTasksService: TechnicalTasksService) {}

  /** Официальный XSL для визуализации XML-задания (применяется в браузере). */
  @Get('xsl')
  getXsl(@Res() res: Response) {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.sendFile(this.technicalTasksService.getXslPath());
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, callback) => {
        const isXmlByName = /\.xml$/i.test(file.originalname);
        if (SOURCE_MIMES.includes(file.mimetype) || isXmlByName) callback(null, true);
        else callback(new BadRequestException('Разрешены файлы Word (.doc, .docx), PDF и XML'), false);
      },
    }),
  )
  async create(@Request() req: Req, @Body() dto: CreateTechnicalTaskDto, @UploadedFile() file: Express.Multer.File) {
    return this.technicalTasksService.create(dto, file, req.user.userId);
  }

  @Get()
  async findAll(@Request() req: Req) {
    return this.technicalTasksService.findAll(req.user.userId);
  }

  @Get(':id')
  async findById(@Request() req: Req, @Param('id') id: string) {
    return this.technicalTasksService.findById(id, req.user.userId);
  }

  /** Сохранение названия и данных задания (JSON). */
  @Patch(':id')
  async update(@Request() req: Req, @Param('id') id: string, @Body() dto: UpdateTechnicalTaskDto) {
    return this.technicalTasksService.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  async delete(@Request() req: Req, @Param('id') id: string) {
    return this.technicalTasksService.delete(id, req.user.userId);
  }

  /** Проверка и сборка XML по схеме Минстроя. */
  @Post(':id/generate')
  async generate(@Request() req: Req, @Param('id') id: string) {
    return this.technicalTasksService.generate(id, req.user.userId);
  }

  /** Повторное извлечение данных из Word/PDF. */
  @Post(':id/reprocess')
  async reprocess(@Request() req: Req, @Param('id') id: string) {
    return this.technicalTasksService.reprocess(id, req.user.userId);
  }

  /** Загрузка вложения: файл документа или изображение границ. */
  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttachment(@Request() req: Req, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не передан');
    return this.technicalTasksService.uploadAttachment(id, file, req.user.userId);
  }

  @Get(':id/attachments/:fileName')
  async getAttachment(@Request() req: Req, @Param('id') id: string, @Param('fileName') fileName: string, @Res() res: Response) {
    const path = await this.technicalTasksService.getAttachmentPath(id, fileName, req.user.userId);
    res.sendFile(path);
  }

  @Get(':id/files/xml')
  async downloadXml(@Request() req: Req, @Param('id') id: string, @Res() res: Response) {
    const { path, fileName } = await this.technicalTasksService.getXmlPath(id, req.user.userId);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    sendFile(res, path, fileName);
  }

  /** XML без заголовка скачивания — для предпросмотра в браузере. */
  @Get(':id/files/xml/raw')
  async rawXml(@Request() req: Req, @Param('id') id: string, @Res() res: Response) {
    const { path } = await this.technicalTasksService.getXmlPath(id, req.user.userId);
    if (!existsSync(path)) throw new NotFoundException('Файл не найден');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.sendFile(path);
  }

  @Get(':id/files/source')
  async downloadSourceFile(@Request() req: Req, @Param('id') id: string, @Res() res: Response) {
    const { path, fileName } = await this.technicalTasksService.getFilePath(id, 'source', req.user.userId);
    sendFile(res, path, fileName || 'document');
  }

  @Get(':id/files/generated')
  async downloadGeneratedFile(@Request() req: Req, @Param('id') id: string, @Res() res: Response) {
    const { path, fileName } = await this.technicalTasksService.getFilePath(id, 'generated', req.user.userId);
    sendFile(res, path, fileName || 'document.docx');
  }

  /** HTML сгенерированного Word прежних записей. */
  @Get(':id/document/html')
  async getDocumentHtml(@Request() req: Req, @Param('id') id: string) {
    return this.technicalTasksService.getDocumentHtml(id, req.user.userId);
  }
}
