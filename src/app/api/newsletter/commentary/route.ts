import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { clearNewsletterCommentary, generateNewsletterCommentary } from "@/lib/newsletter-commentary";
import { getWeeklyReport } from "@/lib/weekly-report";

export const runtime = "nodejs";
export const maxDuration = 180;

async function updateCommentary(request: Request, clear: boolean) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Expected JSON" }, { status: 415 });
  }
  const body = await request.json().catch(() => null);
  const week = body?.week;
  if (!Number.isInteger(week) || week < 1 || week > 18) {
    return NextResponse.json({ error: "Choose a week from 1 to 18." }, { status: 400 });
  }
  if (!clear && !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Set OPENAI_API_KEY on the server before generating AI copy." }, { status: 503 });
  }
  if (process.env.NODE_ENV === "production"
    && (!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)
      || !(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN))) {
    return NextResponse.json({ error: "Configure shared Redis storage before saving newsletter copy in production." }, { status: 503 });
  }
  try {
    const report = await getWeeklyReport(week);
    if (week > report.lastCompletedWeek) {
      return NextResponse.json({ error: "Only completed weeks can have AI copy." }, { status: 400 });
    }
    if (clear) {
      await clearNewsletterCommentary(report);
    } else {
      await generateNewsletterCommentary(report);
    }
    return NextResponse.json({ week, url: `/newsletter/week/${week}` });
  } catch (error) {
    if (error instanceof Error && error.message === "Generation already in progress") {
      return NextResponse.json({ error: "This week is already being generated. Try again shortly." }, { status: 409 });
    }
    return NextResponse.json({ error: clear
      ? "Could not clear the saved copy. Please try again."
      : "Could not generate verified copy. The factual newsletter is unchanged. Check API access, billing and model settings before retrying." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  return updateCommentary(request, false);
}

export async function DELETE(request: Request) {
  return updateCommentary(request, true);
}