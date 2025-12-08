export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  telegramId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  telegramId?: string;
}

