import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum IndicatorType {
  SOIL_CHEMISTRY = 'SOIL_CHEMISTRY',
  SOIL_ERN = 'SOIL_ERN',
  WATER_CHEMISTRY = 'WATER_CHEMISTRY',
  SEDIMENT_CHEMISTRY = 'SEDIMENT_CHEMISTRY',
}

export class CreateIndicatorDto {
  @IsString()
  projectId: string;

  @IsOptional()
  @IsEnum(IndicatorType)
  type?: IndicatorType;
}
