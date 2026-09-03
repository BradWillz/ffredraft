"use client";

import { useState, useEffect } from "react";

type Owner = {
  rosterId: number;
  ownerId: string;
  displayName: string;
  username: string;
};

type Matchup = { id: number; team1: Owner; team2: Owner };
type Submission = { rosterId: number; picks: Record<string, number>; lockedAt: string };
type RevealedPicks = { rosterId: number; displayName: string; picks: Record<string, number> };
type LockStatus = { rosterId: number; displayName: string; locked: boolean };
type WeeklyResult = { week: number; winners: Array<{ rosterId: number; displayName: string; correct: number }>; standings: Array<{ rosterId: number; displayName: string; correct: number; total: number }> };
type LadbrokesState = { week: number; lastCompletedWeek: number; lockDeadline: string; picksLocked: boolean; matchups: Matchup[]; user: Owner | null; ownSubmission: Submission | null; revealedPicks: RevealedPicks[] | null; lockStatus: LockStatus[]; history: WeeklyResult[]; isAdmin: boolean };
type AccessOwner = Owner & { hasCode: boolean };

export default function LadbrokesClient() {
  const [activeTab, setActiveTab] = useState<"picks" | "status" | "results" | "access">("picks");
  const [state, setState] = useState<LadbrokesState | null>(null);
  const [accessOwners, setAccessOwners] = useState<AccessOwner[]>([]);
  const [newCodes, setNewCodes] = useState<Record<number, string>>({});
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const loadState = async () => {
    const response = await fetch("/api/ladbrokes", { cache: "no-store" });
    const next = await response.json() as LadbrokesState;
    setState(next);
    setPicks(next.ownSubmission?.picks ?? {});
    if (next.isAdmin) {
      const accessResponse = await fetch("/api/ladbrokes/access", { cache: "no-store" });
      if (accessResponse.ok) setAccessOwners((await accessResponse.json()).owners);
    }
  };

  useEffect(() => {
    void loadState();
  }, []);

  const signIn = async () => {
    setError("");
    const response = await fetch("/api/ladbrokes/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    if (!response.ok) return setError("That access code was not accepted.");
    setCode("");
    await loadState();
  };

  const signOut = async () => {
    await fetch("/api/ladbrokes/session", { method: "DELETE" });
    setPicks({});
    await loadState();
  };

  const lockPicks = async () => {
    if (!state) return;
    setSaving(true);
    setError("");
    const response = await fetch("/api/ladbrokes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week: state.week, picks }) });
    setSaving(false);
    if (!response.ok) return setError((await response.json()).error || "Unable to lock picks.");
    await loadState();
  };

  const generateCode = async (rosterId: number) => {
    const response = await fetch("/api/ladbrokes/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rosterId }) });
    if (!response.ok) return;
    const result = await response.json();
    setNewCodes((current) => ({ ...current, [rosterId]: result.code }));
    await loadState();
  };

  const revokeCode = async (rosterId: number) => {
    if (!confirm("Revoke this owner's Ladbrokes access code?")) return;
    await fetch("/api/ladbrokes/access", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rosterId }) });
    setNewCodes((current) => { const next = { ...current }; delete next[rosterId]; return next; });
    await loadState();
  };

  if (!state) return <div className="p-8 text-center text-white/60">Loading the Week&apos;s book...</div>;
  const allPicked = state.matchups.length > 0 && Object.keys(picks).length === state.matchups.length;
  const lockDeadline = new Date(state.lockDeadline).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const seasonStandings = Array.from(state.history.reduce((totals, week) => {
    for (const entry of week.standings) {
      const current = totals.get(entry.rosterId) ?? { rosterId: entry.rosterId, displayName: entry.displayName, correct: 0, weeklyWins: 0 };
      current.correct += entry.correct;
      if (week.winners.some((winner) => winner.rosterId === entry.rosterId)) current.weeklyWins += 1;
      totals.set(entry.rosterId, current);
    }
    return totals;
  }, new Map<number, { rosterId: number; displayName: string; correct: number; weeklyWins: number }>()).values()).sort((left, right) => right.weeklyWins - left.weeklyWins || right.correct - left.correct || left.displayName.localeCompare(right.displayName));

  return (
    <div>
      <div className="league-tabs league-tabs__list">
        <button onClick={() => setActiveTab("picks")} className={`league-tab ${activeTab === "picks" ? "league-tab--active" : "league-tab--idle"}`}>Week {state.week} Picks</button>
        <button onClick={() => setActiveTab("status")} className={`league-tab ${activeTab === "status" ? "league-tab--active" : "league-tab--idle"}`}>Lock Status</button>
        <button onClick={() => setActiveTab("results")} className={`league-tab ${activeTab === "results" ? "league-tab--active" : "league-tab--idle"}`}>Results & History</button>
        {state.isAdmin && <button onClick={() => setActiveTab("access")} className={`league-tab ${activeTab === "access" ? "league-tab--active" : "league-tab--idle"}`}>Access Codes</button>}
      </div>

      <div className="p-6 sm:p-8">
        {activeTab === "picks" && !state.user && (
          <div className="mx-auto max-w-md py-8">
            <p className="eyebrow">Private entry</p>
            <h2 className="text-3xl font-bold uppercase text-white">Enter your access code</h2>
            <p className="mt-2 text-white/60">Your code identifies your roster. Everyone&apos;s selections stay hidden until you lock your own.</p>
            <input type="password" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && void signIn()} placeholder="PERSONAL ACCESS CODE" className="mt-6 w-full border border-white/20 bg-black/30 p-3 font-mono uppercase text-white outline-none focus:border-lime-300" autoFocus />
            {error && <p className="mt-3 text-red-400">{error}</p>}
            <button type="button" onClick={signIn} disabled={!code.trim()} className="tool-command mt-4 w-full p-3 disabled:opacity-40">Open my picks</button>
          </div>
        )}

        {activeTab === "picks" && state.user && (
          <div>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
              <div><p className="eyebrow">Signed in as</p><h2 className="text-3xl font-bold uppercase text-white">{state.user.displayName}</h2><p className="text-white/50">Week {state.week} · {state.ownSubmission ? "Picks locked" : state.picksLocked ? "Selections closed" : `${Object.keys(picks).length}/${state.matchups.length} selected`}</p><p className={state.picksLocked ? "mt-1 text-sm font-bold text-orange-300" : "mt-1 text-sm text-white/50"}>{state.picksLocked ? "Locked at first kickoff" : "Locks at first kickoff"}: {lockDeadline}</p></div>
              <button type="button" onClick={signOut} className="tool-command px-4 py-2">Sign out</button>
            </div>
            {state.matchups.length === 0 ? <p className="py-12 text-center text-white/60">Sleeper has not published Week {state.week} matchups yet.</p> : (
              <div className="grid gap-4 lg:grid-cols-2">
                {state.matchups.map((matchup) => (
                  <section key={matchup.id} className="tool-panel p-4">
                    <p className="mb-3 text-xs font-bold uppercase text-white/50">Sleeper matchup {matchup.id}</p>
                    {[matchup.team1, matchup.team2].map((team) => {
                      const selected = picks[String(matchup.id)] === team.rosterId;
                      const selectors = state.revealedPicks?.filter((entry) => entry.picks[String(matchup.id)] === team.rosterId) ?? [];
                      return <button key={team.rosterId} type="button" disabled={!!state.ownSubmission || state.picksLocked} onClick={() => setPicks((current) => ({ ...current, [String(matchup.id)]: team.rosterId }))} className={`mb-2 w-full border p-4 text-left transition-colors disabled:cursor-default ${selected ? "border-lime-300 bg-lime-300/10" : "border-white/10 bg-black/20 hover:border-white/30"}`}><strong className="block text-lg text-white">{team.displayName}</strong><span className="text-sm text-white/50">{team.username}</span>{state.ownSubmission && <span className="mt-3 flex flex-wrap gap-2">{selectors.length > 0 ? selectors.map((entry) => <span key={entry.rosterId} className="border border-white/15 bg-black/30 px-2 py-1 text-xs font-bold uppercase text-white/75">{entry.displayName}</span>) : <span className="text-xs text-white/35">No locked picks</span>}</span>}</button>;
                    })}
                  </section>
                ))}
              </div>
            )}
            {error && <p className="mt-4 text-center text-red-400">{error}</p>}
            {state.ownSubmission ? <div className="mt-6 border border-lime-300/40 bg-lime-300/10 p-5 text-center"><strong className="text-lime-300">Picks locked for Week {state.week}</strong><p className="mt-1 text-sm text-white/60">Your entry is final. Other locked selections are now shown against each team above.</p></div> : state.picksLocked ? <div className="mt-6 border border-orange-300/40 bg-orange-300/10 p-5 text-center"><strong className="text-orange-300">Week {state.week} selections are closed</strong><p className="mt-1 text-sm text-white/60">The first game has kicked off. No late entries can be submitted.</p></div> : <button type="button" onClick={lockPicks} disabled={!allPicked || saving} className="tool-command mt-6 w-full p-4 disabled:opacity-40">{saving ? "Locking..." : allPicked ? "Lock in all picks" : `Choose ${state.matchups.length - Object.keys(picks).length} more`}</button>}
          </div>
        )}

        {activeTab === "status" && (
          <div><div className="mb-6"><p className="eyebrow">Week {state.week}</p><h2 className="text-3xl font-bold uppercase text-white">Who&apos;s locked in?</h2><p className="mt-2 text-white/60">Completion is public. Selections unlock only after you submit your own.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{state.lockStatus.map((owner) => <div key={owner.rosterId} className="tool-panel flex items-center justify-between gap-3 p-4"><strong className="text-white">{owner.displayName}</strong><span className={owner.locked ? "text-lime-300" : "text-white/40"}>{owner.locked ? "Locked in" : "Not submitted"}</span></div>)}</div></div>
        )}

        {activeTab === "results" && (
          <div>
            <div className="mb-6"><p className="eyebrow">Through Week {state.lastCompletedWeek}</p><h2 className="text-3xl font-bold uppercase text-white">Results & History</h2><p className="mt-2 text-white/60">Winners are calculated automatically after Sleeper finalizes each game week.</p></div>
            {state.history.length === 0 ? <div className="tool-panel p-8 text-center"><strong className="text-xl text-white">No completed weeks yet</strong><p className="mt-2 text-white/60">Week 1 results will appear here after Sleeper marks the matchups final.</p></div> : <>
              <section className="mb-6"><h3 className="mb-3 text-xl font-bold uppercase text-white">Season table</h3><div className="overflow-x-auto"><table className="w-full min-w-[480px] border-collapse text-left"><thead><tr className="border-b border-white/15 text-xs uppercase text-white/50"><th className="p-3">Owner</th><th className="p-3 text-center">Weekly wins</th><th className="p-3 text-center">Correct picks</th></tr></thead><tbody>{seasonStandings.map((entry) => <tr key={entry.rosterId} className="border-b border-white/10"><td className="p-3 font-bold text-white">{entry.displayName}</td><td className="p-3 text-center text-lime-300">{entry.weeklyWins}</td><td className="p-3 text-center text-white/70">{entry.correct}</td></tr>)}</tbody></table></div></section>
              <div className="space-y-4">{state.history.map((week) => <section key={week.week} className="tool-panel p-5"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4"><div><p className="eyebrow">Week {week.week}</p><h3 className="text-2xl font-bold uppercase text-white">{week.winners.length === 0 ? "No entries" : week.winners.length === 1 ? `${week.winners[0].displayName} wins` : `${week.winners.map((winner) => winner.displayName).join(" & ")} tie`}</h3></div>{week.winners[0] && <strong className="text-lime-300">{week.winners[0].correct}/{week.standings[0]?.total ?? 0} correct</strong>}</div>{week.standings.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{week.standings.map((entry, index) => <div key={entry.rosterId} className="flex justify-between border border-white/10 bg-black/20 px-3 py-2"><span className="text-white/80">{index + 1}. {entry.displayName}</span><strong className="text-white">{entry.correct}/{entry.total}</strong></div>)}</div>}</section>)}</div>
            </>}
          </div>
        )}

        {activeTab === "access" && state.isAdmin && (
          <div><div className="mb-6"><p className="eyebrow">Commissioner only</p><h2 className="text-3xl font-bold uppercase text-white">Owner access</h2><p className="mt-2 text-white/60">Codes are shown once when generated. Send each code privately.</p></div><div className="space-y-3">{accessOwners.map((owner) => <div key={owner.rosterId} className="tool-panel flex flex-wrap items-center justify-between gap-3 p-4"><div><strong className="block text-white">{owner.displayName}</strong><span className="text-sm text-white/50">{owner.hasCode ? "Code active" : "No code"}</span></div>{newCodes[owner.rosterId] && <code className="border border-lime-300/30 bg-black/30 px-3 py-2 text-lime-300">{newCodes[owner.rosterId]}</code>}<div className="flex gap-2"><button type="button" onClick={() => generateCode(owner.rosterId)} className="tool-command px-3 py-2">{owner.hasCode ? "Regenerate" : "Generate"}</button>{owner.hasCode && <button type="button" onClick={() => revokeCode(owner.rosterId)} className="tool-command tool-command--danger px-3 py-2">Revoke</button>}</div></div>)}</div></div>
        )}
      </div>
    </div>
  );
}
