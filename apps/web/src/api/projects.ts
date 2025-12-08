import { apiClient } from './client';

export interface Project {
  id: string;
  name: string;
  tzFileName: string | null;
  tzFileUrl: string | null;
  orderFileName: string | null;
  orderFileUrl: string | null;
  // Извлечённые данные
  objectName: string | null;
  objectAddress: string | null;
  objectPurpose: string | null;
  documentNumber: string | null;
  clientName: string | null;
  services: ServiceMatch[] | null;
  // Сгенерированный файл
  generatedFileName: string | null;
  generatedFileUrl: string | null;
  generatedAt: string | null;
  processedAt: string | null;
  status: string;
  createdById: string;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  updatedAt: string;
  canEdit?: boolean;
  canDelete?: boolean;
  _count?: {
    samples: number;
    platforms: number;
  };
}

export interface ParsedDocumentInfo {
  rawText: string;
  paragraphs: string[];
  tables: string[][];
  extractedData: {
    clientName?: string;
    objectName?: string;
    address?: string;
    sampleCount?: number;
    depth?: string;
    dates?: string[];
    numbers?: string[];
  };
}

export interface ParsedDocuments {
  tz?: ParsedDocumentInfo;
  order?: ParsedDocumentInfo;
}

export interface ServiceMatch {
  row: number;
  num: number;
  category: string;
  name: string;
  unit: string;
  quantity: number | string;
  confidence: number;
  matchedText?: string;
}

export interface GenerateExcelResult {
  fileName: string;
  downloadUrl: string;
  objectPurpose: string;
  services: ServiceMatch[];
}

export interface GenerateFmbaResult {
  success: boolean;
  fileName?: string;
  downloadUrl?: string;
  message?: string;
}

// Типы для проб
export interface Platform {
  id: string;
  projectId: string;
  number: number;
  type: 'PP' | 'SK' | 'DO' | 'V';
  label: string;
}

export interface Sample {
  id: string;
  projectId: string;
  platformId: string;
  cipher: string;
  sampleNumber: number;
  analysisCode: string;
  layerNumber: number;
  depthFrom: number;
  depthTo: number;
  depthLabel: string;
  type: string;
  description: string | null;
  mass: string;
  latitude: string | null;
  longitude: string | null;
  gpsPhotoUrl: string | null;
  isSubcontract: boolean;
  status: 'PENDING' | 'COLLECTED' | 'DELIVERED' | 'ANALYZED' | 'COMPLETED';
  collectedAt: string | null;
  collectedById: string | null;
  platform: Platform;
}

export interface UpdateSampleData {
  description?: string;
  latitude?: string;
  longitude?: string;
}

export const projectsApi = {
  create: async (formData: FormData): Promise<Project> => {
    const response = await apiClient.post<Project>('/projects', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getAll: async (): Promise<Project[]> => {
    const response = await apiClient.get<Project[]>('/projects');
    return response.data;
  },

  getById: async (id: string): Promise<Project> => {
    const response = await apiClient.get<Project>(`/projects/${id}`);
    return response.data;
  },

  update: async (id: string, formData: FormData): Promise<Project> => {
    const response = await apiClient.patch<Project>(`/projects/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}`);
  },

  parseDocuments: async (id: string): Promise<ParsedDocuments> => {
    const response = await apiClient.get<ParsedDocuments>(`/projects/${id}/parse`);
    return response.data;
  },

  reprocess: async (id: string): Promise<Project> => {
    const response = await apiClient.post<Project>(`/projects/${id}/reprocess`);
    return response.data;
  },

  getFileUrl: (projectId: string, type: 'tz' | 'order'): string => {
    return `/api/projects/${projectId}/files/${type}`;
  },

  generateExcel: async (projectId: string): Promise<GenerateExcelResult> => {
    const response = await apiClient.post<GenerateExcelResult>(
      `/projects/${projectId}/generate-excel`,
    );
    return response.data;
  },

  downloadExcel: async (projectId: string, fileName: string): Promise<void> => {
    const response = await apiClient.get(`/projects/${projectId}/excel/${fileName}`, {
      responseType: 'blob',
    });
    
    // Создаём ссылку для скачивания
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // ========== РАБОТА С ПРОБАМИ ==========

  getSamples: async (projectId: string): Promise<Sample[]> => {
    const response = await apiClient.get<Sample[]>(`/projects/${projectId}/samples`);
    return response.data;
  },

  updateSample: async (projectId: string, sampleId: string, data: UpdateSampleData): Promise<Sample> => {
    const response = await apiClient.patch<Sample>(`/projects/${projectId}/samples/${sampleId}`, data);
    return response.data;
  },

  collectSample: async (projectId: string, sampleId: string): Promise<Sample> => {
    const response = await apiClient.post<Sample>(`/projects/${projectId}/samples/${sampleId}/collect`);
    return response.data;
  },

  regenerateSamples: async (projectId: string): Promise<Sample[]> => {
    const response = await apiClient.post<Sample[]>(`/projects/${projectId}/regenerate-samples`);
    return response.data;
  },

  // ========== ГЕНЕРАЦИЯ ЗАЯВКИ ФМБА ==========

  generateFmba: async (projectId: string): Promise<GenerateFmbaResult> => {
    const response = await apiClient.post<GenerateFmbaResult>(
      `/projects/${projectId}/generate-fmba`,
    );
    return response.data;
  },

  downloadWord: async (projectId: string, fileName: string): Promise<void> => {
    const response = await apiClient.get(`/projects/${projectId}/word/${fileName}`, {
      responseType: 'blob',
    });
    
    // Создаём ссылку для скачивания
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

