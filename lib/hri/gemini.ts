// Server-only Gemini caller shared by the robot voice chat and the passport interview.
// Gemini answers 429/500/503 when a model is busy, so this retries once and then tries a lighter model.
// The API key is read from the environment here and never leaves the server.

const TIMEOUT_MS = 12_000;
const TRANSIENT = [429, 500, 502, 503, 504];

export type GeminiOutcome<T> =
  | { ok: true; value: T }
  // status: HTTP status, 0 = timeout or network error, -1 = reply that the parser rejected.
  | { ok: false; status: number };

export async function callGemini<T>(
  body: unknown,
  parse: (payload: unknown) => T | null
): Promise<GeminiOutcome<T>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, status: 503 };

  const primary = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  const fallback = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash";
  const attempts = [primary, primary, fallback];
  const payload = JSON.stringify(body);
  const deadline = Date.now() + TIMEOUT_MS;
  let lastStatus = 0;

  for (let index = 0; index < attempts.length; index += 1) {
    const remaining = deadline - Date.now();
    if (remaining < 1500) break;
    try {
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
        // A 400/401/403/404 will not get better by retrying.
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
