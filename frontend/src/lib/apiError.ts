import axios from 'axios';
export function apiError(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ error?: string }>(error)) return error.response?.data?.error || fallback;
  return fallback;
}
