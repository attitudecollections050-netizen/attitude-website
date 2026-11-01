import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { myDevices } from "@/lib/push";

/** GET /api/push/devices — the signed-in person's devices receiving push. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  return NextResponse.json({ devices: await myDevices(user.id) }, { headers: { "Cache-Control": "no-store" } });
}
