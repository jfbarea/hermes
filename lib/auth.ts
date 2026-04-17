export const SESSION_COOKIE = "hermes_session";

/**
 * Devuelve el token de sesión válido usando HMAC-SHA256.
 * Clave: APP_SECRET (secreto independiente de la contraseña).
 * Mensaje: APP_PASSWORD.
 *
 * Así, conocer la contraseña no permite fabricar un token válido
 * sin conocer también APP_SECRET.
 *
 * Compatible con Edge Runtime (usa Web Crypto API).
 */
export async function getSessionToken(): Promise<string> {
  const secret = process.env.APP_SECRET ?? process.env.APP_PASSWORD ?? "";
  const password = process.env.APP_PASSWORD ?? "";

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(password)
  );

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
