export const SESSION_COOKIE = "hermes_session";

/**
 * Devuelve el token de sesión válido: SHA-256 de APP_PASSWORD.
 * Compatible con Edge Runtime (usa Web Crypto API).
 */
export async function getSessionToken(): Promise<string> {
  const password = process.env.APP_PASSWORD ?? "";
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
