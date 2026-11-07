import { NextResponse } from "next/server";
import { callGemini, failureResponse } from "@/lib/hri/gemini";
import { consumeRateLimit } from "@/lib/hri/rate-limit";
import { clientId } from "@/lib/hri/security";
import { buildGeminiBody, memoryLimit, parseGeminiReply, requestSchema } from "@/lib/hri/voice-ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const LIMIT = 20;
const WINDOW_SECONDS = 60;

const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status, headers: HEADERS });

async function allowed(key: string): Promise<{ ok: boolean; retryAfter: number }> {
  try {
    const decision = await consumeRateLimit(key, LIMIT, WINDOW_SECONDS);
    return { ok: decision.allowed, retryAfter: decision.retryAfterSeconds };
  } catch {
    // Database unreachable: keep the protection with a per-instance limiter instead of failing open.
    return { ok: memoryLimit(key, LIMIT, WINDOW_SECONDS), retryAfter: WINDOW_SECONDS };
  }
}

// Voice chat for the simulated robot: text in, a short Thai reply and one optional action out.
// The browser does speech-to-text and text-to-speech; the API key stays on the server.
export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) return fail(503, "ai_unavailable");

  const limit = await allowed(`voicechat:${clientId(req.headers)}`);
  if (!limit.ok) return fail(429, "rate_limited", { retryAfterSeconds: limit.retryAfter });

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "bad_request");

  const outcome = await callGemini(buildGeminiBody(parsed.data), parseGeminiReply);
  if (!outcome.ok) {
    const { httpStatus, error } = failureResponse(outcome.status);
    return fail(httpStatus, error);
  }
  return NextResponse.json(outcome.value, { headers: HEADERS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: HEADERS });
}
