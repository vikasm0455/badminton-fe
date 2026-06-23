// Thin fetch wrapper over the RallyUp API. Unwraps the { success, data, message }
// envelope, tracks server-clock drift for timers, and surfaces typed errors.

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

let serverOffsetMs = 0; // serverNow - clientNow

/** Server-corrected wall clock in ms (for countdown math, PRD §7.2.2). */
export function serverNow(): number {
  return Date.now() + serverOffsetMs;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  message: string | null;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const serverTime = res.headers.get("x-server-time");
  if (serverTime) {
    const parsed = Date.parse(serverTime);
    if (!Number.isNaN(parsed)) serverOffsetMs = parsed - Date.now();
  }

  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    /* non-JSON response */
  }

  if (!res.ok || !json || json.success === false) {
    const msg = json?.message || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return json.data as T;
}

/** Multipart upload (credential screenshot OCR). */
async function postForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    body: form,
    cache: "no-store",
  });
  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    /* ignore */
  }
  if (!res.ok || !json || json.success === false) {
    throw new ApiError(json?.message || `Upload failed (${res.status})`, res.status);
  }
  return json.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string, body?: unknown) => request<T>("DELETE", path, body),
  postForm,
};
