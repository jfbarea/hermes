import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { buildPrompt } from "@/lib/prompt-builder";
import { rateLimit, getClientIp } from "@/lib/rate-limiter";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;

export async function POST(request: NextRequest) {
  // 20 peticiones por IP por minuto
  const ip = getClientIp(request);
  const { allowed, retryAfter } = rateLimit(`generate:${ip}`, 20, 60 * 1000);

  if (!allowed) {
    return NextResponse.json(
      { error: "Límite de peticiones alcanzado. Espera un momento." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const emailText =
    typeof body === "object" &&
    body !== null &&
    "email_text" in body &&
    typeof (body as Record<string, unknown>).email_text === "string"
      ? ((body as Record<string, unknown>).email_text as string).trim()
      : "";

  if (!emailText) {
    return NextResponse.json(
      { error: "El campo email_text es obligatorio" },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY no configurada" },
      { status: 500 }
    );
  }

  try {
    const { systemMessage, userMessage, contextSource } =
      await buildPrompt(emailText);

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemMessage,
      messages: [{ role: "user", content: userMessage }],
    });

    const draft = (response.content[0] as { text: string }).text;

    return NextResponse.json({ draft, context_source: contextSource });
  } catch (error) {
    if (error instanceof APIError) {
      return NextResponse.json(
        { error: `Error en la API de Anthropic: ${error.message}` },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
