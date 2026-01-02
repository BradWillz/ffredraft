"use client";

import { useState, useEffect } from "react";
import BettingInterface from "./BettingInterface";
import Results from "./Results";

type Team = {
  rosterId: number;
  displayName: string;
  username: string;
};

type Matchup = {
  id: number;
  team1: Team;
  team2: Team;
};

interface LadbrokesClientProps {
  matchups: Matchup[];
}

export default function LadbrokesClient({ matchups }: LadbrokesClientProps) {
  const [activeTab, setActiveTab] = useState<'betting' | 'results'>('betting');
  const [accessCode, setAccessCode] = useState<string | undefined>();

  useEffect(() => {
    // Get access code from URL if present
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setAccessCode(code);
    }
  }, []);

  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('betting')}
          className={`flex-1 px-6 py-4 text-lg font-bold transition-all ${
            activeTab === 'betting'
              ? 'bg-slate-900/50 text-white border-b-2 border-emerald-500'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
          }`}
        >
          🎲 Place Bets
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`flex-1 px-6 py-4 text-lg font-bold transition-all ${
            activeTab === 'results'
              ? 'bg-slate-900/50 text-white border-b-2 border-emerald-500'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
          }`}
        >
          🏆 Results
        </button>
      </div>

      {/* Content */}
      <div className="p-6 sm:p-8">
        {activeTab === 'betting' ? (
          <BettingInterface matchups={matchups} accessCode={accessCode} />
        ) : (
          <Results matchups={matchups} />
        )}
      </div>
    </div>
  );
}
