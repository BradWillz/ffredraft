import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getWheelState, resetWheelState, setWheelState, type WheelState } from "@/lib/wheel-state";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getWheelState());
}

export async function PUT(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = await request.json() as WheelState;
  if (!Number.isInteger(state.currentWeek) || !Array.isArray(state.availableScenarios) || !Array.isArray(state.weekResults) || !Array.isArray(state.weekWinners)) {
    return NextResponse.json({ error: "Invalid wheel state" }, { status: 400 });
  }
  await setWheelState(state);
  return NextResponse.json(state);
}

export async function DELETE() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await resetWheelState();
  return NextResponse.json(await getWheelState());
}