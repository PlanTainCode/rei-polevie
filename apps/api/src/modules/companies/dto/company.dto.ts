import { IsString, IsOptional, IsNotEmpty, IsEmail, IsEnum } from 'class-validator';
import { CompanyRole } from '@prisma/client';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty({ message: 'Название компании обязательно' })
  name: string;

  @IsString()
  @IsOptional()
  inn?: string;
}

export class InviteUserDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email: string;

  @IsEnum(CompanyRole, { message: 'Некорректная роль' })
  role: CompanyRole;
}

export class AcceptInviteDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty({ message: 'Пароль обязателен' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Имя обязательно' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Фамилия обязательна' })
  lastName: string;
}

