'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getLeagueRosters, getLeagueUsers } from '@/lib/sleeper';
import { SLEEPER_LEAGUE_ID } from '@/lib/config';
import { getDisplayName } from '@/lib/normalize-username';

interface PowerHolder {
  week: number;
  holderName: string;
  rosterId: number;
  reason: string;
  points?: number;
  opponentName?: string;
  date?: string;
}

export default function ThePowerPage() {
  const [currentWeek, setCurrentWeek] = useState(1);
  const [powerHistory, setPowerHistory] = useState<PowerHolder[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [rosters, setRosters] = useState<any[]>([]);

  useEffect(() => {
    setIsClient(true);
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [powerResponse, sessionResponse, leagueUsers, leagueRosters] = await Promise.all([
        fetch('/api/power', { cache: 'no-store' }),
        fetch('/api/admin/session', { cache: 'no-store' }),
        getLeagueUsers(SLEEPER_LEAGUE_ID),
        getLeagueRosters(SLEEPER_LEAGUE_ID)
      ]);
      if (!powerResponse.ok) throw new Error('Power history request failed');
      const powerState = await powerResponse.json();
      const session = await sessionResponse.json();
      setPowerHistory(powerState.history);
      setCurrentWeek(powerState.nextWeek);
      setIsAdmin(session.isAdmin === true);
      setUsers(leagueUsers);
      setRosters(leagueRosters);
    } catch (error) {
      console.error('Error loading league data:', error);
    }
  };

  const handleReset = async () => {
    if (confirm('Clear the commissioner override and return to the automatic Sleeper history?')) {
      const response = await fetch('/api/power', { method: 'DELETE' });
      if (response.ok) {
        const powerState = await response.json();
        setPowerHistory(powerState.history);
        setCurrentWeek(powerState.nextWeek);
      }
    }
  };

  const handleManualEntry = async () => {
    const name = prompt('Enter the name of the power holder:');
    if (!name) return;
    const user = users.find((item: any) => getDisplayName(item.username || item.display_name) === name);
    const roster = rosters.find((item: any) => item.owner_id === user?.user_id);
    if (!roster) return alert('No 2026 roster matched that display name.');
    setIsCalculating(true);
    const response = await fetch('/api/power', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ effectiveWeek: currentWeek, rosterId: roster.roster_id }),
    });
    setIsCalculating(false);
    if (!response.ok) return alert('Unable to save the commissioner override.');
    const powerState = await response.json();
    setPowerHistory(powerState.history);
    setCurrentWeek(powerState.nextWeek);
  };

  if (!isClient) {
    return (
      <div className="redraft-tool min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Link 
              href="/" 
              className="text-white/70 hover:text-white transition-colors"
            >
              ← Back
            </Link>
            <h1 className="text-4xl font-bold text-white">🦆 THE POWER</h1>
          </div>
          <div className="text-white text-center">Loading...</div>
        </div>
      </div>
    );
  }

  const currentHolder = powerHistory.length > 0 
    ? powerHistory[powerHistory.length - 1] 
    : null;

  return (
    <div className="redraft-tool min-h-screen p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="redraft-tool__header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link 
              href="/" 
              className="text-white/70 hover:text-white transition-colors text-sm sm:text-base"
            >
              ← Back
            </Link>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white flex items-center gap-2">
              <Image src="/rubber-duck.png" alt="Rubber Duck" width={48} height={48} className="w-10 h-10 sm:w-12 sm:h-12" />
              THE POWER
            </h1>
          </div>
          {isAdmin && <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={handleReset}
              className="tool-command tool-command--danger px-3 sm:px-4 py-2 text-sm sm:text-base"
            >
              Reset
            </button>
          </div>}
        </div>

        {/* Game Rules */}
        <div className="tool-panel p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 flex items-center gap-2">
            <span>📜</span> How It Works
          </h2>
          <div className="space-y-2 text-white/90 text-sm sm:text-base">
            <p><strong>Week 1:</strong> Tucker carries THE POWER into the opening matchup</p>
            <p><strong>Week 1+:</strong> The current holder keeps THE POWER unless they lose their head-to-head matchup</p>
            <p><strong>Power Transfer:</strong> When the holder loses, their opponent takes THE POWER</p>
            <p className="text-cyan-300 font-semibold mt-3">Sleeper results update this page automatically after each game week is finalized.</p>
          </div>
        </div>

        {/* Current Power Holder */}
        {currentHolder && (
          <div className="tool-feature tool-feature__header p-6 sm:p-8 mb-6 sm:mb-8 text-center">
            <div className="text-white/90 text-sm sm:text-base mb-2">Current Holder of THE POWER</div>
            <div className="mb-4 flex justify-center">
              <Image src="/rubber-duck.png" alt="Rubber Duck" width={200} height={200} className="w-24 h-24 sm:w-32 sm:h-32 md:w-48 md:h-48 animate-bounce" />
            </div>
            <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2">{currentHolder.holderName}</div>
            <div className="text-white/90 text-sm sm:text-base">{currentHolder.week === 0 ? 'Entering Week 1' : `Since Week ${currentHolder.week}`}</div>
            <div className="text-white/80 text-xs sm:text-sm mt-2 italic">{currentHolder.reason}</div>
          </div>
        )}

        {/* Automatic update status */}
        <div className="tool-metrics p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-white/70 text-sm mb-1">Next automatic update</div>
              <div className="text-3xl font-bold text-white">Week {currentWeek}</div>
            </div>
            <div className="text-white/70 text-sm sm:text-right">Sleeper finalizes the result</div>
            {isAdmin && <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={handleManualEntry}
                disabled={isCalculating || currentWeek > 14}
                className="tool-command px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none"
              >
                {isCalculating ? 'Saving...' : 'Manual override'}
              </button>
            </div>}
          </div>
        </div>

        {/* Power Transfer Timeline */}
        {powerHistory.length > 0 && (
          <div className="tool-panel p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <span>📊</span> Power Transfer History
            </h2>
            <div className="space-y-3">
              {powerHistory.slice().reverse().map((holder, index) => {
                const isCurrentHolder = index === 0;
                return (
                  <div 
                    key={`${holder.week}-${holder.date}`}
                    className={`rounded-lg p-4 ${
                      isCurrentHolder 
                        ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border-2 border-yellow-400' 
                        : 'bg-white/5'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                      <div className="flex items-start gap-3">
                        <div 
                          className={`w-12 h-12 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
                            isCurrentHolder
                              ? 'bg-gradient-to-br from-cyan-400 to-blue-400 text-white shadow-lg text-xl'
                              : 'bg-white/10 text-white/70'
                          }`}
                        >
                          {isCurrentHolder ? (
                            <Image src="/rubber-duck.png" alt="Duck" width={32} height={32} className="w-8 h-8" />
                          ) : (
                            holder.week
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-bold text-lg">{holder.holderName}</span>
                            {isCurrentHolder && (
                              <span className="px-2 py-1 bg-cyan-500 text-white text-xs rounded-full font-bold">
                                CURRENT
                              </span>
                            )}
                          </div>
                          <div className="text-white/70 text-sm">Week {holder.week}</div>
                          <div className="text-white/90 text-sm mt-1">{holder.reason}</div>
                          {holder.points && (
                            <div className="text-white/60 text-xs mt-1">
                              {holder.points.toFixed(2)} pts
                            </div>
                          )}
                        </div>
                      </div>
                      {holder.date && (
                        <div className="text-white/50 text-xs sm:text-right">
                          {new Date(holder.date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {powerHistory.length === 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 sm:p-12 text-center">
            <div className="flex justify-center mb-4">
              <Image src="/rubber-duck.png" alt="Rubber Duck" width={120} height={120} className="w-20 h-20 sm:w-24 sm:h-24 md:w-30 md:h-30" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white mb-2">No Power Holder Yet</div>
            <div className="text-white/70 text-sm sm:text-base mb-6">
              Sleeper data is temporarily unavailable. Tucker remains the Week 1 starting holder.
            </div>
          </div>
        )}

        {/* Statistics */}
        {powerHistory.length > 0 && (
          <div className="mt-6 sm:mt-8 bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <span>📈</span> Statistics
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <div className="text-white/70 text-sm mb-1">Total Transfers</div>
                <div className="text-3xl font-bold text-white">{powerHistory.length - 1}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <div className="text-white/70 text-sm mb-1">Weeks Tracked</div>
                <div className="text-3xl font-bold text-white">{currentWeek - 1}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <div className="text-white/70 text-sm mb-1">Different Holders</div>
                <div className="text-3xl font-bold text-white">
                  {new Set(powerHistory.map(h => h.holderName)).size}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
