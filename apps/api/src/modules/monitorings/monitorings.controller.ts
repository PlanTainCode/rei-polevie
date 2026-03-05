import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards,
  Request, UseInterceptors, UploadedFiles, UploadedFile, Res,
  NotFoundException, BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiService } from '../ai/ai.service';
import { MonitoringsService } from './monitorings.service';
import { MonitoringProbesService } from './monitoring-probes.service';
import { MonitoringPhotosService } from './monitoring-photos.service';
import { MonitoringExcelService } from './monitoring-excel.service';
import { MonitoringPresentationService } from './monitoring-presentation.service';
import {
  CreateMonitoringDto, UpdateMonitoringDto, CreateProbeDto, UpdateProbeDto,
  UpdateMonitoringPhotoDto, ReorderMonitoringPhotosDto,
  GenerateMonitoringActDto, GenerateMonitoringAlbumDto,
} from './dto/monitoring.dto';

@Controller('monitorings')
@UseGuards(JwtAuthGuard)
export class MonitoringsController {
  constructor(
    private monitoringsService: MonitoringsService,
    private probesService: MonitoringProbesService,
    private photosService: MonitoringPhotosService,
    private excelService: MonitoringExcelService,
    private presentationService: MonitoringPresentationService,
    private aiService: AiService,
  ) {}

  // ========== CRUD МОНИТОРИНГОВ ==========

  @Post()
  @UseInterceptors(FileInterceptor('tz'))
  async create(
    @Body() dto: CreateMonitoringDto,
    @UploadedFile() tzFile: Express.Multer.File,
    @Request() req: any,
  ) {
    const monitoring = await this.monitoringsService.create(
      req.user.userId,
      { name: dto.name, objectName: dto.objectName, objectAddress: dto.objectAddress },
    );

    if (tzFile) {
      return this.monitoringsService.uploadTzAndProcess(monitoring.id, tzFile);
    }

    return monitoring;
  }

  @Get()
  async findAll(@Request() req: any) {
    return this.monitoringsService.findAll(req.user.userId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.monitoringsService.findById(id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('tz'))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMonitoringDto,
    @UploadedFile() tzFile: Express.Multer.File,
  ) {
    if (tzFile) {
      await this.monitoringsService.update(id, dto);
      return this.monitoringsService.uploadTzAndProcess(id, tzFile);
    }
    return this.monitoringsService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.monitoringsService.delete(id);
  }

  // ========== ПРОБЫ ==========

  @Get(':id/probes')
  async getProbes(@Param('id') id: string) {
    return this.probesService.findByMonitoring(id);
  }

  @Post(':id/probes')
  async createProbe(@Param('id') id: string, @Body() dto: CreateProbeDto) {
    return this.probesService.create(id, dto);
  }

  @Patch(':id/probes/:probeId')
  async updateProbe(@Param('probeId') probeId: string, @Body() dto: UpdateProbeDto) {
    return this.probesService.update(probeId, dto);
  }

  @Post(':id/probes/:probeId/collect')
  async collectProbe(@Param('probeId') probeId: string, @Request() req: any) {
    return this.probesService.collect(probeId, req.user.userId);
  }

  @Delete(':id/probes/:probeId')
  async deleteProbe(@Param('probeId') probeId: string) {
    return this.probesService.delete(probeId);
  }

  // ========== ФОТО ==========

  @Get(':id/photos')
  async getAllPhotos(@Param('id') id: string) {
    return this.photosService.getAllPhotosByMonitoring(id);
  }

  @Get(':id/probes/:probeId/photos')
  async getProbePhotos(@Param('probeId') probeId: string) {
    return this.photosService.getPhotosByProbe(probeId);
  }

  @Post(':id/probes/:probeId/photos')
  @UseInterceptors(FilesInterceptor('photos', 50))
  async uploadPhotos(
    @Param('id') id: string,
    @Param('probeId') probeId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: any,
  ) {
    if (!files || files.length === 0) throw new BadRequestException('Нет файлов');
    return this.photosService.uploadPhotos(id, probeId, files, req.user.userId);
  }

  @Patch(':id/photos/:photoId')
  async updatePhoto(@Param('photoId') photoId: string, @Body() dto: UpdateMonitoringPhotoDto) {
    const data: any = { ...dto };
    if (dto.photoDate) data.photoDate = new Date(dto.photoDate);
    return this.photosService.updatePhoto(photoId, data);
  }

  @Patch(':id/probes/:probeId/photos-reorder')
  async reorderPhotos(@Param('probeId') probeId: string, @Body() dto: ReorderMonitoringPhotosDto) {
    return this.photosService.reorderPhotos(probeId, dto.orders);
  }

  @Delete(':id/photos/:photoId')
  async deletePhoto(@Param('photoId') photoId: string) {
    return this.photosService.deletePhoto(photoId);
  }

  @Post(':id/photos/:photoId/voice-description')
  @UseInterceptors(FileInterceptor('audio'))
  async voiceDescription(
    @Param('photoId') photoId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Аудио файл обязателен');
    const transcription = await this.aiService.transcribeAudio(file.buffer, file.mimetype || 'audio/webm');
    const photo = await this.photosService.updatePhoto(photoId, { description: transcription });
    return { transcription, photo };
  }

  @Get(':id/photos/:photoId/thumbnail')
  async getPhotoThumbnail(@Param('id') id: string, @Param('photoId') photoId: string, @Res() res: Response) {
    const photo = await this.photosService.getPhotoById(photoId);
    if (photo.thumbnailName) {
      const thumbPath = this.photosService.getThumbnailPath(photo.thumbnailName);
      if (existsSync(thumbPath)) return res.sendFile(thumbPath);
    }
    const originalPath = this.photosService.getOriginalPath(photo.monitoringId, photo.filename);
    if (!existsSync(originalPath)) throw new NotFoundException('Файл не найден');
    return res.sendFile(originalPath);
  }

  @Get(':id/photos/:photoId/original')
  async getPhotoOriginal(@Param('id') id: string, @Param('photoId') photoId: string, @Res() res: Response) {
    const photo = await this.photosService.getPhotoById(photoId);
    const originalPath = this.photosService.getOriginalPath(photo.monitoringId, photo.filename);
    if (!existsSync(originalPath)) throw new NotFoundException('Файл не найден');
    res.set({
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(photo.originalName)}`,
    });
    return res.sendFile(originalPath);
  }

  @Get(':id/probes/:probeId/photos-download')
  async downloadProbePhotos(
    @Param('id') id: string,
    @Param('probeId') probeId: string,
    @Res() res: Response,
  ) {
    const probe = await this.probesService.findById(probeId);
    const archive = await this.photosService.createProbePhotosArchive(id, probeId, probe.name);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(archive.filename)}`,
    });
    res.send(archive.buffer);
  }

