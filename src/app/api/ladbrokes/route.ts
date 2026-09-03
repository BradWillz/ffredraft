import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getLadbrokesContext, getLadbrokesHistory, getLadbrokesSession, getLadbrokesSubmissions, saveLadbrokesSubmissions, type LadbrokesSubmission } from "@/lib/ladbrokes";

export const dynamic = "force-dynamic";

export async function GET() {
  const [context, session, admin] = await Promise.all([getLadbrokesContext(), getLadbrokesSession(), isAdmin()]);
  const [submissions, history] = await Promise.all([
    getLadbrokesSubmissions(context.week),
    getLadbrokesHistory(context.lastCompletedWeek, context.owners),
  ]);
  const ownSubmission = session ? submissions.find((item) => item.rosterId === session.rosterId) : null;
  const revealedPicks = ownSubmission ? submissions.map((submission) => ({
    rosterId: submission.rosterId,
    displayName: context.owners.find((owner) => owner.rosterId === submission.rosterId)?.displayName ?? `Team ${submission.rosterId}`,
    picks: submission.picks,
  })) : null;
  return NextResponse.json({
    week: context.week,
    lastCompletedWeek: context.lastCompletedWeek,
    lockDeadline: context.lockDeadline,
    picksLocked: context.picksLocked,
    matchups: context.matchups,
    user: session ? context.owners.find((owner) => owner.rosterId === session.rosterId) ?? null : null,
    ownSubmission: ownSubmission ?? null,
    revealedPicks,
    lockStatus: context.owners.map((owner) => ({ rosterId: owner.rosterId, displayName: owner.displayName, locked: submissions.some((item) => item.rosterId === owner.rosterId) })),
    history,
    isAdmin: admin,
  });
}

export async function POST(request: Request) {
  const session = await getLadbrokesSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const context = await getLadbrokesContext();
  if (context.picksLocked) return NextResponse.json({ error: "Picks are locked for this week" }, { status: 423 });
  const body = await request.json() as { week?: number; picks?: Record<string, number> };
  if (body.week !== context.week || !body.picks) return NextResponse.json({ error: "Invalid or expired week" }, { status: 400 });
  const valid = context.matchups.length > 0 && context.matchups.every((matchup) => {
    const pick = body.picks?.[String(matchup.id)];
    return pick === matchup.team1.rosterId || pick === matchup.team2.rosterId;
  }) && Object.keys(body.picks).length === context.matchups.length;
  if (!valid) return NextResponse.json({ error: "Every matchup requires one valid pick" }, { status: 400 });
  const submissions = await getLadbrokesSubmissions(context.week);
  if (submissions.some((item) => item.rosterId === session.rosterId)) return NextResponse.json({ error: "Picks are already locked" }, { status: 409 });
  const submission: LadbrokesSubmission = { rosterId: session.rosterId, picks: body.picks, lockedAt: new Date().toISOString() };
  await saveLadbrokesSubmissions(context.week, [...submissions, submission]);
  return NextResponse.json({ locked: true, ownSubmission: submission });
}

