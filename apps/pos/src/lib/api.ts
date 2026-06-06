import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
export const DEFAULT_API_URL =
  (process.env['EXPO_PUBLIC_API_URL'] as string | undefined) ??
  extra?.['apiUrl'] ??
  'http://10.0.2.2:3001/v1';

const API_URL_KEY = 'yf.apiUrl';
let _apiBase = DEFAULT_API_URL;

export const initApiUrl = async (): Promise<void> => {
  try {
    const stored = await AsyncStorage.getItem(API_URL_KEY);
    if (stored) _apiBase = stored;
  } catch {
    // use compile-time default
  }
};

export const setApiBase = async (url: string): Promise<void> => {
  const clean = url.trim().replace(/\/+$/, '');
  _apiBase = clean;
  await AsyncStorage.setItem(API_URL_KEY, clean);
};

export const getApiBase = (): string => _apiBase;

// ─── Error types ─────────────────────────────────────────────────────────────

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

function extractErrorMessage(message: unknown): string | undefined {
  if (typeof message === 'string') return message;
  if (message && typeof message === 'object') {
    // NestJS Zod flatten: { fieldErrors: { field: string[] }, formErrors: string[] }
    const m = message as Record<string, unknown>;
    const parts: string[] = [];
    if (m['fieldErrors'] && typeof m['fieldErrors'] === 'object') {
      for (const [field, errs] of Object.entries(m['fieldErrors'] as Record<string, string[]>)) {
        if (Array.isArray(errs)) parts.push(`${field}: ${errs.join(', ')}`);
      }
    }
    if (Array.isArray(m['formErrors'])) {
      parts.push(...(m['formErrors'] as string[]));
    }
    if (parts.length) return parts.join(' · ');
  }
  return undefined;
}

export const getErrorMessage = (err: unknown): string => {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) {
    // Surface connection errors in a user-friendly way
    if (err.message.includes('Network request failed') || err.message.includes('fetch')) {
      return `Cannot reach server at ${_apiBase}. Check the server URL in Settings.`;
    }
    return err.message;
  }
  return 'Something went wrong';
};

// ─── Fetch client ─────────────────────────────────────────────────────────────

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

  const res = await fetch(`${_apiBase}${path}`, { method, headers, body, signal });

  if (!res.ok) {
    let message = res.statusText || `HTTP ${res.status}`;
    let code: string | undefined;
    try {
      const parsed = (await res.json()) as { message?: unknown; code?: string };
      message = extractErrorMessage(parsed.message) ?? message;
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
