import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

export const AI_UNAVAILABLE_MESSAGE =
  "Analysis is unavailable right now. Your journal, risk metrics and analytics still work.";

export type AiStatus = {
  available: boolean;
  configured_providers?: string[];
  message?: string | null;
};

export function formatAiError(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { detail?: { code?: string; message?: string } | string };
    const obj = typeof body?.detail === "object" && body.detail ? body.detail : null;
    if (obj?.code === "ai_unavailable" || err.status === 503) {
      return obj?.message && !looksInternal(obj.message) ? obj.message : AI_UNAVAILABLE_MESSAGE;
    }
    if (typeof obj?.message === "string" && obj.message && !looksInternal(obj.message)) {
      return obj.message;
    }
    if (typeof body?.detail === "string" && body.detail && !looksInternal(body.detail)) {
      return body.detail;
    }
    if (err.status === 503) return AI_UNAVAILABLE_MESSAGE;
  }
  return AI_UNAVAILABLE_MESSAGE;
}

function looksInternal(message: string): boolean {
  return /API_KEY|GEMINI_|OPENROUTER_|BAZAARLINK_|env var/i.test(message);
}

export function fetchAiStatus(): Promise<AiStatus> {
  return api<AiStatus>("/api/ai/status");
}

export function useAiStatus(): AiStatus | null {
  const [status, setStatus] = useState<AiStatus | null>(null);
  useEffect(() => {
    void fetchAiStatus().then(setStatus);
  }, []);
  return status;
}
