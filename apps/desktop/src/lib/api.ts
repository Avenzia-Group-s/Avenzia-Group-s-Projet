import { API_URL } from "./config";
import { useApp } from "./store";

export class ApiError extends Error { constructor(public status: number, public code: string, public data: Record<string, unknown> = {}) { super(code); } }

export async function api<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const token = init.token ?? useApp.getState().token;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(120_000),
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    });
  } catch { throw new ApiError(0, "network"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "error", data as Record<string, unknown>);
  return data as T;
}
