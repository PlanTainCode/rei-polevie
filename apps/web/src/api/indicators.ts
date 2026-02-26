import { apiClient } from './client';

// Типы
export interface IndicatorProject {
  id: string;
  name: string;
  documentNumber: string | null;
  objectAddress: string | null;
  indicator: {
    id: string;
    type: IndicatorType;
    protocolNumber: string | null;
    sampleCount: number | null;
    matchedSampleCount: number;
    createdAt: string;
  } | null;
  totalSamples: number;
}

export interface AvailableProject {
  id: string;
  name: string;
  documentNumber: string | null;
  objectAddress: string | null;
  sampleCount: number;
}

export type IndicatorType =
  | 'SOIL_CHEMISTRY'
  | 'WATER_CHEMISTRY'
  | 'SEDIMENT_CHEMISTRY';

export interface ChemistryValue {
  value: string | number;
  uncertainty: string | null;
  unit: string;
}

export interface RadiationValue {
  value: string | number;
  unit: string;
}

export interface IndicatorSample {
  id: string;
  sampleCipher: string;
  soilTypeCode: string | null; // 'ПС' | 'СГ' | null
  isMatched: boolean;
  matchedSample?: {
    id: string;
    cipher: string;
    description: string | null;
    depthLabel: string;
    platform?: { label: string };
  };
  chemistryData: Record<string, ChemistryValue> | null;
  radiationData: Record<string, RadiationValue> | null;
}

export interface IndicatorDetail {
  id: string;
  type: IndicatorType;
  protocolNumber: string | null;
  protocolFileName: string | null;
  samplingDate: string | null;
  testingDateFrom: string | null;
  testingDateTo: string | null;
  sampleCount: number | null;
  project: {
    id: string;
    name: string;
    documentNumber: string | null;
    objectAddress: string | null;
  };
  samples: IndicatorSample[];
}

export interface CreateIndicatorResult {
  id: string;
  type: IndicatorType;
  protocolNumber: string | null;
  sampleCount: number | null;
  matchedSampleCount: number;
  samples: {
    id: string;
    sampleCipher: string;
    soilTypeCode: string | null;
    isMatched: boolean;
    matchedSampleDescription: string | null;
  }[];
}

// API методы
export const indicatorsApi = {
  /**
   * Получить все проекты с показателями
   */
  async getAll(): Promise<IndicatorProject[]> {
    const response = await apiClient.get<IndicatorProject[]>('/indicators');
    return response.data;
  },

  /**
   * Получить проекты без показателей (для выбора)
   */
  async getAvailableProjects(): Promise<AvailableProject[]> {
    const response = await apiClient.get<AvailableProject[]>(
      '/indicators/available-projects',
    );
    return response.data;
  },

  /**
   * Создать показатели из протокола
   */
  async create(
    projectId: string,
    protocolFile: File,
  ): Promise<CreateIndicatorResult> {
    const formData = new FormData();
    formData.append('projectId', projectId);
    formData.append('protocol', protocolFile);

    const response = await apiClient.post<CreateIndicatorResult>(
      '/indicators',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response.data;
  },

  /**
   * Получить показатели по ID проекта
   */
  async getByProjectId(projectId: string): Promise<IndicatorDetail> {
    const response = await apiClient.get<IndicatorDetail>(
      `/indicators/project/${projectId}`,
    );
    return response.data;
  },

  /**
   * Удалить показатели проекта
   */
  async delete(projectId: string): Promise<{ success: boolean }> {
    const response = await apiClient.delete<{ success: boolean }>(
      `/indicators/project/${projectId}`,
    );
    return response.data;
  },
};
