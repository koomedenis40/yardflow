const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

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

export const setOnUnauthorized = (handler: () => void) => {
  onUnauthorized = handler;
};

export const isUnauthorizedError = (err: unknown): boolean =>
  err instanceof ApiError && err.status === 401;

export const getFetchErrorMessage = (err: unknown): string | null => {
  if (isUnauthorizedError(err)) return null;
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
};

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    let message = res.statusText;
    let code: string | undefined;
    try {
      const body = (await res.json()) as { message?: string; code?: string };
      message = body.message ?? message;
      code = body.code;
    } catch {
      /* empty */
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
