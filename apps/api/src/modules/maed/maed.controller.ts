import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ArrayMaxSize, IsArray, IsNumber, Max, Min, ValidateIf } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MaedService } from './maed.service';

class UpdateMaedUncertaintyDto {
  @ValidateIf((_object, value) => value !== null)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  uncertainty: number | null;
}

class UpdateMaedCalculationDto {
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1000)
  mainErrorPercent: number;

  @IsArray()
  @ArrayMaxSize(30)
  @IsNumber({ allowNaN: false, allowInfinity: false }, { each: true })
  @Min(0, { each: true })
  @Max(1000, { each: true })
  additionalErrorsPercent: number[];
}

@Controller('projects/:projectId/maed')
@UseGuards(JwtAuthGuard)
export class MaedController {
  constructor(private readonly service: MaedService) {}

  @Get()
  list(@Param('projectId') projectId: string, @Request() req: { user: { userId: string } }) {
    return this.service.list(projectId, req.user.userId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('protocol', {
    storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
      if (!/\.xlsx?$/i.test(file.originalname)) return callback(new BadRequestException('Загрузите файл Excel (.xlsx или .xls)'), false);
      callback(null, true);
    },
  }))
  upload(@Param('projectId') projectId: string, @Request() req: { user: { userId: string } }, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл протокола не загружен');
    return this.service.upload(projectId, req.user.userId, file);
  }

  @Patch(':id')
  update(@Param('projectId') projectId: string, @Param('id') id: string, @Request() req: { user: { userId: string } }, @Body() body: UpdateMaedUncertaintyDto) {
    return this.service.updateUncertainty(projectId, id, req.user.userId, body.uncertainty);
  }

  @Delete(':id')
  delete(@Param('projectId') projectId: string, @Param('id') id: string, @Request() req: { user: { userId: string } }) {
    return this.service.delete(projectId, id, req.user.userId);
  }

  @Patch(':id/calculation')
  updateCalculation(@Param('projectId') projectId: string, @Param('id') id: string, @Request() req: { user: { userId: string } }, @Body() body: UpdateMaedCalculationDto) {
    return this.service.updateCalculation(projectId, id, req.user.userId, body);
  }
}
