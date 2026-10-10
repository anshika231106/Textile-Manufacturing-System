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

const TOKEN_KEY = 'milltrace_token';
const REFRESH_TOKEN_KEY = 'milltrace_refresh_token';

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setTokens(accessToken: string, refreshToken: string) {
  try {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch {
    /* ignore */
  }
}

function clearTokens() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

// In-flight refresh promise to prevent duplicate refresh calls
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const currentRefreshToken = getRefreshToken();
  if (!currentRefreshToken) return null;

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
      const res = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentRefreshToken }),
      });

      if (!res.ok) {
        clearTokens();
        return null;
      }

      const json = await res.json();
      const data = json?.data ?? json;
      const newAccessToken = data.accessToken || data.token;
      const newRefreshToken = data.refreshToken;

      if (newAccessToken && newRefreshToken) {
        setTokens(newAccessToken, newRefreshToken);
        return newAccessToken;
      }

      clearTokens();
      return null;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function api<T>(
  path: string,
  options: RequestInit & { auth?: boolean; _isRetry?: boolean } = {}
): Promise<T> {
  const { auth = true, _isRetry = false, ...fetchOptions } = options;

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

  // Handle 401 Unauthorized with token refresh and automatic retry
  if (res.status === 401 && auth && !_isRetry && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh')) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Retry request with fresh access token
      return api<T>(path, {
        ...options,
        _isRetry: true,
      });
    }

    // Refresh failed or no refresh token available
    clearTokens();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new ApiError('UNAUTHORIZED', 'Session expired. Please log in again.');
  }

  if (res.status === 401 && auth) {
    clearTokens();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
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

