import {
  PRICE_INPUT_PER_M,
  PRICE_OUTPUT_PER_M,
  MONTHLY_LIMIT_USD,
} from "./constants";

/** Devuelve la clave del mes actual, p.ej. "2026-04" */
export function monthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Calcula el coste exacto en USD a partir de los tokens de una llamada. */
export function calculateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * PRICE_INPUT_PER_M +
    (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_M
  );
}

// ---------------------------------------------------------------------------
// Persistencia: Netlify Blobs en producción, Map en memoria en dev local
// ---------------------------------------------------------------------------

const memFallback = new Map<string, number>();

async function getBlobStore() {
  try {
    const { getStore } = await import("@netlify/blobs");
    return getStore({ name: "hermes-usage", consistency: "strong" });
  } catch {
    return null;
  }
}

export async function getMonthlySpend(): Promise<number> {
  const key = monthKey();
  const store = await getBlobStore();

  if (store) {
    try {
      const data = await store.get(key, { type: "json" }) as { spend: number } | null;
      return data?.spend ?? 0;
    } catch {
      return memFallback.get(key) ?? 0;
    }
  }

  return memFallback.get(key) ?? 0;
}

export async function recordUsage(
  inputTokens: number,
  outputTokens: number
): Promise<{ cost: number; monthlySpend: number }> {
  const cost = calculateCost(inputTokens, outputTokens);
  const current = await getMonthlySpend();
  const newTotal = current + cost;
  const key = monthKey();

  const store = await getBlobStore();
  if (store) {
    try {
      await store.set(key, JSON.stringify({ spend: newTotal }));
    } catch {
      memFallback.set(key, newTotal);
    }
  } else {
    memFallback.set(key, newTotal);
  }

  return { cost, monthlySpend: newTotal };
}

export async function isOverBudget(): Promise<boolean> {
  const spend = await getMonthlySpend();
  return spend >= MONTHLY_LIMIT_USD;
}
