import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { WHEEL_SCENARIOS } from "@/lib/wheel-state";
import { calculateWheelWinner } from "@/lib/wheel-winner";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const week = Number(searchParams.get("week"));
  const scenario = searchParams.get("scenario") ?? "";
  if (!Number.isInteger(week) || week < 1 || week > 18 || !WHEEL_SCENARIOS.includes(scenario)) {
    return NextResponse.json({ error: "Invalid week or scenario" }, { status: 400 });
  }

  try {
    const winner = await calculateWheelWinner(week, scenario);
    if (!winner) return NextResponse.json({ error: `No qualifying result found for "${scenario}" in Week ${week}` }, { status: 404 });
    return NextResponse.json(winner);
  } catch {
    return NextResponse.json({ error: "Failed to calculate winner" }, { status: 502 });
  }
}
