import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Request, UseInterceptors, UploadedFiles, UploadedFile, Res,
  NotFoundException, BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { existsSync } from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GtsMonitoringsService } from './gts-monitorings.service';
import { GtsExcelParserService } from './gts-excel-parser.service';
import { GtsPhotosService } from './gts-photos.service';
import { GtsDefectStatementService } from './gts-defect-statement.service';
import { GtsPresentationService } from './gts-presentation.service';
import {
  CreateGtsMonitoringDto, UpdateGtsMonitoringDto,
  UpdateGtsObjectDto, UpdateGtsElementDto,
  UpdateGtsPhotoDto, ReorderGtsPhotosDto,
} from './dto/gts-monitoring.dto';

@Controller('gts-monitorings')
@UseGuards(JwtAuthGuard)
export class GtsMonitoringsController {
  constructor(
    private service: GtsMonitoringsService,
    private excelParser: GtsExcelParserService,
    private photosService: GtsPhotosService,
    private defectService: GtsDefectStatementService,
    private presentationService: GtsPresentationService,
  ) {}

  // ========== МОНИТОРИНГИ ==========

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Body() dto: CreateGtsMonitoringDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    const monitoring = await this.service.create(req.user.userId, {
      name: dto.name,
      year: dto.year,
    });

    if (file) {
      await this.excelParser.parseAndImport(monitoring.id, file);
    }

    return this.service.findById(monitoring.id);
  }

  @Get()
  async findAll(@Request() req: any) {
    return this.service.findAll(req.user.userId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateGtsMonitoringDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  // ========== РАЙОНЫ ==========

  @Get(':id/districts')
  async getDistricts(@Param('id') id: string) {
    return this.service.getDistricts(id);
  }

  // ========== ОБЪЕКТЫ ==========

  @Get(':id/objects')
  async getObjects(@Param('id') id: string, @Query('districtId') districtId?: string) {
    return this.service.getObjects(id, districtId);
  }

  @Get(':id/objects/:objectId')
  async getObject(@Param('objectId') objectId: string) {
    return this.service.getObjectById(objectId);
  }

  @Patch(':id/objects/:objectId')
  async updateObject(@Param('objectId') objectId: string, @Body() dto: UpdateGtsObjectDto) {
    return this.service.updateObject(objectId, dto);
  }

  // ========== ЭЛЕМЕНТЫ ==========

  @Patch(':id/objects/:objectId/elements/:elementId')
  async updateElement(@Param('elementId') elementId: string, @Body() dto: UpdateGtsElementDto) {
    return this.service.updateElement(elementId, dto);
  }

  // ========== ФОТО ==========

  @Get(':id/objects/:objectId/photos')
  async getObjectPhotos(@Param('objectId') objectId: string) {
    return this.photosService.getPhotosByObject(objectId);
  }

  @Post(':id/objects/:objectId/photos')
  @UseInterceptors(FilesInterceptor('photos', 50))
  async uploadPhotos(
    @Param('id') id: string,
    @Param('objectId') objectId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: any,
  ) {
    if (!files || files.length === 0) throw new BadRequestException('Нет файлов');
    return this.photosService.uploadPhotos(id, objectId, files, req.user.userId);
  }

  @Patch(':id/photos/:photoId')
  async updatePhoto(@Param('photoId') photoId: string, @Body() dto: UpdateGtsPhotoDto) {
    const data: any = { ...dto };
    if (dto.photoDate) data.photoDate = new Date(dto.photoDate);
    return this.photosService.updatePhoto(photoId, data);
  }

  @Post(':id/objects/:objectId/photos/reorder')
  async reorderPhotos(@Param('objectId') objectId: string, @Body() dto: ReorderGtsPhotosDto) {
    return this.photosService.reorderPhotos(objectId, dto.orders);
  }

  @Delete(':id/photos/:photoId')
  async deletePhoto(@Param('photoId') photoId: string) {
    return this.photosService.deletePhoto(photoId);
  }

  @Get(':id/photos/:photoId/thumbnail')
  async getPhotoThumbnail(@Param('photoId') photoId: string, @Res() res: Response) {
    const photo = await this.photosService.getPhotoById(photoId);
    if (photo.thumbnailName) {
      const thumbPath = this.photosService.getThumbnailPath(photo.thumbnailName);
      if (existsSync(thumbPath)) return res.sendFile(thumbPath);
    }
    const originalPath = this.photosService.getOriginalPath(photo.gtsMonitoringId, photo.filename);
    if (!existsSync(originalPath)) throw new NotFoundException('Файл не найден');
    return res.sendFile(originalPath);
  }

  @Get(':id/photos/:photoId/original')
  async getPhotoOriginal(@Param('photoId') photoId: string, @Res() res: Response) {
    const photo = await this.photosService.getPhotoById(photoId);
    const originalPath = this.photosService.getOriginalPath(photo.gtsMonitoringId, photo.filename);
    if (!existsSync(originalPath)) throw new NotFoundException('Файл не найден');
    res.set({
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(photo.originalName)}`,
    });
    return res.sendFile(originalPath);
  }

  // ========== ГЕНЕРАЦИЯ ==========

  @Post(':id/objects/:objectId/generate-defect-statement')
  async generateObjectDefectStatement(
    @Param('id') id: string,
    @Param('objectId') objectId: string,
    @Res() res: Response,
  ) {
    const result = await this.defectService.generateForObject(objectId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
      'Content-Length': String(result.buffer.length),
    });
    res.send(result.buffer);
  }

  @Post(':id/districts/:districtId/generate-defect-statements')
  async generateDistrictDefectStatements(
    @Param('id') id: string,
    @Param('districtId') districtId: string,
    @Res() res: Response,
  ) {
    const result = await this.defectService.generateForDistrict(districtId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
      'Content-Length': String(result.buffer.length),
    });
    res.send(result.buffer);
  }

  @Post(':id/objects/:objectId/generate-album')
  async generateObjectAlbum(
    @Param('id') id: string,
    @Param('objectId') objectId: string,
    @Res() res: Response,
  ) {
    const result = await this.presentationService.generateForObject(objectId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
      'Content-Length': String(result.buffer.length),
    });
    res.send(result.buffer);
  }

  @Post(':id/districts/:districtId/generate-album')
  async generateDistrictAlbum(
    @Param('id') id: string,
    @Param('districtId') districtId: string,
    @Res() res: Response,
  ) {
    const result = await this.presentationService.generateForDistrict(districtId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
      'Content-Length': String(result.buffer.length),
    });
    res.send(result.buffer);
  }
}
