'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getLeagueMatchups, getLeagueRosters, getLeagueUsers } from '@/lib/sleeper';
import { SLEEPER_LEAGUE_ID } from '@/lib/config';
import { getDisplayName } from '@/lib/normalize-username';

interface PowerHolder {
  week: number;
  holderName: string;
  rosterId: number;
  reason: string;
  points?: number;
  opponentName?: string;
  date: string;
}

export default function ThePowerPage() {
  const [currentWeek, setCurrentWeek] = useState(1);
  const [powerHistory, setPowerHistory] = useState<PowerHolder[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [rosters, setRosters] = useState<any[]>([]);

  useEffect(() => {
    setIsClient(true);
    loadData();
  }, []);

  const loadData = async () => {
    // Load saved data from localStorage
    const savedWeek = localStorage.getItem('powerCurrentWeek');
    const savedHistory = localStorage.getItem('powerHistory');

    if (savedWeek) setCurrentWeek(parseInt(savedWeek));
    if (savedHistory) setPowerHistory(JSON.parse(savedHistory));

    // Fetch league data
    try {
      const [leagueUsers, leagueRosters] = await Promise.all([
        getLeagueUsers(SLEEPER_LEAGUE_ID),
        getLeagueRosters(SLEEPER_LEAGUE_ID)
      ]);
      setUsers(leagueUsers);
      setRosters(leagueRosters);
    } catch (error) {
      console.error('Error loading league data:', error);
    }
  };

  const calculateWeekPower = async (week: number) => {
    setIsCalculating(true);
    try {
      const matchups = await getLeagueMatchups(SLEEPER_LEAGUE_ID, week);
      const rosterMap = new Map(rosters.map((r: any) => [r.roster_id, r]));
      const userMap = new Map(users.map((u: any) => [u.user_id, u]));

      // Find current power holder if exists
      const currentHolder = powerHistory.length > 0 
        ? powerHistory[powerHistory.length - 1] 
        : null;

      if (week === 1 || !currentHolder) {
        // Week 1: Highest scorer gets the power
        let highestScore = 0;
        let highestScorer: any = null;

        matchups.forEach((m: any) => {
          if (m.points > highestScore) {
            highestScore = m.points;
            highestScorer = m;
          }
        });

        if (highestScorer) {
          const roster: any = rosterMap.get(highestScorer.roster_id);
          const user: any = roster ? userMap.get(roster.owner_id) : null;
          const holderName = user ? getDisplayName(user.username || user.display_name) : `Team ${highestScorer.roster_id}`;
          
          const newHolder: PowerHolder = {
            week,
            holderName,
            rosterId: highestScorer.roster_id,
            reason: 'Highest scorer of the week',
            points: highestScore,
            date: new Date().toISOString()
          };

          addPowerHolder(newHolder);
        }
      } else {
        // Check if current holder lost their matchup
        const holderMatchup = matchups.find((m: any) => m.roster_id === currentHolder.rosterId);
        
        if (!holderMatchup) {
          alert('Could not find matchup for current power holder');
          setIsCalculating(false);
          return;
        }

        // Find opponent in the same matchup
        const opponentMatchup = matchups.find((m: any) => 
          m.matchup_id === holderMatchup.matchup_id && m.roster_id !== holderMatchup.roster_id
        );

        if (!opponentMatchup) {
          // Holder might have had a bye week or something - keep the power
          const newHolder: PowerHolder = {
            week,
            holderName: currentHolder.holderName,
            rosterId: currentHolder.rosterId,
            reason: 'Retained (no matchup or bye week)',
            date: new Date().toISOString()
          };
          addPowerHolder(newHolder);
        } else {
          // Check who won
          if (holderMatchup.points < opponentMatchup.points) {
            // Holder lost! Transfer power to opponent
            const roster: any = rosterMap.get(opponentMatchup.roster_id);
            const user: any = roster ? userMap.get(roster.owner_id) : null;
            const newHolderName = user ? getDisplayName(user.username || user.display_name) : `Team ${opponentMatchup.roster_id}`;
            
            const newHolder: PowerHolder = {
              week,
              holderName: newHolderName,
              rosterId: opponentMatchup.roster_id,
              reason: `Defeated ${currentHolder.holderName}`,
              points: opponentMatchup.points,
              opponentName: currentHolder.holderName,
              date: new Date().toISOString()
            };

            addPowerHolder(newHolder);
          } else {
            // Holder won and retains the power
            const roster: any = rosterMap.get(opponentMatchup.roster_id);
            const user: any = roster ? userMap.get(roster.owner_id) : null;
            const opponentName = user ? getDisplayName(user.username || user.display_name) : `Team ${opponentMatchup.roster_id}`;

            const newHolder: PowerHolder = {
              week,
              holderName: currentHolder.holderName,
              rosterId: currentHolder.rosterId,
              reason: `Retained by defeating ${opponentName}`,
              points: holderMatchup.points,
              opponentName,
              date: new Date().toISOString()
            };

            addPowerHolder(newHolder);
          }
        }
      }

      // Move to next week
      const newWeek = week + 1;
      setCurrentWeek(newWeek);
      localStorage.setItem('powerCurrentWeek', newWeek.toString());
    } catch (error) {
      console.error('Error calculating power holder:', error);
      alert('Failed to calculate power holder. Please try again.');
    }
    setIsCalculating(false);
  };

  const addPowerHolder = (holder: PowerHolder) => {
    const newHistory = [...powerHistory, holder];
    setPowerHistory(newHistory);
    localStorage.setItem('powerHistory', JSON.stringify(newHistory));
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset THE POWER? This will clear all history.')) {
      setCurrentWeek(1);
      setPowerHistory([]);
      localStorage.removeItem('powerCurrentWeek');
      localStorage.removeItem('powerHistory');
    }
  };

  const handleManualEntry = () => {
    const name = prompt('Enter the name of the power holder:');
    if (!name) return;

    const reason = prompt('Enter the reason they got the power:');
    if (!reason) return;

    const newHolder: PowerHolder = {
      week: currentWeek,
      holderName: name,
      rosterId: 0, // Manual entry
      reason,
      date: new Date().toISOString()
    };

    addPowerHolder(newHolder);
    const newWeek = currentWeek + 1;
    setCurrentWeek(newWeek);
    localStorage.setItem('powerCurrentWeek', newWeek.toString());
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-900 via-blue-900 to-blue-800 p-8">
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
    <div className="min-h-screen bg-gradient-to-br from-cyan-900 via-blue-900 to-blue-800 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
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
          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={handleReset}
              className="px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm sm:text-base"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Game Rules */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 mb-6 sm:mb-8 border-2 border-cyan-500/30">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 flex items-center gap-2">
            <span>📜</span> How It Works
          </h2>
          <div className="space-y-2 text-white/90 text-sm sm:text-base">
            <p><strong>Week 1:</strong> The highest scoring team earns THE POWER (🦆)</p>
            <p><strong>Week 2+:</strong> The current holder keeps THE POWER unless they lose their head-to-head matchup</p>
            <p><strong>Power Transfer:</strong> When the holder loses, their opponent takes THE POWER</p>
            <p className="text-cyan-300 font-semibold mt-3">The holder of THE POWER has ultimate bragging rights... until they lose!</p>
          </div>
        </div>

        {/* Current Power Holder */}
        {currentHolder && (
          <div className="bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl p-6 sm:p-8 mb-6 sm:mb-8 text-center shadow-2xl border-4 border-cyan-300">
            <div className="text-white/90 text-sm sm:text-base mb-2">Current Holder of THE POWER</div>
            <div className="mb-4 flex justify-center">
              <Image src="/rubber-duck.png" alt="Rubber Duck" width={200} height={200} className="w-24 h-24 sm:w-32 sm:h-32 md:w-48 md:h-48 animate-bounce" />
            </div>
            <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2">{currentHolder.holderName}</div>
            <div className="text-white/90 text-sm sm:text-base">Since Week {currentHolder.week}</div>
            <div className="text-white/80 text-xs sm:text-sm mt-2 italic">{currentHolder.reason}</div>
          </div>
        )}

        {/* Calculate Next Week */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-white/70 text-sm mb-1">Next Week to Calculate</div>
              <div className="text-3xl font-bold text-white">Week {currentWeek}</div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => calculateWeekPower(currentWeek)}
                disabled={isCalculating || currentWeek > 14}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex-1 sm:flex-none"
              >
                {isCalculating ? 'Calculating...' : '🤖 Auto Calculate'}
              </button>
              <button
                onClick={handleManualEntry}
                disabled={isCalculating || currentWeek > 14}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex-1 sm:flex-none"
              >
                ✏️ Manual
              </button>
            </div>
          </div>
        </div>

        {/* Power Transfer Timeline */}
        {powerHistory.length > 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6">
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
                      <div className="text-white/50 text-xs sm:text-right">
                        {new Date(holder.date).toLocaleDateString()}
                      </div>
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
              Calculate Week 1 to determine who earns THE POWER!
            </div>
            <button
              onClick={() => calculateWeekPower(1)}
              disabled={isCalculating}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors font-bold"
            >
              {isCalculating ? 'Calculating...' : 'Calculate Week 1 Winner'}
            </button>
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
