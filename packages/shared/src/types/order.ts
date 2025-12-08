// Приказ/Поручение
export interface Order {
  id: string;
  companyId: string;
  number: string;
  clientName: string;
  objectName: string;
  description?: string;
  originalFileName: string;
  originalFileUrl: string;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderStatus = 'DRAFT' | 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';

export interface CreateOrderDto {
  number: string;
  clientName: string;
  objectName: string;
  description?: string;
}

export interface ParsedOrderData {
  clientName: string;
  objectName: string;
  sampleCount: number;
  sampleDepth: number;
  platformCount: number;
  sampleTypes: string[];
}

