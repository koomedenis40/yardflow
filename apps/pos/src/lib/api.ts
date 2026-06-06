import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
const API_BASE =
  (process.env['EXPO_PUBLIC_API_URL'] as string | undefined) ??
  extra?.['apiUrl'] ??
  'http://10.0.2.2:3001/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let onUnauthorized: (() => void) | null = null;
let unauthorizedFired = false;

export const setOnUnauthorized = (handler: () => void): void => {
  onUnauthorized = handler;
};

export const isApiError = (err: unknown): err is ApiError => err instanceof ApiError;

export const getErrorMessage = (err: unknown): string => {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
};

export async function apiFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: string;
    token?: string | null;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const { token, body, signal } = options;
  const method = options.method ?? (body ? 'POST' : 'GET');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { method, headers, body, signal });

  if (!res.ok) {
    let message = res.statusText || `HTTP ${res.status}`;
    let code: string | undefined;
    try {
      const parsed = (await res.json()) as { message?: string; code?: string };
      if (parsed.message) message = parsed.message;
      code = parsed.code;
    } catch {
      // non-JSON error body — keep statusText
    }
    if (res.status === 401 && onUnauthorized && !unauthorizedFired) {
      unauthorizedFired = true;
      onUnauthorized();
      setTimeout(() => {
        unauthorizedFired = false;
      }, 2000);
    }
    throw new ApiError(message, res.status, code);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
