export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function apiBase() {
  if (typeof window === "undefined") {
    return process.env.API_URL || "http://127.0.0.1:4000";
  }
  return "";
}

export async function api<T>(path: string, init: RequestInit = {}, cookie?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (cookie) headers.set("Cookie", cookie);

  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError("Invalid server response", res.status);
    }
  }

  if (!res.ok) {
    const message = data && typeof data === "object" && "error" in data ? String(data.error) : "Request failed";
    throw new ApiError(message, res.status);
  }

  return data as T;
}

export async function fetchMe(cookie?: string) {
  try {
    return await api<{ email: string; role: string }>("/api/auth/me", {}, cookie);
  } catch {
    return null;
  }
}
