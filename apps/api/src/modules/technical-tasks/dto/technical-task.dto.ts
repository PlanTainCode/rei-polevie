import { IsString, IsOptional, IsIn, IsObject } from 'class-validator';

export class CreateTechnicalTaskDto {
  @IsString()
  name: string;

  /** Откуда берутся вводные: Word/PDF заказчика, XML задания на проектирование или с нуля. */
  @IsOptional()
  @IsIn(['WORD', 'DESIGN_XML', 'SCRATCH'])
  source?: 'WORD' | 'DESIGN_XML' | 'SCRATCH';
}

export class UpdateTechnicalTaskDto {
  @IsOptional()
  @IsString()
  name?: string;

  /** Модель задания (TzXmlModel). */
  @IsOptional()
  @IsObject()
  xmlData?: Record<string, unknown>;
}
