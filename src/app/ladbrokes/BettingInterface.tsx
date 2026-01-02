"use client";

import { useState, useEffect } from "react";
import { validateAccessCode, hasUserAlreadyBet, type UserAccess } from "./userAuth";

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

export type StoredBet = {
  userName: string;
  matchupId: number;
  selectedTeam: number;
  teamName: string;
  timestamp: number;
};

interface BettingInterfaceProps {
  matchups: Matchup[];
  accessCode?: string;
}

export default function BettingInterface({ matchups, accessCode }: BettingInterfaceProps) {
  const [userAccess, setUserAccess] = useState<UserAccess | null>(null);
  const [codeInput, setCodeInput] = useState(accessCode || "");
  const [codeError, setCodeError] = useState("");
  const [alreadyBet, setAlreadyBet] = useState(false);
  const [bets, setBets] = useState<Map<number, number>>(new Map());
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    // Check if access code from URL is valid
    if (accessCode) {
      const user = validateAccessCode(accessCode);
      if (user) {
        const hasBet = hasUserAlreadyBet(user.displayName);
        if (hasBet) {
          setAlreadyBet(true);
        } else {
          setUserAccess(user);
        }
      } else {
        setCodeError("Invalid access code");
      }
    }
  }, [accessCode]);

  const placeBet = (matchupId: number, teamRosterId: number) => {
    if (submitted) return;
    
    const newBets = new Map(bets);
    if (newBets.get(matchupId) === teamRosterId) {
      // If clicking the same team, remove the bet
      newBets.delete(matchupId);
    } else {
      newBets.set(matchupId, teamRosterId);
    }
    setBets(newBets);
  };

  const submitBets = () => {
    if (bets.size === 0 || !userAccess) return;
    
    // Store bets in localStorage
    const storedBets: StoredBet[] = [];
    bets.forEach((selectedRosterId, matchupId) => {
      const matchup = matchups.find(m => m.id === matchupId);
      const selectedTeam = matchup?.team1.rosterId === selectedRosterId 
        ? matchup.team1 
        : matchup?.team2;
      
      if (selectedTeam) {
        storedBets.push({
          userName: userAccess.displayName,
          matchupId,
          selectedTeam: selectedRosterId,
          teamName: selectedTeam.displayName,
          timestamp: Date.now(),
        });
      }
    });
    
    // Get existing bets from localStorage
    const existing = localStorage.getItem('ladbrokes_bets');
    const allBets = existing ? JSON.parse(existing) : [];
    
    // Add new bets
    localStorage.setItem('ladbrokes_bets', JSON.stringify([...allBets, ...storedBets]));
    
    setSubmitted(true);
  };

  const resetBets = () => {
    setBets(new Map());
    setSubmitted(false);
  };

  const submitCode = () => {
    setCodeError("");
    const user = validateAccessCode(codeInput.toUpperCase().trim());
    
    if (!user) {
      setCodeError("Invalid access code. Please check and try again.");
      return;
    }
    
    const hasBet = hasUserAlreadyBet(user.displayName);
    if (hasBet) {
      setAlreadyBet(true);
      return;
    }
    
    setUserAccess(user);
  };

  const allMatchupsHaveBets = bets.size === matchups.length;

  // Already bet screen
  if (alreadyBet) {
    return (
      <div className="max-w-md mx-auto space-y-6 py-12 text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h2 className="text-3xl font-bold text-white mb-2">
          Already Submitted
        </h2>
        <p className="text-slate-400 text-lg">
          You've already placed your bets for this week's matchups.
        </p>
        <p className="text-slate-500">
          Check the Results tab to see all bets and track the leaderboard!
        </p>
      </div>
    );
  }

  // Access code entry screen
  if (!userAccess) {
    return (
      <div className="max-w-md mx-auto space-y-6 py-12">
        <div className="text-center">
          <div className="text-5xl mb-4">🔐</div>
          <h2 className="text-3xl font-bold text-white mb-2">
            Enter Access Code
          </h2>
          <p className="text-slate-400">
            Use your unique code to place bets
          </p>
        </div>
        
        <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700/50">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Access Code
          </label>
          <input
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            onKeyPress={(e) => e.key === 'Enter' && submitCode()}
            placeholder="Enter your code..."
            className={`w-full px-4 py-3 bg-slate-800 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent uppercase ${
              codeError 
                ? 'border-red-500 focus:ring-red-500' 
                : 'border-slate-700 focus:ring-emerald-500'
            }`}
            autoFocus
          />
          {codeError && (
            <p className="mt-2 text-sm text-red-400">{codeError}</p>
          )}
          <button
            onClick={submitCode}
            disabled={!codeInput.trim()}
            className={`w-full mt-4 px-6 py-3 rounded-lg font-bold transition-all ${
              codeInput.trim()
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            Continue to Betting
          </button>
          
          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-sm text-slate-400 text-center mb-2">
              Don't have a code? Contact your league commissioner.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">
            This Week's Matchups
          </h2>
          <p className="text-slate-400 mt-1">
            <span className="text-emerald-400 font-semibold">{userAccess.displayName}</span>
            {' • '}
            {submitted 
              ? `You've locked in ${bets.size} bet${bets.size !== 1 ? 's' : ''}!` 
              : `Select your winners (${bets.size}/${matchups.length})`
            }
          </p>
        </div>
        {bets.size > 0 && (
          <button
            onClick={resetBets}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            {submitted ? 'Edit Bets' : 'Clear All'}
          </button>
        )}
      </div>

      {/* Matchups Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {matchups.map((matchup) => {
          const selectedTeam = bets.get(matchup.id);
          const isTeam1Selected = selectedTeam === matchup.team1.rosterId;
          const isTeam2Selected = selectedTeam === matchup.team2.rosterId;

          return (
            <div
              key={matchup.id}
              className="bg-slate-900/50 rounded-lg border border-slate-700/50 overflow-hidden"
            >
              {/* Matchup Header */}
              <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-700/50">
                <p className="text-sm font-semibold text-slate-400">
                  Matchup {matchup.id}
                </p>
              </div>

              {/* Teams */}
              <div className="p-4 space-y-3">
                {/* Team 1 */}
                <button
                  onClick={() => placeBet(matchup.id, matchup.team1.rosterId)}
                  disabled={submitted}
                  className={`w-full p-4 rounded-lg border-2 transition-all ${
                    isTeam1Selected
                      ? 'border-emerald-500 bg-emerald-500/20'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
                  } ${submitted ? 'cursor-default' : 'cursor-pointer hover:bg-slate-800/50'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <div className="font-bold text-white text-lg">
                        {matchup.team1.displayName}
                      </div>
                      <div className="text-sm text-slate-400">
                        {matchup.team1.username}
                      </div>
                    </div>
                    {isTeam1Selected && (
                      <div className="text-emerald-400">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>

                {/* VS Divider */}
                <div className="text-center">
                  <span className="text-slate-500 font-bold text-sm">VS</span>
                </div>

                {/* Team 2 */}
                <button
                  onClick={() => placeBet(matchup.id, matchup.team2.rosterId)}
                  disabled={submitted}
                  className={`w-full p-4 rounded-lg border-2 transition-all ${
                    isTeam2Selected
                      ? 'border-emerald-500 bg-emerald-500/20'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
                  } ${submitted ? 'cursor-default' : 'cursor-pointer hover:bg-slate-800/50'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <div className="font-bold text-white text-lg">
                        {matchup.team2.displayName}
                      </div>
                      <div className="text-sm text-slate-400">
                        {matchup.team2.username}
                      </div>
                    </div>
                    {isTeam2Selected && (
                      <div className="text-emerald-400">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Submit Button */}
      {!submitted && (
        <div className="flex justify-center">
          <button
            onClick={submitBets}
            disabled={!allMatchupsHaveBets}
            className={`px-8 py-4 rounded-lg font-bold text-lg transition-all ${
              allMatchupsHaveBets
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg hover:shadow-xl'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            {allMatchupsHaveBets 
              ? '🎰 Lock In Your Bets!' 
              : `Select ${matchups.length - bets.size} More Matchup${matchups.length - bets.size !== 1 ? 's' : ''}`
            }
          </button>
        </div>
      )}

      {/* Success Message */}
      {submitted && (
        <div className="bg-emerald-500/20 border-2 border-emerald-500 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <h3 className="text-xl font-bold text-emerald-400 mb-2">
            Bets Locked In!
          </h3>
          <p className="text-slate-300">
            Good luck! Check back after the games to see how you did.
          </p>
        </div>
      )}
    </div>
  );
}
