import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Пароль должен быть не менее 6 символов' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Имя обязательно' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Фамилия обязательна' })
  lastName: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Пароль обязателен' })
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

