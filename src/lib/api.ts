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

/** Multipart upload (credential screenshot OCR / board scan). */
async function postForm<T>(path: string, form: FormData): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      credentials: "include",
      body: form,
      cache: "no-store",
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError("Upload failed — check your connection and try again.", 0);
  } finally {
    clearTimeout(timer);
  }
  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    /* non-JSON (e.g. a bare proxy 502) */
  }
  if (!res.ok || !json || json.success === false) {
    const fallback =
      res.status >= 500
        ? "Upload failed — try a screenshot, or enter the details manually."
        : `Upload failed (${res.status})`;
    throw new ApiError(json?.message || fallback, res.status);
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
