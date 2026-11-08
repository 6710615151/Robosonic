// Server-only Gemini caller shared by the robot voice chat and the passport interview.
// Gemini answers 429/500/503 when a model is busy, so this retries once and then tries a lighter model.
// The API key is read from the environment here and never leaves the server.

const TIMEOUT_MS = 12_000;
const TRANSIENT = [429, 500, 502, 503, 504];

export type GeminiOutcome<T> =
  | { ok: true; value: T }
  // status: HTTP status, 0 = timeout or network error, -1 = reply that the parser rejected.
  | { ok: false; status: number };

// The request bodies ask for "no thinking" so replies are quick. Newer models (3.5 and up) refuse the older
// `thinkingBudget: 0` with a 400 and want `thinkingLevel: "minimal"` instead, so the setting is adapted per model.
export function bodyForModel(body: unknown, model: string): unknown {
  const config = (body as { generationConfig?: { thinkingConfig?: unknown } } | null)?.generationConfig;
  if (!config?.thinkingConfig) return body;
  const modern = /^gemini-(?:[4-9]|3\.[5-9])/.test(model);
  if (!modern) return body;
  return { ...(body as object), generationConfig: { ...config, thinkingConfig: { thinkingLevel: "minimal" } } };
}

function withoutThinking(body: unknown): unknown {
  const config = (body as { generationConfig?: Record<string, unknown> } | null)?.generationConfig;
  if (!config?.thinkingConfig) return body;
  const { thinkingConfig: _dropped, ...rest } = config;
  void _dropped;
  return { ...(body as object), generationConfig: rest };
}

export async function callGemini<T>(
  body: unknown,
  parse: (payload: unknown) => T | null
): Promise<GeminiOutcome<T>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, status: 503 };

  const primary = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const fallback = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite";
  const attempts = [primary, primary, fallback];
  const deadline = Date.now() + TIMEOUT_MS;
  let lastStatus = 0;
  // A model that rejects the thinking setting (400) is tried once more without it, then remembered.
  const noThinking = new Set<string>();

  for (let index = 0; index < attempts.length; index += 1) {
    const remaining = deadline - Date.now();
    if (remaining < 1500) break;
    try {
      const adapted = noThinking.has(attempts[index]) ? withoutThinking(body) : bodyForModel(body, attempts[index]);
      const payload = JSON.stringify(adapted);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(attempts[index])}:generateContent`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
          body: payload,
          signal: AbortSignal.timeout(Math.min(remaining, 6000)),
          cache: "no-store"
        }
      );
      if (response.ok) {
        const value = parse(await response.json());
        if (value !== null) return { ok: true, value };
        lastStatus = -1; // unusable reply: try again
      } else {
        lastStatus = response.status;
        // A 400 is most often the thinking setting on a model that does not take it: retry without it, once.
        if (response.status === 400 && !noThinking.has(attempts[index]) && withoutThinking(body) !== body) {
          noThinking.add(attempts[index]);
          index -= 1;
          continue;
        }
        // A 401/403/404 (or any other 400) will not get better by retrying.
        if (!TRANSIENT.includes(response.status)) break;
      }
    } catch (error) {
      lastStatus = 0;
      console.error("Gemini request error", error instanceof Error ? error.name : "unknown");
    }
    if (index < attempts.length - 1) await new Promise((resolve) => setTimeout(resolve, 350 * (index + 1)));
  }

  // Log the status only: never the key, and not the person's words.
  console.error("Gemini gave up", lastStatus);
  return { ok: false, status: lastStatus };
}

export function failureResponse(status: number): { httpStatus: number; error: string } {
  if (status === 503 && !process.env.GEMINI_API_KEY) return { httpStatus: 503, error: "ai_unavailable" };
  if (status === 429) return { httpStatus: 503, error: "ai_busy" }; // Google's per-minute quota
  if (status === 0) return { httpStatus: 504, error: "ai_timeout" };
  if (status === -1) return { httpStatus: 502, error: "ai_bad_reply" };
  return { httpStatus: 502, error: "ai_error" };
}
