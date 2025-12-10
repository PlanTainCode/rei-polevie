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

// Типы для фотографий
export interface Photo {
  id: string;
  projectId: string;
  filename: string;
  originalName: string;
  thumbnailName: string | null;
  description: string | null;
  latitude: string | null;
  longitude: string | null;
  photoDate: string | null;
  sortOrder: number;
  uploadedAt: string;
  uploadedById: string | null;
  uploadedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface UpdatePhotoData {
  description?: string;
  photoDate?: string;
  latitude?: string;
  longitude?: string;
}

export interface PhotoUploadResult {
  success: boolean;
  photo?: Photo;
  error?: string;
  filename?: string;
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

  setDocumentDates: async (
    id: string, 
    dates: { ilcRequestDate?: string; fmbaRequestDate?: string; samplingDate?: string }
  ): Promise<Project> => {
    const response = await apiClient.post<Project>(`/projects/${id}/document-dates`, dates);
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

  // ========== РАБОТА С ФОТОГРАФИЯМИ ==========

  getPhotos: async (projectId: string): Promise<Photo[]> => {
    const response = await apiClient.get<Photo[]>(`/projects/${projectId}/photos`);
    return response.data;
  },

  uploadPhotos: async (projectId: string, files: File[]): Promise<PhotoUploadResult[]> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('photos', file);
    });
    const response = await apiClient.post<PhotoUploadResult[]>(
      `/projects/${projectId}/photos`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response.data;
  },

  updatePhoto: async (projectId: string, photoId: string, data: UpdatePhotoData): Promise<Photo> => {
    const response = await apiClient.patch<Photo>(`/projects/${projectId}/photos/${photoId}`, data);
    return response.data;
  },

  reorderPhotos: async (projectId: string, orders: { id: string; sortOrder: number }[]): Promise<Photo[]> => {
    const response = await apiClient.patch<Photo[]>(`/projects/${projectId}/photos-reorder`, { orders });
    return response.data;
  },

  deletePhoto: async (projectId: string, photoId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/photos/${photoId}`);
  },

  getPhotoThumbnailUrl: (projectId: string, photoId: string): string => {
    return `/projects/${projectId}/photos/${photoId}/thumbnail`;
  },

  getPhotoOriginalUrl: (projectId: string, photoId: string): string => {
    return `/projects/${projectId}/photos/${photoId}/original`;
  },

  // Извлекает имя файла из Content-Disposition заголовка
  _extractFilename: (contentDisposition: string | undefined, fallback: string): string => {
    if (!contentDisposition) return fallback;
    
    // Пробуем filename*=UTF-8''...
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match) {
      return decodeURIComponent(utf8Match[1]);
    }
    
    // Пробуем filename="..."
    const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
    if (quotedMatch) {
      return decodeURIComponent(quotedMatch[1]);
    }
    
    // Пробуем filename=...
    const plainMatch = contentDisposition.match(/filename=([^;\s]+)/i);
    if (plainMatch) {
      return decodeURIComponent(plainMatch[1]);
    }
    
    return fallback;
  },

  // Скачать отдельное фото
  downloadPhoto: async (projectId: string, photoId: string): Promise<void> => {
    const response = await apiClient.get(`/projects/${projectId}/photos/${photoId}/original`, {
      responseType: 'blob',
    });
    
    const filename = projectsApi._extractFilename(response.headers['content-disposition'], 'photo.jpg');
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // Скачать все фото как ZIP
  downloadAllPhotos: async (projectId: string): Promise<void> => {
    const response = await apiClient.get(`/projects/${projectId}/photos-download`, {
      responseType: 'blob',
      timeout: 120000, // 2 минуты на большие архивы
    });
    
    const filename = projectsApi._extractFilename(response.headers['content-disposition'], 'photos.zip');
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // Сгенерировать фотоальбом (PPTX)
  generatePhotoAlbum: async (projectId: string, crewMembers: string): Promise<void> => {
    const response = await apiClient.post(
      `/projects/${projectId}/generate-album`,
      { crewMembers },
      {
        responseType: 'blob',
        timeout: 180000, // 3 минуты на генерацию
      },
    );
    
    const filename = projectsApi._extractFilename(response.headers['content-disposition'], 'album.pptx');
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

