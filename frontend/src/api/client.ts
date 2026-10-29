import createClient from "openapi-fetch";
import type { paths } from "./schema.gen";

function fetchWithCurrentGlobal(request: Request): Promise<Response> {
  return globalThis.fetch(request);
}

export const client = createClient<paths>({
  baseUrl: window.location.origin,
  fetch: fetchWithCurrentGlobal,
});

export class ApiError extends Error {
  readonly status: number;

  constructor({ status, detail }: { status: number; detail: string }) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ApiResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

export function requireData<T>(result: ApiResult<T>): T {
  if (!result.response.ok || result.data === undefined) {
    throw new ApiError({
      status: result.response.status,
      detail: `O servidor respondeu com status ${String(result.response.status)}.`,
    });
  }
  return result.data;
}
