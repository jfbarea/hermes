import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FETCH_TIMEOUT_MS,
  GOOGLE_DOC_EXPORT_URL,
  MAX_BODY_CHARS,
} from "./constants";

export const SYSTEM_INSTRUCTIONS = `Instrucciones:
- Redacta SOLO el cuerpo del email de respuesta, sin asunto ni metadatos
- Usa el mismo idioma que el correo recibido (normalmente español)
- Ajusta el tono al de los ejemplos: cercano, de tú, conciso y alentador
- Si el correo menciona el nombre del tutorizado, úsalo en el saludo
- No inventes información sobre el proceso PIR que no esté en el contexto
- Si la pregunta es muy específica y no tienes datos suficientes, redacta una respuesta
  breve indicando que se tratará en la próxima tutoría individual
- Nunca garantices resultados ni prometas plazas`;

export type ContextSource = "google_doc" | "fallback";

export interface PromptResult {
  systemMessage: string;
  userMessage: string;
  contextSource: ContextSource;
}

/** Descarga el Google Doc como texto plano. Lanza excepción si falla. */
export async function fetchGoogleDoc(): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(GOOGLE_DOC_EXPORT_URL, {
      signal: controller.signal,
      headers: { "User-Agent": "hermes/1.0" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Carga los archivos de ejemplo del directorio context/examples/. */
export function loadExamples(): string[] {
  const examplesDir = join(process.cwd(), "context", "examples");
  if (!existsSync(examplesDir)) return [];
  return readdirSync(examplesDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => readFileSync(join(examplesDir, f), "utf-8"));
}

/**
 * Construye el prompt para Claude.
 * Intenta cargar el contexto del Google Doc; cae al fichero local si falla.
 * Devuelve { systemMessage, userMessage, contextSource }.
 */
export async function buildPrompt(emailText: string): Promise<PromptResult> {
  let context: string;
  let contextSource: ContextSource;

  try {
    context = await fetchGoogleDoc();
    contextSource = "google_doc";
  } catch (err) {
    console.error("[hermes] fetchGoogleDoc failed:", err);
    const contextFile = join(process.cwd(), "context", "context.md");
    context = existsSync(contextFile)
      ? readFileSync(contextFile, "utf-8")
      : "";
    contextSource = "fallback";
  }

  const examples = loadExamples();
  const examplesBlock = examples
    .map((ex, i) => `--- Ejemplo ${i + 1} ---\n${ex}`)
    .join("\n\n");

  const systemMessage = `Eres un asistente que redacta respuestas de email en nombre de un tutor de oposiciones PIR (Psicólogo Interno Residente). El tutor gestiona ~100 tutorizados y recibe muchos correos diarios con dudas sobre el proceso de oposición, el estudio y orientación general.

A continuación tienes información de contexto sobre el tutor y el dominio PIR:
---
${context}
---

Para calibrar el tono, estos son ejemplos reales de correos recibidos y sus respuestas:
---
${examplesBlock.trim()}
---

${SYSTEM_INSTRUCTIONS}`;

  const userMessage = `Redacta una respuesta al siguiente correo:\n\n${emailText.slice(0, MAX_BODY_CHARS)}`;

  return { systemMessage, userMessage, contextSource };
}
