"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { WHEEL_SCENARIOS, type WheelState } from "@/lib/wheel-state";

type NewsletterLeague = "redraft" | "dynasty";

const NEWSLETTER_LEAGUES: Record<NewsletterLeague, { label: string; path: string }> = {
  redraft: { label: "Redraft", path: "/newsletter/week" },
  dynasty: { label: "Dynastry of Darkness", path: "/dynastry-of-darkness/newsletter/week" },
};

function CommentaryPanel({ league }: { league: NewsletterLeague }) {
  const [week, setWeek] = useState(1);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const { label, path } = NEWSLETTER_LEAGUES[league];

  const update = async (clear = false) => {
    if (busy) return;
    setBusy(true);
    setStatus(clear ? "Restoring factual copy..." : "Researching and writing...");
    try {
      const response = await fetch("/api/newsletter/commentary", {
        method: clear ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week, league }),
      });
      const result = await response.json() as {
        error?: string; stage?: string; reason?: string; requestId?: string;
        fraudWatch?: { ok: boolean; error?: string; retainedPrevious?: boolean };
      };
      const fraudWatchFailed = response.ok && !clear && result.fraudWatch && !result.fraudWatch.ok;
      setStatus(!response.ok
        ? [
          result.error ?? "Could not update the newsletter.",
          result.reason ? `${result.stage ? `[${result.stage}] ` : ""}${result.reason}` : "",
          result.requestId ? `Request: ${result.requestId}` : "",
        ].filter(Boolean).join(" ")
        : clear
          ? `${label} Week ${week}: factual copy restored.`
          : fraudWatchFailed
            ? `${label} Week ${week}: Power Rankings updated, but Fraud Watch failed (${result.fraudWatch?.error ?? "unknown error"}). ${result.fraudWatch?.retainedPrevious ? "The previous Fraud Watch copy was kept." : "The newsletter shows the factual Fraud Watch fallback."} Run again to retry.`
            : `${label} Week ${week} commentary updated: ${result.fraudWatch ? "Power Rankings + Fraud Watch" : "Power Rankings"}.`);
    } catch {
      setStatus("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form id={`newsletter-panel-${league}`} role="tabpanel" onSubmit={(event) => { event.preventDefault(); void update(); }} className="grid gap-4">
      <p className="text-sm text-white/70">Writes the weekly commentary for the <strong className="text-white">{label}</strong> newsletter only{league === "redraft" ? " — Power Rankings and Fraud Watch together, in one request" : " — the Power Rankings blurbs"}. Saved copy is kept separate from the other league.</p>
      <label className="grid max-w-xs gap-2 text-sm font-bold text-white">
        Week
        <select value={week} disabled={busy} onChange={(event) => { setWeek(Number(event.target.value)); setStatus(""); }} className="wheel-admin-field">
          {Array.from({ length: 18 }, (_, index) => index + 1).map((option) => <option key={option} value={option}>Week {option}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="tool-command px-5 py-3 disabled:opacity-50">{busy ? "Working..." : `Generate ${label} weekly commentary`}</button>
        <button type="button" disabled={busy} onClick={() => void update(true)} className="tool-command px-5 py-3 disabled:opacity-50">Use factual copy</button>
        <Link href={`${path}/${week}`} className="text-sm text-lime-300 underline">Open {label} newsletter</Link>
      </div>
      {status && <p role="status" className="text-sm text-white/70">{status}</p>}
    </form>
  );
}

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [wheelState, setWheelState] = useState<WheelState | null>(null);
  const [liveWeek, setLiveWeek] = useState(1);
  const [editWeek, setEditWeek] = useState(1);
  const [editScenario, setEditScenario] = useState("Highest Bench Score");
  const [editWinner, setEditWinner] = useState("Tee");
  const [editDetails, setEditDetails] = useState("Highest points on bench");
  const [wheelStatus, setWheelStatus] = useState("");
  const [newsletterLeague, setNewsletterLeague] = useState<NewsletterLeague>("redraft");

  const loadWheelState = async () => {
    const response = await fetch("/api/wheel", { cache: "no-store" });
    if (!response.ok) return;
    const state = await response.json() as WheelState;
    setWheelState(state);
    setLiveWeek(state.currentWeek);
  };

  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((session) => {
        const authenticated = session.isAdmin === true;
        setIsAdmin(authenticated);
        if (authenticated) void loadWheelState();
      });
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) return setError("That password was not accepted.");
    setPassword("");
    setIsAdmin(true);
    await loadWheelState();
  };

  const logout = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    setIsAdmin(false);
  };

  const selectEditWeek = (week: number) => {
    setEditWeek(week);
    const result = wheelState?.weekResults.find((item) => item.week === week);
    const winner = wheelState?.weekWinners.find((item) => item.week === week);
    setEditScenario(result?.scenario ?? WHEEL_SCENARIOS[0]);
    setEditWinner(winner?.winnerName ?? "");
    setEditDetails(winner?.details ?? "");
    setWheelStatus("");
  };

  const saveWeekResult = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!wheelState) return;
    setWheelStatus("Saving...");

    const existingResult = wheelState.weekResults.find((result) => result.week === editWeek);
    const weekResults = [
      ...wheelState.weekResults.filter((result) => result.week !== editWeek),
      { week: editWeek, scenario: editScenario, date: existingResult?.date ?? new Date().toISOString() },
    ].sort((left, right) => left.week - right.week);
    const weekWinners = [
      ...wheelState.weekWinners.filter((winner) => winner.week !== editWeek),
      {
        week: editWeek,
        scenario: editScenario,
        winnerName: editWinner.trim(),
        winnerValue: 0,
        details: editDetails.trim(),
      },
    ].sort((left, right) => left.week - right.week);
    const usedScenarios = new Set(weekResults.map((result) => result.scenario));
    const updatedState: WheelState = {
      ...wheelState,
      currentWeek: liveWeek,
      availableScenarios: WHEEL_SCENARIOS.filter((scenario) => !usedScenarios.has(scenario)),
      weekResults,
      weekWinners,
    };
    const response = await fetch("/api/wheel", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedState),
    });

    if (!response.ok) {
      setWheelStatus("Could not save this result. Please try again.");
      return;
    }

    setWheelState(await response.json() as WheelState);
    setWheelStatus(`Week ${editWeek} saved.`);
  };

  return (
    <main className="redraft-tool min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="home-link">← League Office</Link>
        <section className="tool-feature mt-8 p-6 sm:p-10">
          <p className="eyebrow">Commissioner access</p>
          <h1 className="text-4xl sm:text-6xl font-bold uppercase">Control Room</h1>
          {isAdmin ? (
            <div className="mt-8">
              <p className="text-slate-300">This browser can now edit shared league tools.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Link href="/spin-the-wheel" className="tool-command p-4 text-center">Manage the wheel</Link>
                <Link href="/the-power" className="tool-command p-4 text-center">Manage the duck</Link>
                <Link href="/ladbrokes" className="tool-command p-4 text-center">Manage Ladbrokes</Link>
              </div>
              {wheelState && (
                <section className="tool-panel mt-8 p-4 sm:p-6" aria-labelledby="week-editor-title">
                  <p className="eyebrow">Wheel controls</p>
                  <h2 id="week-editor-title" className="mb-2 text-2xl font-bold text-white">Edit a Previous Week</h2>
                  <p className="mb-5 text-sm text-white/70">Add a missed result or correct an existing week.</p>
                  <form onSubmit={saveWeekResult} className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-bold text-white">
                      Live week
                      <select value={liveWeek} onChange={(event) => setLiveWeek(Number(event.target.value))} className="wheel-admin-field">
                        {Array.from({ length: 14 }, (_, index) => index + 1).map((week) => (
                          <option key={week} value={week}>Week {week}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-white">
                      Week to edit
                      <select value={editWeek} onChange={(event) => selectEditWeek(Number(event.target.value))} className="wheel-admin-field">
                        {Array.from({ length: 14 }, (_, index) => index + 1).map((week) => (
                          <option key={week} value={week}>Week {week}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-white">
                      Scenario
                      <select value={editScenario} onChange={(event) => setEditScenario(event.target.value)} className="wheel-admin-field">
                        {WHEEL_SCENARIOS.map((scenario) => <option key={scenario} value={scenario}>{scenario}</option>)}
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-white">
                      Winner
                      <input value={editWinner} onChange={(event) => setEditWinner(event.target.value)} className="wheel-admin-field" required />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-white sm:col-span-2">
                      Result details
                      <input value={editDetails} onChange={(event) => setEditDetails(event.target.value)} className="wheel-admin-field" placeholder="e.g. 68.4 bench pts" required />
                    </label>
                    <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                      <button type="submit" className="tool-command px-5 py-3">Save week result</button>
                      {wheelStatus && <p className="text-sm text-white/70" role="status">{wheelStatus}</p>}
                    </div>
                  </form>
                </section>
              )}
              <section className="mt-8 border-t border-white/20 pt-6" aria-labelledby="newsletter-editor-title">
                <p className="eyebrow">Newsletter</p>
                <h2 id="newsletter-editor-title" className="mb-4 text-2xl font-bold text-white">Weekly Commentary</h2>
                <div role="tablist" aria-label="Newsletter league" className="mb-5 flex flex-wrap gap-2">
                  {(Object.keys(NEWSLETTER_LEAGUES) as NewsletterLeague[]).map((league) => (
                    <button
                      key={league}
                      type="button"
                      role="tab"
                      aria-selected={newsletterLeague === league}
                      aria-controls={`newsletter-panel-${league}`}
                      onClick={() => setNewsletterLeague(league)}
                      className={`tool-command px-4 py-2 ${newsletterLeague === league ? "" : "opacity-50"}`}
                    >
                      {NEWSLETTER_LEAGUES[league].label}
                    </button>
                  ))}
                </div>
                {(Object.keys(NEWSLETTER_LEAGUES) as NewsletterLeague[]).map((league) => (
                  <div key={league} hidden={newsletterLeague !== league}><CommentaryPanel league={league} /></div>
                ))}
              </section>
              <button type="button" onClick={logout} className="tool-command tool-command--danger mt-6 px-5 py-3">Log out</button>
            </div>
          ) : (
            <form onSubmit={login} className="mt-8 max-w-md">
              <label htmlFor="admin-password" className="block font-bold uppercase">Admin password</label>
              <input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required className="mt-3 w-full border border-white/20 bg-black/30 p-3 text-white outline-none focus:border-lime-300" />
              {error && <p className="mt-3 text-red-400">{error}</p>}
              <button type="submit" className="tool-command mt-5 px-6 py-3">Sign in</button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}