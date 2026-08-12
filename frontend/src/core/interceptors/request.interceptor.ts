import type { InternalAxiosRequestConfig } from 'axios';
import { SessionManager } from '@/core/auth/SessionManager';

export function requestInterceptor(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  const token = SessionManager.getToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const correlationId =
    crypto.randomUUID?.() || Math.random().toString(36).substring(2);
  if (config.headers) {
    config.headers['X-Correlation-ID'] = correlationId;
  }

  return config;
}
