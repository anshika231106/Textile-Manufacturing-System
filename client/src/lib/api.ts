// Typed API error class
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getToken(): string | null {
  try {
    return localStorage.getItem('milltrace_token');
  } catch {
    return null;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = true, ...fetchOptions } = options;

  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(url, { ...fetchOptions, headers });

  if (res.status === 401 && auth) {
    // Clear invalid auth state
    try { localStorage.removeItem('milltrace_token'); } catch { /* ignore */ }
    window.location.href = '/login';
    throw new ApiError('UNAUTHORIZED', 'Session expired. Please log in again.');
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const err = json?.error ?? {};
    throw new ApiError(
      err.code ?? 'UNKNOWN_ERROR',
      err.message ?? `Request failed with status ${res.status}`,
      err.details
    );
  }

  return (json?.data ?? json) as T;
}
