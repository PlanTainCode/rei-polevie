import { apiClient } from './client';
import type { Company, CompanyMember, Invitation, CreateCompanyDto, InviteUserDto } from '@polevie/shared';

interface MyCompanyResponse extends Company {
  myRole: string;
  members: CompanyMember[];
}

export const companiesApi = {
  create: async (data: CreateCompanyDto): Promise<Company> => {
    const response = await apiClient.post<Company>('/companies', data);
    return response.data;
  },

  getMyCompany: async (): Promise<MyCompanyResponse | null> => {
    const response = await apiClient.get<MyCompanyResponse | null>('/companies/my');
    return response.data;
  },

  getById: async (id: string): Promise<Company> => {
    const response = await apiClient.get<Company>(`/companies/${id}`);
    return response.data;
  },

  getMembers: async (companyId: string): Promise<CompanyMember[]> => {
    const response = await apiClient.get<CompanyMember[]>(
      `/companies/${companyId}/members`,
    );
    return response.data;
  },

  removeMember: async (companyId: string, memberId: string): Promise<void> => {
    await apiClient.delete(`/companies/${companyId}/members/${memberId}`);
  },
};

export const invitationsApi = {
  create: async (companyId: string, data: InviteUserDto): Promise<Invitation> => {
    const response = await apiClient.post<Invitation>(
      `/invitations/company/${companyId}`,
      data,
    );
    return response.data;
  },

  getByToken: async (token: string): Promise<Invitation & { company: { id: string; name: string } }> => {
    const response = await apiClient.get(`/invitations/${token}`);
    return response.data;
  },

  accept: async (data: {
    token: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<{ success: boolean; companyId: string }> => {
    const response = await apiClient.post('/invitations/accept', data);
    return response.data;
  },

  getCompanyInvitations: async (companyId: string): Promise<Invitation[]> => {
    const response = await apiClient.get<Invitation[]>(
      `/invitations/company/${companyId}`,
    );
    return response.data;
  },

  cancel: async (invitationId: string): Promise<void> => {
    await apiClient.delete(`/invitations/${invitationId}`);
  },
};

