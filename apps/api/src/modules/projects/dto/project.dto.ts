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

export class UpdateProgramIeiDto {
  @IsString()
  @IsOptional()
  cadastralNumber?: string;

  @IsString()
  @IsOptional()
  egrnDescription?: string;

  // 3.2 - окружение участка
  @IsString()
  @IsOptional()
  nearbySouth?: string;

  @IsString()
  @IsOptional()
  nearbyEast?: string;

  @IsString()
  @IsOptional()
  nearbyWest?: string;

  @IsString()
  @IsOptional()
  nearbyNorth?: string;

  // 8.2 - Обоснование границ изучаемой территории
  @IsString()
  @IsOptional()
  section82Text?: string;
}

