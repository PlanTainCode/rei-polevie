import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

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

