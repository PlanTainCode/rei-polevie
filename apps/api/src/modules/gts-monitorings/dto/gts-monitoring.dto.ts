import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGtsMonitoringDto {
  @IsString()
  @IsNotEmpty({ message: 'Название мониторинга обязательно' })
  name: string;

  @IsNumber()
  @Type(() => Number)
  year: number;
}

export class UpdateGtsMonitoringDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  year?: number;

  @IsString()
  @IsOptional()
  status?: string;
}

export class UpdateGtsObjectDto {
  @IsString()
  @IsOptional()
  inspectionDate?: string;

  @IsString()
  @IsOptional()
  inspectorName?: string;

  @IsString()
  @IsOptional()
  overallCondition?: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  hasTechnicalDoc?: boolean;
}

export class UpdateGtsElementDto {
  @IsString()
  @IsOptional()
  characteristics?: string;

  @IsString()
  @IsOptional()
  technicalCondition?: string;

  @IsString()
  @IsOptional()
  defects?: string;

  @IsString()
  @IsOptional()
  recommendations?: string;
}

export class UpdateGtsPhotoDto {
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

export class GtsPhotoOrderItem {
  @IsString()
  id: string;

  @IsNumber()
  sortOrder: number;
}

export class ReorderGtsPhotosDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GtsPhotoOrderItem)
  orders: GtsPhotoOrderItem[];
}
