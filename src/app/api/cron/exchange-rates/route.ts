import { NextResponse, type NextRequest } from "next/server";
import { refreshExchangeRates } from "@/lib/currency/rates";

/**
 * Daily exchange-rate refresh, called by Vercel Cron (see vercel.json).
 * Vercel sends "Authorization: Bearer $CRON_SECRET" when CRON_SECRET is set.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await refreshExchangeRates();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
