import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, getSessionToken } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limiter";

// POST /api/auth — login
export async function POST(request: NextRequest) {
  // 5 intentos por IP cada 15 minutos
  const ip = getClientIp(request);
  const { allowed, retryAfter } = rateLimit(`auth:${ip}`, 5, 15 * 60 * 1000);

  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Inténtalo de nuevo más tarde." },
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
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const password =
    typeof body === "object" &&
    body !== null &&
    "password" in body &&
    typeof (body as Record<string, unknown>).password === "string"
      ? (body as Record<string, unknown>).password
      : null;

  if (!password || password !== process.env.APP_PASSWORD) {
    return NextResponse.json(
      { error: "Contraseña incorrecta" },
      { status: 401 }
    );
  }

  const token = await getSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7, // 7 días
    path: "/",
  });

  return response;
}

// DELETE /api/auth — logout
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
