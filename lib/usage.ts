import {
  PRICE_INPUT_PER_M,
  PRICE_OUTPUT_PER_M,
  MONTHLY_LIMIT_USD,
} from "./constants";

export interface UsageEntry {
  ts: string;
  in: number;
  out: number;
  cost: number;
}

interface MonthBlob {
  spend: number;
  entries: UsageEntry[];
}

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

const memFallback = new Map<string, MonthBlob>();

async function getBlobStore() {
  try {
    const { getStore } = await import("@netlify/blobs");
    return getStore({ name: "hermes-usage", consistency: "strong" });
  } catch {
    return null;
  }
}

async function readBlob(key: string): Promise<MonthBlob> {
  const store = await getBlobStore();
  if (store) {
    try {
      const data = await store.get(key, { type: "json" }) as Partial<MonthBlob> | null;
      return { spend: data?.spend ?? 0, entries: data?.entries ?? [] };
    } catch {
      return memFallback.get(key) ?? { spend: 0, entries: [] };
    }
  }
  return memFallback.get(key) ?? { spend: 0, entries: [] };
}

async function writeBlob(key: string, blob: MonthBlob): Promise<void> {
  const store = await getBlobStore();
  if (store) {
    try {
      await store.set(key, JSON.stringify(blob));
      return;
    } catch {
      // fall through to mem
    }
  }
  memFallback.set(key, blob);
}

export async function getMonthlySpend(): Promise<number> {
  const { spend } = await readBlob(monthKey());
  return spend;
}

export async function getMonthlyData(): Promise<{ spend: number; entries: UsageEntry[] }> {
  return readBlob(monthKey());
}

export async function recordUsage(
  inputTokens: number,
  outputTokens: number
): Promise<{ cost: number; monthlySpend: number }> {
  const cost = calculateCost(inputTokens, outputTokens);
  const key = monthKey();
  const current = await readBlob(key);
  const newBlob: MonthBlob = {
    spend: current.spend + cost,
    entries: [
      ...current.entries,
      { ts: new Date().toISOString(), in: inputTokens, out: outputTokens, cost },
    ],
  };
  await writeBlob(key, newBlob);
  return { cost, monthlySpend: newBlob.spend };
}

export async function isOverBudget(): Promise<boolean> {
  const spend = await getMonthlySpend();
  return spend >= MONTHLY_LIMIT_USD;
}
