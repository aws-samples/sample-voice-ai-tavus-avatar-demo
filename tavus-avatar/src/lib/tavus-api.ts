import "server-only";

const TAVUS_API_BASE_URL = "https://tavusapi.com/v2";

type TavusErrorPayload = {
  error?: string;
  message?: string;
  detail?: string;
};

export function getTavusConfig() {
  const apiKey = process.env.TAVUS_API_KEY;
  const personaId = process.env.TAVUS_PERSONA_ID;

  if (!apiKey) {
    throw new Error("Missing required environment variable TAVUS_API_KEY.");
  }

  if (!personaId) {
    throw new Error("Missing required environment variable TAVUS_PERSONA_ID.");
  }

  return { apiKey, personaId };
}

export async function tavusFetch(path: string, init?: RequestInit) {
  const { apiKey } = getTavusConfig();
  const headers = new Headers(init?.headers);

  headers.set("x-api-key", apiKey);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${TAVUS_API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers,
  });
}

export async function readResponsePayload<T>(response: Response) {
  const text = await response.text();

  if (!text) {
    return {
      json: null as T | null,
      text,
    };
  }

  try {
    return {
      json: JSON.parse(text) as T,
      text,
    };
  } catch {
    return {
      json: null as T | null,
      text,
    };
  }
}

export function getTavusErrorMessage(
  response: Response,
  payload: unknown,
  fallback: string,
) {
  const errorPayload = payload as TavusErrorPayload | null;

  if (errorPayload?.message) {
    return errorPayload.message;
  }

  if (errorPayload?.detail) {
    return errorPayload.detail;
  }

  if (errorPayload?.error) {
    return errorPayload.error;
  }

  return `${fallback} (HTTP ${response.status})`;
}
