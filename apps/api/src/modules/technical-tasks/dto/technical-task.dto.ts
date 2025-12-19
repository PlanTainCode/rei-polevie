import { IsString, IsOptional } from 'class-validator';

export class CreateTechnicalTaskDto {
  @IsString()
  name: string;
}

export class UpdateTechnicalTaskDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  extractedData?: Record<string, unknown>;
}


