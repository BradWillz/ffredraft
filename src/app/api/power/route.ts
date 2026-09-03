import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getPowerState, POWER_OVERRIDE_KEY, type PowerOverride } from "@/lib/power";
import { sharedDelete, sharedSet } from "@/lib/shared-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getPowerState());
  } catch (error) {
    console.error("Failed to build power history", error);
    return NextResponse.json({ error: "Power history is temporarily unavailable" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as PowerOverride;
  if (!Number.isInteger(body.effectiveWeek) || body.effectiveWeek < 1 || !Number.isInteger(body.rosterId)) {
    return NextResponse.json({ error: "Invalid override" }, { status: 400 });
  }
  await sharedSet(POWER_OVERRIDE_KEY, { effectiveWeek: body.effectiveWeek, rosterId: body.rosterId });
  return NextResponse.json(await getPowerState());
}

export async function DELETE() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await sharedDelete(POWER_OVERRIDE_KEY);
  return NextResponse.json(await getPowerState());
}