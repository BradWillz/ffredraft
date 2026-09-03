"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((session) => setIsAdmin(session.isAdmin === true));
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
  };

  const logout = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    setIsAdmin(false);
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
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Link href="/spin-the-wheel" className="tool-command p-4 text-center">Manage the wheel</Link>
                <Link href="/the-power" className="tool-command p-4 text-center">Manage the duck</Link>
              </div>
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