const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function buildUrl(path) {
  if (!path.startsWith("/")) {
    return `${API_BASE_URL}/${path}`;
  }

  return `${API_BASE_URL}${path}`;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : null;
}

export async function apiRequest(path, options = {}) {
  const { body, headers, ...restOptions } = options;
  const isFormData = body instanceof FormData;
  const requestHeaders = new Headers(headers ?? {});

  if (body && !isFormData && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(buildUrl(path), {
    credentials: "include",
    ...restOptions,
    headers: requestHeaders,
    body: body && !isFormData ? JSON.stringify(body) : body
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    const message = data?.message ?? "Помилка запиту";
    throw new ApiError(message, response.status, data);
  }

  return data;
}
