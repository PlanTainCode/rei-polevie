import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMonitoringDto {
  @IsString()
  @IsNotEmpty({ message: 'Название мониторинга обязательно' })
  name: string;

  @IsString()
  @IsOptional()
  objectName?: string;

  @IsString()
  @IsOptional()
  objectAddress?: string;
}

export class UpdateMonitoringDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  objectName?: string;

  @IsString()
  @IsOptional()
  objectAddress?: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  weatherTemperature?: string;

  @IsString()
  @IsOptional()
  weatherWind?: string;

  @IsString()
  @IsOptional()
  weatherPressure?: string;

  @IsString()
  @IsOptional()
  weatherHumidity?: string;
}

export class CreateProbeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  type: 'WATER' | 'SEDIMENT';

  @IsString()
  @IsOptional()
  latitude?: string;

  @IsString()
  @IsOptional()
  longitude?: string;

  @IsString()
  @IsOptional()
  container?: string;

  @IsString()
  @IsOptional()
  containerVolume?: string;

  @IsNumber()
  @IsOptional()
  containerCount?: number;

  @IsString()
  @IsOptional()
  depth?: string;
}

export class UpdateProbeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  latitude?: string;

  @IsString()
  @IsOptional()
  longitude?: string;

  @IsString()
  @IsOptional()
  container?: string;

  @IsString()
  @IsOptional()
  containerVolume?: string;

  @IsNumber()
  @IsOptional()
  containerCount?: number;

  @IsString()
  @IsOptional()
  depth?: string;

  @IsString()
  @IsOptional()
  temperature?: string;

  @IsString()
  @IsOptional()
  mass?: string;

  @IsString()
  @IsOptional()
  note?: string;
}

export class UpdateMonitoringPhotoDto {
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

export class MonitoringPhotoOrderItem {
  @IsString()
  id: string;

  @IsNumber()
  sortOrder: number;
}

export class ReorderMonitoringPhotosDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MonitoringPhotoOrderItem)
  orders: MonitoringPhotoOrderItem[];
}

export class GenerateMonitoringActDto {
  @IsString()
  @IsNotEmpty()
  type: 'water' | 'sediment';

  @IsString()
  @IsNotEmpty()
  date: string;
}

export class GenerateMonitoringAlbumDto {
  @IsString()
  @IsOptional()
  crewMembers?: string;
}
