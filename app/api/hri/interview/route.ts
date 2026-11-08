import { NextResponse } from "next/server";
import { callGemini, failureResponse } from "@/lib/hri/gemini";
import { finalizeInterviewReply, finalizeTalkReply } from "@/lib/hri/interview-guard";
import { buildInterviewBody, interviewRequestSchema, parseInterviewReply } from "@/lib/hri/interview-ai";
import { consumeRateLimit } from "@/lib/hri/rate-limit";
import { clientId } from "@/lib/hri/security";
import { memoryLimit } from "@/lib/hri/voice-ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const LIMIT = 60; // a conversation is about 6-10 turns, an interview 5-8
const WINDOW_SECONDS = 600; // one interview is about 5-8 turns

const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status, headers: HEADERS });

async function allowed(key: string): Promise<{ ok: boolean; retryAfter: number }> {
  try {
    const decision = await consumeRateLimit(key, LIMIT, WINDOW_SECONDS);
    return { ok: decision.allowed, retryAfter: decision.retryAfterSeconds };
  } catch {
    return { ok: memoryLimit(key, LIMIT, WINDOW_SECONDS), retryAfter: WINDOW_SECONDS };
  }
}

// HRI Passport interview. The browser sends what the person said (as text) plus neutral camera
// measurements and the current passport values; it gets back a short spoken reply and validated updates.
// The request schema has no field for anxiety, nickname, code or token, so they cannot be sent by mistake.
export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) return fail(503, "ai_unavailable");

  const limit = await allowed(`interview:${clientId(req.headers)}`);
  if (!limit.ok) return fail(429, "rate_limited", { retryAfterSeconds: limit.retryAfter });

  const parsed = interviewRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "bad_request");

  const outcome = await callGemini(buildInterviewBody(parsed.data), parseInterviewReply);
  if (!outcome.ok) {
    const { httpStatus, error } = failureResponse(outcome.status);
    return fail(httpStatus, error);
  }
  // Gemini proposes, the guard decides what may be recorded.
  const finalize = parsed.data.mode === "talk" ? finalizeTalkReply : finalizeInterviewReply;
  return NextResponse.json(finalize(parsed.data, outcome.value), { headers: HEADERS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: HEADERS });
}
