import { apiClient } from './client';
import type { AuthResponse, UserInfo, LoginDto, RegisterDto } from '@polevie/shared';

export const authApi = {
  login: async (data: LoginDto): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  register: async (data: RegisterDto): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  getProfile: async (): Promise<UserInfo> => {
    const response = await apiClient.get<UserInfo>('/auth/profile');
    return response.data;
  },

  refresh: async (refreshToken: string): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/refresh', {
      refreshToken,
    });
    return response.data;
  },

  updateProfile: async (data: { firstName: string; lastName: string }): Promise<UserInfo> => {
    const response = await apiClient.patch<UserInfo>('/auth/profile', data);
    return response.data;
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<{ message: string }> => {
    const response = await apiClient.patch<{ message: string }>('/auth/password', data);
    return response.data;
  },
};

