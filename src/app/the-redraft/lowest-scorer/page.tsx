"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type DanceAssignment = { week: number; dancerName: string; chooserName: string; score: number };
type TrackerResponse = { assignments: DanceAssignment[]; error?: string };

export default function LowestScorerPage() {
  const [assignments, setAssignments] = useState<DanceAssignment[]>([]);
  const [message, setMessage] = useState("Checking finalized scores...");

  useEffect(() => {
    void fetch("/api/lowest-scorer", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as TrackerResponse;
        if (!response.ok) throw new Error(data.error ?? "Could not load dance assignments.");
        setAssignments(data.assignments);
        setMessage(data.assignments.length ? "" : "No completed game weeks are available yet.");
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "Could not load dance assignments.");
      });
  }, []);

  const latestAssignment = assignments[assignments.length - 1];

  return (
    <main className="lowest-scorer min-h-screen">
      <section className="lowest-scorer__hero">
        <div className="lowest-scorer__hero-inner">
          <Link href="/the-redraft" className="league-hub__back">← Redraft headquarters</Link>
          <p className="eyebrow">The weekly consequence</p>
          <h1>Lowest Scorer:<br /><span>Step Up</span></h1>
          <p className="lowest-scorer__lede">Last on the scoreboard, first on the dance floor. No hiding behind the waiver wire.</p>
          <div className="lowest-scorer__rules">
            <span><b>1 minute</b> minimum dance time</span>
            <span><b>Opponent</b> chooses the dance</span>
            <span><b>Lowest score</b> is automatic</span>
          </div>
        </div>
      </section>

      <section className="lowest-scorer__content">
        {latestAssignment ? <section className="lowest-scorer__spotlight" aria-label="Latest dance assignment">
          <p className="eyebrow">Week {latestAssignment.week} · Automatically assigned</p>
          <h2>{latestAssignment.dancerName}, it&apos;s your time to shine.</h2>
          <p>The lowest score was <b>{latestAssignment.score.toFixed(2)} points</b>. {latestAssignment.chooserName === "No opponent this week"
            ? "There was no opponent in this matchup to choose the dance."
            : <><b>{latestAssignment.chooserName}</b> chooses the dance.</>}</p>
          <div className="lowest-scorer__checklist">
            <span>✓ Lowest score dances</span><span>✓ {latestAssignment.chooserName === "No opponent this week" ? "No opponent in matchup" : "Opponent chooses dance"}</span><span>✓ 1-minute minimum</span>
          </div>
        </section> : <section className="lowest-scorer__ready">
          <p className="eyebrow">Dance floor clear</p>
          <h2>Everybody survived. For now.</h2>
          <p>{message}</p>
        </section>}

        {latestAssignment && message && <p role="status" className="lowest-scorer__empty">{message}</p>}

        <section className="lowest-scorer__archive">
          <div className="lowest-scorer__archive-heading"><div><p className="eyebrow">The forfeit roll call</p><h2>Those called to dance</h2></div><b>{assignments.length} <span>assignments</span></b></div>
          {assignments.length === 0 ? <p className="lowest-scorer__empty">Assignments appear automatically when Sleeper finalizes a game week.</p> : <div className="lowest-scorer__archive-grid">{assignments.slice().reverse().map((assignment) => <article key={assignment.week} className="dance-card"><div><span>Week {assignment.week}</span><span>Auto-assigned</span></div><h3>{assignment.dancerName}</h3><p>Dance chooser: <b>{assignment.chooserName}</b><br />After scoring {assignment.score.toFixed(2)} points.</p></article>)}</div>}
        </section>
      </section>
    </main>
  );
}