  @Get(':id/photos-download')
  async downloadAllPhotos(@Param('id') id: string, @Res() res: Response) {
    const archive = await this.photosService.createAllPhotosArchive(id);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(archive.filename)}`,
    });
    res.send(archive.buffer);
  }

  // ========== ТОЧКИ НАБЛЮДЕНИЯ (фото по точке) ==========

  @Get(':id/points/:pointName/photos')
  async getPointPhotos(@Param('id') id: string, @Param('pointName') pointName: string) {
    return this.photosService.getPhotosByPointName(id, decodeURIComponent(pointName));
  }

  @Patch(':id/points/:pointName/photos-reorder')
  async reorderPointPhotos(
    @Param('id') id: string,
    @Param('pointName') pointName: string,
    @Body() dto: ReorderMonitoringPhotosDto,
  ) {
    return this.photosService.reorderPointPhotos(id, decodeURIComponent(pointName), dto.orders);
  }

  @Get(':id/points/:pointName/photos-download')
  async downloadPointPhotos(
    @Param('id') id: string,
    @Param('pointName') pointName: string,
    @Res() res: Response,
  ) {
    const name = decodeURIComponent(pointName);
    const archive = await this.photosService.createPointPhotosArchive(id, name);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(archive.filename)}`,
    });
    res.send(archive.buffer);
  }

  @Post(':id/points/:pointName/generate-album')
  async generatePointAlbum(
    @Param('id') id: string,
    @Param('pointName') pointName: string,
    @Body() dto: GenerateMonitoringAlbumDto,
    @Res() res: Response,
  ) {
    const name = decodeURIComponent(pointName);
    const result = await this.presentationService.generatePointAlbum(id, name, dto.crewMembers);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
    });
    res.send(result.buffer);
  }

  // ========== ГЕНЕРАЦИЯ АКТОВ ==========

  @Post(':id/generate-act')
  async generateAct(@Param('id') id: string, @Body() dto: GenerateMonitoringActDto, @Res() res: Response) {
    const result = await this.excelService.generateAct(id, dto.type, dto.date);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
    });
    res.send(result.buffer);
  }

  // ========== ГЕНЕРАЦИЯ АЛЬБОМА (по пробе, legacy) ==========

  @Post(':id/probes/:probeId/generate-album')
  async generateProbeAlbum(
    @Param('id') id: string,
    @Param('probeId') probeId: string,
    @Body() dto: GenerateMonitoringAlbumDto,
    @Res() res: Response,
  ) {
    const result = await this.presentationService.generateProbeAlbum(id, probeId, dto.crewMembers);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
    });
    res.send(result.buffer);
  }
}
