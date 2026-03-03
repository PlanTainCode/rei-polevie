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
  // Связь родитель-дочерний (допотбор)
  parentProjectId: string | null;
  parentProject?: {
    id: string;
    name: string;
  } | null;
  childProjects?: {
    id: string;
    name: string;
  }[];
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

export type ExcelGenerateMode = 'full' | 'acts' | 'requests' | 'tags' | 'field-tables';

export interface DashboardStats {
  role: string;
  totalProjects: number;
  activeProjects: number;
  samplesInProgress: number;
  completedThisMonth: number;
  membersCount: number;
  recentProjects: Array<{
    id: string;
    name: string;
    objectName: string | null;
    objectAddress: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
    samplesCount: number;
    createdBy: { id: string; firstName: string; lastName: string } | null;
  }>;
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

export interface GenerateProgramIeiResult {
  success: boolean;
  fileName: string;
  downloadUrl: string;
}

// Программа ИЭИ
export interface ProgramIei {
  id: string;
  projectId: string;
  overviewImageName: string | null;
  overviewImageUrl: string | null;
  cadastralNumber: string | null;
  egrnDescription: string | null;
  coordinatesLat: string | null;
  coordinatesLon: string | null;
  nearbySouth: string | null;
  nearbyEast: string | null;
  nearbyWest: string | null;
  nearbyNorth: string | null;
  openGroundPercent: number | null;
  section82Text: string | null;
  generatedFileName: string | null;
  generatedFileUrl: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProgramIeiData {
  cadastralNumber?: string;
  egrnDescription?: string;
  nearbySouth?: string;
  nearbyEast?: string;
  nearbyWest?: string;
  nearbyNorth?: string;
  openGroundPercent?: number | null;
  section82Text?: string;
}

// Расстояние от офиса до объекта
export interface DistanceResult {
  distanceKm: number | null;
  fromAddress: string;
  toAddress: string;
  yandexMapsUrl: string | null;
  isManual?: boolean;
  error?: string;
}

// Типы для запросов справок
export type InquiryRegion = 'MOSCOW' | 'MOSCOW_OBLAST';

export interface InquiryType {
  id: string;
  name: string;
  shortName: string;
  templateFile: string;
  order: number;
  description?: string;
  email?: string;
}

export interface GeneratedInquiryFile {
  inquiryId: string;
  inquiryName: string;
  fileName: string;
  fileUrl: string;
  generatedAt: string;
}

export interface InquiryRequest {
  id: string;
  projectId: string;
  region: InquiryRegion;
  selectedInquiries: string[];
  additionalData?: Record<string, string>;
  generatedFiles?: GeneratedInquiryFile[];
  generatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableInquiriesResponse {
  region: InquiryRegion;
  regionName: string;
  inquiries: InquiryType[];
}

export interface UpdateInquiryRequestData {
  selectedInquiries?: string[];
  additionalData?: Record<string, string>;
}

export interface GenerateInquiriesResult {
  success: boolean;
  generatedFiles: GeneratedInquiryFile[];
  errors?: { inquiryId: string; error: string }[];
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

export interface PlatformWithSamples extends Platform {
  _count: { samples: number };
  samples: Array<{
    id: string;
    status: string;
    latitude: string | null;
    longitude: string | null;
  }>;
}

export const projectsApi = {
  getDashboardStats: async (): Promise<DashboardStats> => {
    const response = await apiClient.get<DashboardStats>('/projects/dashboard-stats');
    return response.data;
  },

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

  regenerateFromTz: async (id: string, tzFile: File): Promise<Project> => {
    const formData = new FormData();
    formData.append('tz', tzFile);
    const response = await apiClient.post<Project>(
      `/projects/${id}/regenerate-from-tz`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response.data;
  },

  // Создать дочерний проект (допотбор)
  createChildProject: async (parentId: string, name: string, orderFile: File): Promise<Project> => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('order', orderFile);
    const response = await apiClient.post<Project>(
      `/projects/${parentId}/create-child`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response.data;
  },

  // Получить список дочерних проектов (допотборов)
  getChildProjects: async (parentId: string): Promise<Project[]> => {
    const response = await apiClient.get<Project[]>(`/projects/${parentId}/children`);
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

  generateExcel: async (projectId: string, mode: ExcelGenerateMode = 'full'): Promise<GenerateExcelResult> => {
    const response = await apiClient.post<GenerateExcelResult>(
      `/projects/${projectId}/generate-excel`,
      { mode },
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

  // ========== ПЛОЩАДКИ ==========

  getPlatforms: async (projectId: string): Promise<PlatformWithSamples[]> => {
    const response = await apiClient.get<PlatformWithSamples[]>(`/projects/${projectId}/platforms`);
    return response.data;
  },

  updatePlatformCoordinates: async (
    projectId: string,
    platformId: string,
    data: { latitude?: string; longitude?: string },
  ): Promise<{ updated: number }> => {
    const response = await apiClient.patch(`/projects/${projectId}/platforms/${platformId}/coordinates`, data);
    return response.data;
  },

  collectPlatformSamples: async (projectId: string, platformId: string): Promise<{ collected: number }> => {
    const response = await apiClient.post(`/projects/${projectId}/platforms/${platformId}/collect`);
    return response.data;
  },

  setPlatformDescription: async (
    projectId: string,
    platformId: string,
    description: string,
  ): Promise<{ updated: number }> => {
    const response = await apiClient.patch(`/projects/${projectId}/platforms/${platformId}/description`, { description });
    return response.data;
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

  generateProgramIei: async (projectId: string): Promise<GenerateProgramIeiResult> => {
    const response = await apiClient.post<GenerateProgramIeiResult>(
      `/projects/${projectId}/generate-program-iei`,
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

  voiceDescribePhoto: async (
    projectId: string,
    photoId: string,
    audioBlob: Blob,
  ): Promise<{ transcription: string; photo: Photo }> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice.webm');
    const response = await apiClient.post(
      `/projects/${projectId}/photos/${photoId}/voice-description`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 },
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

  // ========== ПРОГРАММА ИЭИ ==========

  getProgramIei: async (projectId: string): Promise<ProgramIei> => {
    const response = await apiClient.get<ProgramIei>(`/projects/${projectId}/program-iei`);
    return response.data;
  },

  updateProgramIei: async (projectId: string, data: UpdateProgramIeiData): Promise<ProgramIei> => {
    const response = await apiClient.patch<ProgramIei>(`/projects/${projectId}/program-iei`, data);
    return response.data;
  },

  uploadOverviewImage: async (projectId: string, file: File): Promise<ProgramIei> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<ProgramIei>(
      `/projects/${projectId}/program-iei/overview-image`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response.data;
  },

  deleteOverviewImage: async (projectId: string): Promise<ProgramIei> => {
    const response = await apiClient.delete<ProgramIei>(`/projects/${projectId}/program-iei/overview-image`);
    return response.data;
  },

  getOverviewImageUrl: (imageName: string): string => {
    return `/api/uploads/program-iei/${imageName}`;
  },

  // Получить расстояние от офиса до объекта
  getDistanceToObject: async (projectId: string): Promise<DistanceResult> => {
    const response = await apiClient.get<DistanceResult>(`/projects/${projectId}/distance`);
    return response.data;
  },

  // Сохранить расстояние вручную
  updateDistance: async (projectId: string, distanceKm: number | null): Promise<void> => {
    await apiClient.patch(`/projects/${projectId}/distance`, { distanceKm });
  },

  // Пересчитать расстояние через API
  recalculateDistance: async (projectId: string): Promise<DistanceResult> => {
    const response = await apiClient.post<DistanceResult>(`/projects/${projectId}/distance/recalculate`);
    return response.data;
  },

  // ========== ЗАПРОСЫ СПРАВОК ==========

  getInquiryRequest: async (projectId: string): Promise<InquiryRequest> => {
    const response = await apiClient.get<InquiryRequest>(
      `/projects/${projectId}/inquiry-requests`,
    );
    return response.data;
  },

  getAvailableInquiries: async (projectId: string): Promise<AvailableInquiriesResponse> => {
    const response = await apiClient.get<AvailableInquiriesResponse>(
      `/projects/${projectId}/inquiry-requests/available`,
    );
    return response.data;
  },

  updateInquiryRequest: async (
    projectId: string,
    data: UpdateInquiryRequestData,
  ): Promise<InquiryRequest> => {
    const response = await apiClient.patch<InquiryRequest>(
      `/projects/${projectId}/inquiry-requests`,
      data,
    );
    return response.data;
  },

  generateInquiries: async (
    projectId: string,
    inquiryIds: string[],
    attachmentPdf?: File,
  ): Promise<GenerateInquiriesResult> => {
    const formData = new FormData();
    formData.append('inquiryIds', JSON.stringify(inquiryIds));
    
    if (attachmentPdf) {
      formData.append('attachmentPdf', attachmentPdf);
    }
    
    const response = await apiClient.post<GenerateInquiriesResult>(
      `/projects/${projectId}/inquiry-requests/generate`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300000, // 5 минут на генерацию и конвертацию PDF
      },
    );
    return response.data;
  },

  downloadInquiry: async (projectId: string, fileName: string): Promise<void> => {
    const response = await apiClient.get(
      `/projects/${projectId}/inquiry-requests/download/${fileName}`,
      { responseType: 'blob' },
    );

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // Получить blob URL для просмотра PDF
  getInquiryPdfBlobUrl: async (projectId: string, fileName: string): Promise<string> => {
    const response = await apiClient.get(
      `/projects/${projectId}/inquiry-requests/download/${fileName}`,
      { responseType: 'blob' },
    );

    const blob = new Blob([response.data], { type: 'application/pdf' });
    return window.URL.createObjectURL(blob);
  },

  // Отправить справку на email ведомства
  sendInquiryEmail: async (
    projectId: string,
    inquiryId: string,
    email: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    const response = await apiClient.post(
      `/projects/${projectId}/inquiry-requests/send-email`,
      { inquiryId, email },
    );
    return response.data;
  },

  // Проверить статус email сервиса
  getEmailStatus: async (projectId: string): Promise<{ configured: boolean }> => {
    const response = await apiClient.get(
      `/projects/${projectId}/inquiry-requests/email-status`,
    );
    return response.data;
  },
};

