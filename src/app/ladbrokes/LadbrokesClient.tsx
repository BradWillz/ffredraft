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
      <div className="league-tabs league-tabs__list">
        <button
          onClick={() => setActiveTab('betting')}
          className={`league-tab ${
            activeTab === 'betting'
              ? 'league-tab--active'
              : 'league-tab--idle'
          }`}
        >
          🎲 Place Bets
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`league-tab ${
            activeTab === 'results'
              ? 'league-tab--active'
              : 'league-tab--idle'
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
