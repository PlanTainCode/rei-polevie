import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber, IsString, Max, MaxLength, Min } from 'class-validator';
import { PlatformType } from '@prisma/client';

export class CreateSampleDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty({ message: 'Укажите шифр пробы' })
  @MaxLength(200)
  cipher: string;

  @IsEnum(PlatformType)
  platformType: PlatformType;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  platformNumber: number;

  @IsIn(['АХ', 'АМ', 'АП', 'АЭ', 'БХ', 'ВХ'])
  analysisCode: string;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  layerNumber: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  depthFrom: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  depthTo: number;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty({ message: 'Укажите массу/объём и тару' })
  @MaxLength(200)
  mass: string;
}
