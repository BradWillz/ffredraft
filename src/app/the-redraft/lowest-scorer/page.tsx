"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type DanceForfeit = { week: number; dancerName: string; opponentName: string; score: number; dance: string };
type DanceCandidate = { rosterId: number; name: string; opponentName: string; score: number };
type TrackerResponse = { state: { forfeits: DanceForfeit[] }; candidates?: DanceCandidate[]; candidatesError?: string; weekFinalized?: boolean };

export default function LowestScorerPage() {
  const [forfeits, setForfeits] = useState<DanceForfeit[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [week, setWeek] = useState(1);
  const [candidates, setCandidates] = useState<DanceCandidate[]>([]);
  const [selectedName, setSelectedName] = useState("");
  const [dance, setDance] = useState("");
  const [message, setMessage] = useState("Load a week after Sleeper has finalized every score.");

  const save = async (nextForfeits: DanceForfeit[]) => {
    const response = await fetch("/api/lowest-scorer", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ forfeits: nextForfeits }) });
    if (!response.ok) throw new Error("Could not save the dance record.");
    setForfeits(nextForfeits);
  };

  const loadWeek = async (nextWeek = week) => {
    setWeek(nextWeek);
    setMessage("Loading the scorecard...");
    const response = await fetch(`/api/lowest-scorer?week=${nextWeek}`, { cache: "no-store" });
    const data = await response.json() as TrackerResponse;
    setForfeits(data.state.forfeits);
    setCandidates(data.candidates ?? []);
    setSelectedName(data.candidates?.[0]?.name ?? "");
    setMessage(data.candidatesError ?? (data.candidates?.length ? `Week ${nextWeek} is final. Lowest score is preselected and their opponent is shown.` : "No completed scores found for that week."));
  };

  useEffect(() => {
    void Promise.all([
      fetch("/api/lowest-scorer", { cache: "no-store" }).then((response) => response.json() as Promise<TrackerResponse>),
      fetch("/api/admin/session", { cache: "no-store" }).then((response) => response.json() as Promise<{ isAdmin: boolean }>),
    ]).then(([tracker, session]) => {
      setForfeits(tracker.state.forfeits);
      setIsAdmin(session.isAdmin === true);
    });
  }, []);

  const selected = candidates.find((candidate) => candidate.name === selectedName);
  const latestForfeit = forfeits.slice().sort((left, right) => right.week - left.week)[0];

  const assignDance = async () => {
    if (!selected || !dance.trim()) return;
    const forfeit: DanceForfeit = { week, dancerName: selected.name, opponentName: selected.opponentName, score: selected.score, dance: dance.trim() };
    await save([...forfeits.filter((item) => item.week !== week), forfeit].sort((left, right) => left.week - right.week));
    setDance("");
    setMessage(`${selected.name} is officially on the dance floor.`);
  };

  return (
    <main className="lowest-scorer min-h-screen">
      <section className="lowest-scorer__hero">
        <div className="lowest-scorer__hero-inner">
          <Link href="/the-redraft" className="league-hub__back">← Redraft headquarters</Link>
          <p className="eyebrow">The weekly consequence</p>
          <h1>Lowest Scorer:<br /><span>Step Up</span></h1>
          <p className="lowest-scorer__lede">Last on the scoreboard, first on the dance floor. No hiding behind the waiver wire.</p>
          <div className="lowest-scorer__rules">
            <span><b>30 sec</b> minimum dance time</span>
            <span><b>Opponent</b> calls the routine</span>
            <span><b>Final scores</b> unlock the call</span>
          </div>
        </div>
      </section>

      <section className="lowest-scorer__content">
        {latestForfeit ? <section className="lowest-scorer__spotlight" aria-label="Latest dance assignment">
          <p className="eyebrow">Week {latestForfeit.week} final score · The call is in</p>
          <h2>{latestForfeit.dancerName}, it&apos;s your time to shine.</h2>
          <p>Put on your dancing daps and show us what you&apos;ve got. <b>{latestForfeit.opponentName}</b> has called: <b>{latestForfeit.dance}</b>.</p>
          <div className="lowest-scorer__checklist">
            <span>✓ Final scores counted</span><span>✓ Dance chosen by opponent</span><span>✓ 30-second minimum</span>
          </div>
        </section> : <section className="lowest-scorer__ready"><p className="eyebrow">Dance floor clear</p><h2>Everybody survived. For now.</h2><p>The next completed game week gets its own starring performance.</p></section>}

        {isAdmin && <section className="lowest-scorer__desk">
          <div><p className="eyebrow">Commissioner&apos;s desk</p><h2>Assign the routine</h2><p>{message}</p></div>
          <div className="lowest-scorer__controls"><label>Completed week<input min="1" max="18" value={week} onChange={(event) => setWeek(Number(event.target.value))} type="number" /></label><button onClick={() => void loadWeek()}>Load scorecard</button></div>
          {candidates.length > 0 && <div className="lowest-scorer__assignment"><label>Who&apos;s dancing?<select value={selectedName} onChange={(event) => setSelectedName(event.target.value)}>{candidates.map((candidate) => <option key={candidate.rosterId} value={candidate.name}>{candidate.name} · {candidate.score.toFixed(2)} pts · vs {candidate.opponentName}</option>)}</select></label><label>Opponent&apos;s dance call<input value={dance} onChange={(event) => setDance(event.target.value)} placeholder="e.g. The Macarena in full pads" /></label><button onClick={() => void assignDance()}>Put them on the spot</button></div>}
        </section>}

        <section className="lowest-scorer__archive"><div className="lowest-scorer__archive-heading"><div><p className="eyebrow">The forfeit roll call</p><h2>Those called to dance</h2></div><b>{forfeits.length} <span>assignments</span></b></div>
          {forfeits.length === 0 ? <p className="lowest-scorer__empty">No one has been sentenced yet. Keep scoring.</p> : <div className="lowest-scorer__archive-grid">{forfeits.slice().reverse().map((forfeit) => <article key={forfeit.week} className="dance-card"><div><span>Week {forfeit.week}</span><span>Dance called</span></div><h3>{forfeit.dancerName}</h3><p><b>{forfeit.dance}</b><br />Called by {forfeit.opponentName} after {forfeit.score.toFixed(2)} points.</p></article>)}</div>}
        </section>
      </section>
    </main>
  );
}