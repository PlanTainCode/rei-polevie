import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  lastName?: string;
}

