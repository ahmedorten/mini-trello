import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { AppConfig } from '../config/app-config';
import type { ApiResult } from './ApiResult';
import type { ApiResponse } from './ApiResponse';
import { requestInterceptor } from '../interceptors/request.interceptor';
import { responseSuccessInterceptor, responseErrorInterceptor } from '../interceptors/response.interceptor';

export class ApiClient {
  private instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      baseURL: AppConfig.apiBaseUrl,
      timeout: 10000, // 10 seconds timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.instance.interceptors.request.use(requestInterceptor, (error) => Promise.reject(error));
    this.instance.interceptors.response.use(responseSuccessInterceptor, responseErrorInterceptor);
  }

  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResult<T>> {
    try {
      const response = await this.instance.get<ApiResponse<T>>(url, config);
      return { success: true, data: response.data.data };
    } catch (error) {
      return { success: false, error: error as any };
    }
  }

  public async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResult<T>> {
    try {
      const response = await this.instance.post<ApiResponse<T>>(url, data, config);
      return { success: true, data: response.data.data };
    } catch (error) {
      return { success: false, error: error as any };
    }
  }

  public async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResult<T>> {
    try {
      const response = await this.instance.put<ApiResponse<T>>(url, data, config);
      return { success: true, data: response.data.data };
    } catch (error) {
      return { success: false, error: error as any };
    }
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResult<T>> {
    try {
      const response = await this.instance.delete<ApiResponse<T>>(url, config);
      return { success: true, data: response.data.data };
    } catch (error) {
      return { success: false, error: error as any };
    }
  }
}

export const apiClient = new ApiClient();
export default apiClient;
