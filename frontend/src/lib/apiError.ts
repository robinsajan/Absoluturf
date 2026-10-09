import axios from 'axios';
export function apiError(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    if (error.response?.data?.error) return error.response.data.error;
    if (error.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.';
    if (!error.response) return 'Unable to connect to the server. Please try again shortly.';
    return fallback;
  }
  return fallback;
}
