import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isAdmin } from "@/lib/admin-auth";
import { clearNewsletterCommentary, generateNewsletterCommentary } from "@/lib/newsletter-commentary";
import { getWeeklyReport } from "@/lib/weekly-report";
import { commentaryFailure, diagnosticStep, logCommentaryDiagnostic, type CommentaryDiagnostics } from "@/lib/newsletter-diagnostics";

export const runtime = "nodejs";
export const maxDuration = 180;

async function updateCommentary(request: Request, clear: boolean) {
  const diagnostics: CommentaryDiagnostics = { requestId: randomUUID() };
  const started = Date.now();
  logCommentaryDiagnostic(diagnostics, "route", "start", {
    operation: clear ? "clear" : "generate",
    apiKeyExists: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_NEWSLETTER_MODEL || "gpt-4.1",
  });
  let status = 500;
  const respond = (body: Record<string, unknown>, responseStatus: number) => {
    status = responseStatus;
    logCommentaryDiagnostic(diagnostics, "route", responseStatus >= 400 ? "rejected" : "success", {
      httpStatus: responseStatus,
      failureStage: body.stage,
      reason: body.reason ?? body.error,
    });
    return NextResponse.json({ ...body, requestId: diagnostics.requestId }, { status: responseStatus });
  };
  try {
    if (!await isAdmin()) return respond({ error: "Unauthorized" }, 401);
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return respond({ error: "Invalid origin" }, 403);
    }
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return respond({ error: "Expected JSON" }, 415);
    }
    const body = await request.json().catch((error: unknown) => {
      logCommentaryDiagnostic(diagnostics, "request_parse", "failed", { reason: "Request body was not valid JSON" }, error);
      return null;
    });
    const week = body?.week;
    if (!Number.isInteger(week) || week < 1 || week > 18) {
      return respond({ error: "Choose a week from 1 to 18." }, 400);
    }
    diagnostics.week = week;
    logCommentaryDiagnostic(diagnostics, "request", "validated");
    if (!clear && !process.env.OPENAI_API_KEY) {
      return respond({ error: "Set OPENAI_API_KEY on the server before generating AI copy.", stage: "configuration", reason: "OPENAI_API_KEY is not configured" }, 503);
    }
    if (process.env.NODE_ENV === "production"
      && (!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)
        || !(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN))) {
      return respond({ error: "Configure shared Redis storage before saving newsletter copy in production.", stage: "configuration", reason: "Shared Redis storage is not configured" }, 503);
    }
    try {
      const report = await diagnosticStep(diagnostics, "report", "Could not load the weekly report", () => getWeeklyReport(week));
      if (week > report.lastCompletedWeek) {
        return respond({ error: "Only completed weeks can have AI copy." }, 400);
      }
      if (clear) {
        await clearNewsletterCommentary(report, diagnostics);
      } else {
        await generateNewsletterCommentary(report, diagnostics);
      }
      return respond({ week, url: `/newsletter/week/${week}` }, 200);
    } catch (error) {
      const failure = commentaryFailure(error, clear ? "clear" : "generation", clear ? "Unexpected error clearing commentary" : "Unexpected commentary generation error");
      logCommentaryDiagnostic(diagnostics, failure.stage, "failed", { reason: failure.reason }, error);
      if (error instanceof Error && error.message === "Generation already in progress") {
        return respond({ error: "This week is already being generated. Try again shortly.", stage: "cache_lock", reason: "Generation already in progress" }, 409);
      }
      return respond({ error: clear
        ? "Could not clear the saved copy. Please try again."
        : "Could not generate verified copy. The factual newsletter is unchanged. Check API access, billing and model settings before retrying.", stage: failure.stage, reason: failure.reason }, 502);
    }
  } catch (error) {
    logCommentaryDiagnostic(diagnostics, "request", "failed", { reason: "Unexpected request setup failure" }, error);
    throw error;
  } finally {
    logCommentaryDiagnostic(diagnostics, "route", "end", { httpStatus: status, durationMs: Date.now() - started });
  }
}

export async function POST(request: Request) {
  return updateCommentary(request, false);
}

export async function DELETE(request: Request) {
  return updateCommentary(request, true);
}