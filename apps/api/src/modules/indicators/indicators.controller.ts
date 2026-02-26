import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { extname, join } from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IndicatorsService } from './indicators.service';

// Multer config для Excel файлов
const excelStorage = diskStorage({
  destination: join(process.cwd(), 'uploads', 'protocols'),
  filename: (req, file, callback) => {
    const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
    callback(null, uniqueName);
  },
});

const excelFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
  if (allowedMimes.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(new Error('Разрешены только файлы Excel (.xls, .xlsx)'), false);
  }
};

@Controller('indicators')
@UseGuards(JwtAuthGuard)
export class IndicatorsController {
  constructor(private indicatorsService: IndicatorsService) {}

  /**
   * Получить все проекты с показателями
   */
  @Get()
  async findAll(@Request() req: { user: { userId: string } }) {
    return this.indicatorsService.findAllWithIndicators(req.user.userId);
  }

  /**
   * Получить проекты без показателей (для выбора при создании)
   */
  @Get('available-projects')
  async getAvailableProjects(@Request() req: { user: { userId: string } }) {
    return this.indicatorsService.findProjectsWithoutIndicators(req.user.userId);
  }

  /**
   * Создать показатели из протокола
   */
  @Post()
  @UseInterceptors(
    FileInterceptor('protocol', {
      storage: excelStorage,
      fileFilter: excelFilter,
    }),
  )
  async create(
    @Request() req: { user: { userId: string } },
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { projectId: string },
  ) {
    if (!file) {
      throw new BadRequestException('Файл протокола не загружен');
    }

    if (!body.projectId) {
      throw new BadRequestException('Не указан ID объекта');
    }

    return this.indicatorsService.createFromProtocol(
      body.projectId,
      file,
      req.user.userId,
    );
  }

  /**
   * Получить показатели по ID проекта
   */
  @Get('project/:projectId')
  async findByProject(
    @Request() req: { user: { userId: string } },
    @Param('projectId') projectId: string,
  ) {
    return this.indicatorsService.findByProjectId(projectId, req.user.userId);
  }

  /**
   * Загрузить файл биотестирования
   */
  @Post('project/:projectId/biotest')
  @UseInterceptors(
    FileInterceptor('biotest', {
      storage: excelStorage,
      fileFilter: excelFilter,
    }),
  )
  async uploadBiotest(
    @Request() req: { user: { userId: string } },
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Файл биотестирования не загружен');
    }

    return this.indicatorsService.uploadBiotest(
      projectId,
      file,
      req.user.userId,
    );
  }

  /**
   * Удалить показатели проекта
   */
  @Delete('project/:projectId')
  async delete(
    @Request() req: { user: { userId: string } },
    @Param('projectId') projectId: string,
  ) {
    return this.indicatorsService.delete(projectId, req.user.userId);
  }
}
