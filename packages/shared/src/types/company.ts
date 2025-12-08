export interface Company {
  id: string;
  name: string;
  inn?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyMember {
  id: string;
  userId: string;
  companyId: string;
  role: CompanyRole;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  createdAt: Date;
}

export interface Invitation {
  id: string;
  email: string;
  role: CompanyRole;
  companyId: string;
  token: string;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
}

export type CompanyRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'WORKER';

