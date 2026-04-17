/**
 * Constantes configurables de la aplicación Hermes.
 * Todas las sensibles se leen del entorno; nunca se hardcodean aquí.
 */

/** ID del Google Doc que contiene el contexto del tutor.
 *  Obligatorio: definir en .env (local) o en las env vars de Netlify. */
export const GOOGLE_DOC_ID = process.env.CONTEXT_GOOGLE_DOC_ID ?? "";

/** URL de exportación a texto plano. Se construye a partir de GOOGLE_DOC_ID. */
export const GOOGLE_DOC_EXPORT_URL = `https://docs.google.com/document/d/${GOOGLE_DOC_ID}/export?format=txt`;

/** Tiempo máximo de espera (ms) para descargar el Google Doc. */
export const FETCH_TIMEOUT_MS = 10_000;

/** Caracteres máximos del email de entrada antes de truncar. */
export const MAX_BODY_CHARS = 6_000;
