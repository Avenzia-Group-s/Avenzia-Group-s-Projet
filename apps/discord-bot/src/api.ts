const base = (process.env.API_URL || "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.INTERNAL_API_SECRET ?? "";

export async function api<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "x-internal-secret": secret, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`API ${path} -> ${res.status}`);
  return (await res.json()) as T;
}
