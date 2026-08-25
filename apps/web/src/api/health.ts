import { apiClient } from './client';

export interface DatabaseHealth {
  status: 'up' | 'down';
  latencyMs: number;
  message?: string;
}

/** Mirrors HealthResponseDto in apps/api/src/health/dto/health-response.dto.ts */
export interface HealthResponse {
  status: 'ok' | 'error';
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
  database: DatabaseHealth;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>('/health', {
    // The API answers 503 with a full, useful body when the database is down
    // (Story 03, task 8). Accept it so the UI can render the failure detail
    // instead of collapsing it into a generic network error.
    validateStatus: (status) => status === 200 || status === 503,
  });

  return response.data;
}
