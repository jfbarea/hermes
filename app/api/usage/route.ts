import { NextResponse } from "next/server";
import { getMonthlyData, monthKey } from "@/lib/usage";
import { MONTHLY_LIMIT_USD } from "@/lib/constants";

export async function GET() {
  const { spend, entries } = await getMonthlyData();
  return NextResponse.json({
    monthlySpend: spend,
    monthlyLimit: MONTHLY_LIMIT_USD,
    remaining: Math.max(0, MONTHLY_LIMIT_USD - spend),
    month: monthKey(),
    limitReached: spend >= MONTHLY_LIMIT_USD,
    entries,
  });
}
