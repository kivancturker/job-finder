import { request } from './client';

export const health = {
  check: () => request<{ status: string; timestamp: string }>('/health')
};
