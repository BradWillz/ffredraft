"use client";

import { useState, useEffect } from "react";
import type { StoredBet } from "./BettingInterface";

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

type MatchupResult = {
  matchupId: number;
  winner: number | null; // rosterId of winner, null if not set
};

interface ResultsProps {
  matchups: Matchup[];
}

export default function Results({ matchups }: ResultsProps) {
  const [bets, setBets] = useState<StoredBet[]>([]);
  const [results, setResults] = useState<Map<number, number | null>>(new Map());
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    // Load bets from localStorage
    const stored = localStorage.getItem('ladbrokes_bets');
    if (stored) {
      setBets(JSON.parse(stored));
    }

    // Load results from localStorage
    const storedResults = localStorage.getItem('ladbrokes_results');
    if (storedResults) {
      const resultsArray: MatchupResult[] = JSON.parse(storedResults);
      const resultsMap = new Map(resultsArray.map(r => [r.matchupId, r.winner]));
      setResults(resultsMap);
    }
  }, []);

  const setWinner = (matchupId: number, winnerId: number | null) => {
    const newResults = new Map(results);
    newResults.set(matchupId, winnerId);
    setResults(newResults);

    // Save to localStorage
    const resultsArray = Array.from(newResults.entries()).map(([matchupId, winner]) => ({
      matchupId,
      winner,
    }));
    localStorage.setItem('ladbrokes_results', JSON.stringify(resultsArray));
  };

  const clearAllData = () => {
    if (confirm('Are you sure you want to clear all bets and results?')) {
      localStorage.removeItem('ladbrokes_bets');
      localStorage.removeItem('ladbrokes_results');
      setBets([]);
      setResults(new Map());
    }
  };

  // Group bets by matchup
  const betsByMatchup = new Map<number, StoredBet[]>();
  bets.forEach(bet => {
    if (!betsByMatchup.has(bet.matchupId)) {
      betsByMatchup.set(bet.matchupId, []);
    }
    betsByMatchup.get(bet.matchupId)!.push(bet);
  });

  // Calculate leaderboard
  const userScores = new Map<string, { correct: number; total: number }>();
  bets.forEach(bet => {
    const winner = results.get(bet.matchupId);
    if (winner !== undefined && winner !== null) {
      if (!userScores.has(bet.userName)) {
        userScores.set(bet.userName, { correct: 0, total: 0 });
      }
      const score = userScores.get(bet.userName)!;
      score.total++;
      if (bet.selectedTeam === winner) {
        score.correct++;
      }
    }
  });

  const leaderboard = Array.from(userScores.entries())
    .map(([name, score]) => ({
      name,
      correct: score.correct,
      total: score.total,
      percentage: (score.correct / score.total) * 100,
    }))
    .sort((a, b) => b.correct - a.correct || b.percentage - a.percentage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Results & Leaderboard</h2>
          <p className="text-slate-400 mt-1">
            {bets.length} total bet{bets.length !== 1 ? 's' : ''} placed
          </p>
        </div>
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 overflow-hidden">
          <div className="bg-gradient-to-r from-yellow-600 to-yellow-500 px-4 py-3">
            <h3 className="text-lg font-bold text-white">🏆 Leaderboard</h3>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.name}
                  className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`text-2xl ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-slate-400' : index === 2 ? 'text-orange-600' : 'text-slate-500'}`}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </div>
                    <div className="font-semibold text-white">{entry.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-400">
                      {entry.correct}/{entry.total}
                    </div>
                    <div className="text-sm text-slate-400">
                      {entry.percentage.toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Matchup Results */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white">Matchup Results</h3>
        {matchups.map(matchup => {
          const matchupBets = betsByMatchup.get(matchup.id) || [];
          const winner = results.get(matchup.id);
          const team1Bets = matchupBets.filter(b => b.selectedTeam === matchup.team1.rosterId);
          const team2Bets = matchupBets.filter(b => b.selectedTeam === matchup.team2.rosterId);

          return (
            <div
              key={matchup.id}
              className="bg-slate-900/50 rounded-lg border border-slate-700/50 overflow-hidden"
            >
              <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-700/50 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-400">
                  Matchup {matchup.id}
                </p>
                {winner !== undefined && winner !== null && (
                  <span className="text-emerald-400 text-sm font-semibold">
                    ✓ Winner Set
                  </span>
                )}
              </div>

              <div className="p-4 space-y-3">
                {/* Team 1 */}
                <div className={`p-4 rounded-lg border-2 ${winner === matchup.team1.rosterId ? 'border-emerald-500 bg-emerald-500/20' : 'border-slate-700 bg-slate-800/30'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-bold text-white text-lg flex items-center gap-2">
                        {matchup.team1.displayName}
                        {winner === matchup.team1.rosterId && <span className="text-emerald-400">👑</span>}
                      </div>
                      <div className="text-sm text-slate-400">{matchup.team1.username}</div>
                    </div>
                    {editMode && (
                      <button
                        onClick={() => setWinner(matchup.id, winner === matchup.team1.rosterId ? null : matchup.team1.rosterId)}
                        className={`px-3 py-1 rounded text-sm font-semibold ${
                          winner === matchup.team1.rosterId
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {winner === matchup.team1.rosterId ? 'Winner' : 'Set Winner'}
                      </button>
                    )}
                  </div>
                  {team1Bets.length > 0 && (
                    <div className="text-sm text-slate-300 flex flex-wrap gap-2">
                      <span className="text-slate-400">Bets:</span>
                      {team1Bets.map(bet => (
                        <span
                          key={`${bet.userName}-${bet.timestamp}`}
                          className={`px-2 py-1 rounded ${
                            winner === matchup.team1.rosterId
                              ? 'bg-emerald-600 text-white'
                              : winner !== undefined && winner !== null
                              ? 'bg-red-900/50 text-red-300'
                              : 'bg-slate-700'
                          }`}
                        >
                          {bet.userName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <span className="text-slate-500 font-bold text-sm">VS</span>
                </div>

                {/* Team 2 */}
                <div className={`p-4 rounded-lg border-2 ${winner === matchup.team2.rosterId ? 'border-emerald-500 bg-emerald-500/20' : 'border-slate-700 bg-slate-800/30'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-bold text-white text-lg flex items-center gap-2">
                        {matchup.team2.displayName}
                        {winner === matchup.team2.rosterId && <span className="text-emerald-400">👑</span>}
                      </div>
                      <div className="text-sm text-slate-400">{matchup.team2.username}</div>
                    </div>
                    {editMode && (
                      <button
                        onClick={() => setWinner(matchup.id, winner === matchup.team2.rosterId ? null : matchup.team2.rosterId)}
                        className={`px-3 py-1 rounded text-sm font-semibold ${
                          winner === matchup.team2.rosterId
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {winner === matchup.team2.rosterId ? 'Winner' : 'Set Winner'}
                      </button>
                    )}
                  </div>
                  {team2Bets.length > 0 && (
                    <div className="text-sm text-slate-300 flex flex-wrap gap-2">
                      <span className="text-slate-400">Bets:</span>
                      {team2Bets.map(bet => (
                        <span
                          key={`${bet.userName}-${bet.timestamp}`}
                          className={`px-2 py-1 rounded ${
                            winner === matchup.team2.rosterId
                              ? 'bg-emerald-600 text-white'
                              : winner !== undefined && winner !== null
                              ? 'bg-red-900/50 text-red-300'
                              : 'bg-slate-700'
                          }`}
                        >
                          {bet.userName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
