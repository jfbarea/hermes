import { NextResponse } from "next/server";
import { getMonthlySpend, monthKey } from "@/lib/usage";
import { MONTHLY_LIMIT_USD } from "@/lib/constants";

export async function GET() {
  const monthlySpend = await getMonthlySpend();
  return NextResponse.json({
    monthlySpend,
    monthlyLimit: MONTHLY_LIMIT_USD,
    remaining: Math.max(0, MONTHLY_LIMIT_USD - monthlySpend),
    month: monthKey(),
    limitReached: monthlySpend >= MONTHLY_LIMIT_USD,
  });
}
