import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty({ message: 'Название проекта обязательно' })
  name: string;
}

export class UpdateSampleDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  latitude?: string;

  @IsString()
  @IsOptional()
  longitude?: string;
}

export class UpdatePhotoDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  photoDate?: string;

  @IsString()
  @IsOptional()
  latitude?: string;

  @IsString()
  @IsOptional()
  longitude?: string;
}

export class PhotoOrderItem {
  @IsString()
  id: string;

  @IsNumber()
  sortOrder: number;
}

export class ReorderPhotosDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhotoOrderItem)
  orders: PhotoOrderItem[];
}

export class GenerateAlbumDto {
  @IsString()
  @IsNotEmpty({ message: 'Состав ПБ обязателен' })
  crewMembers: string;
}

