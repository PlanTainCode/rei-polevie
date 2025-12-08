export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface CreateCompanyDto {
  name: string;
  inn?: string;
}

export interface InviteUserDto {
  email: string;
  role: UserRole;
}

export interface AcceptInviteDto {
  token: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
}

export interface UserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyId: string | null;
  companyName: string | null;
}

export type UserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'WORKER';

