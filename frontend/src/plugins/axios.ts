import type { App } from 'vue';
import apiClient from '@/core/api/ApiClient';

export default function setupAxios(app: App): void {
  app.config.globalProperties.$api = apiClient;
}
