export const dynamic = "force-dynamic";

import Link from "next/link";
import { getMonthlyData, monthKey, type UsageEntry } from "@/lib/usage";
import { MONTHLY_LIMIT_USD } from "@/lib/constants";
import { ArrowLeft } from "lucide-react";

function fmt(usd: number) {
  return `$${usd.toFixed(4)}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
}

function dailyTotals(entries: UsageEntry[]): { day: string; cost: number }[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    const day = fmtDay(e.ts);
    map.set(day, (map.get(day) ?? 0) + e.cost);
  }
  return Array.from(map.entries()).map(([day, cost]) => ({ day, cost }));
}

export default async function DashboardPage() {
  const { spend, entries } = await getMonthlyData();
  const pct = Math.min(100, (spend / MONTHLY_LIMIT_USD) * 100);
  const days = dailyTotals(entries);
  const maxDayCost = days.reduce((m, d) => Math.max(m, d.cost), 0);
  const avgCost = entries.length > 0 ? spend / entries.length : 0;

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard de uso</h1>
          <span className="ml-auto text-sm text-muted-foreground">{monthKey()}</span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Gasto este mes", value: fmt(spend) },
            { label: "Límite mensual", value: `$${MONTHLY_LIMIT_USD}` },
            { label: "Llamadas", value: String(entries.length) },
            { label: "Coste medio/llamada", value: entries.length ? fmt(avgCost) : "—" },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg border border-border/60 bg-card/80 px-4 py-3 space-y-1"
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className="text-xl font-semibold">{value}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{fmt(spend)} gastados</span>
            <span>{fmt(Math.max(0, MONTHLY_LIMIT_USD - spend))} restantes</span>
          </div>
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-yellow-500" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right">{pct.toFixed(1)}% del límite</p>
        </div>

        {/* Daily chart */}
        {days.length > 0 && (
          <div className="rounded-lg border border-border/60 bg-card/80 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Gasto por día
            </h2>
            <div className="flex items-end gap-2 h-24">
              {days.map(({ day, cost }) => {
                const heightPct = maxDayCost > 0 ? (cost / maxDayCost) * 100 : 0;
                return (
                  <div key={day} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                    <span className="text-[10px] text-muted-foreground leading-none">
                      {fmt(cost)}
                    </span>
                    <div className="w-full rounded-t bg-primary/70" style={{ height: `${heightPct}%`, minHeight: "4px" }} />
                    <span className="text-[10px] text-muted-foreground leading-none truncate w-full text-center">
                      {day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Calls table */}
        <div className="rounded-lg border border-border/60 bg-card/80 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Llamadas ({entries.length})
            </h2>
          </div>
          {entries.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Sin llamadas registradas este mes.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-2 text-left font-medium">Fecha</th>
                    <th className="px-4 py-2 text-right font-medium">Tokens entrada</th>
                    <th className="px-4 py-2 text-right font-medium">Tokens salida</th>
                    <th className="px-4 py-2 text-right font-medium">Coste</th>
                  </tr>
                </thead>
                <tbody>
                  {[...entries].reverse().map((e, i) => (
                    <tr key={i} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2 tabular-nums text-muted-foreground">{fmtDate(e.ts)}</td>
                      <td className="px-4 py-2 tabular-nums text-right">{e.in.toLocaleString()}</td>
                      <td className="px-4 py-2 tabular-nums text-right">{e.out.toLocaleString()}</td>
                      <td className="px-4 py-2 tabular-nums text-right font-medium">{fmt(e.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
