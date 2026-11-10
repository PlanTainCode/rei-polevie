import { apiClient } from './client';

export interface MaedSummary {
  mean: number;
  uncertainty: number | null;
  meanWithUncertainty: number | null;
  max: number;
  min: number;
}

export interface MaedProtocol {
  id: string;
  protocolNumber: string | null;
  measurementDate: string | null;
  fileName: string;
  uncertainty: number | null;
  instrumentName: string | null;
  calculation: {
    method: 'mr' | 'manual';
    settings: MaedCalculationSettings | null;
    typeA: number | null;
    typeBPercent: number | null;
    combinedPercent: number | null;
    sourceUrl: string | null;
    reason: string | null;
  };
  points: { number: string; value: number; uncertainty: number | null; belowLimit?: boolean; sourceValue?: string }[];
  summary: MaedSummary;
}

export interface MaedCalculationSettings {
  mainErrorPercent: number;
  additionalErrorsPercent: number[];
}

export const maedApi = {
  async list(projectId: string): Promise<MaedProtocol[]> {
    return (await apiClient.get<MaedProtocol[]>(`/projects/${projectId}/maed`)).data;
  },
  async upload(projectId: string, file: File): Promise<MaedProtocol> {
    const body = new FormData();
    body.append('protocol', file);
    return (await apiClient.post<MaedProtocol>(`/projects/${projectId}/maed`, body)).data;
  },
  async updateUncertainty(projectId: string, id: string, uncertainty: number | null): Promise<MaedProtocol> {
    return (await apiClient.patch<MaedProtocol>(`/projects/${projectId}/maed/${id}`, { uncertainty })).data;
  },
  async updateCalculation(projectId: string, id: string, settings: MaedCalculationSettings): Promise<MaedProtocol> {
    return (await apiClient.patch<MaedProtocol>(`/projects/${projectId}/maed/${id}/calculation`, settings)).data;
  },
  async delete(projectId: string, id: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/maed/${id}`);
  },
};
