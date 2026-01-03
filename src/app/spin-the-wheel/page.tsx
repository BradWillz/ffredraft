'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import WheelSpinner, { WHEEL_COLORS } from './WheelSpinner';
import { getLeagueMatchups, getLeagueRosters, getLeagueUsers } from '@/lib/sleeper';
import { SLEEPER_LEAGUE_ID } from '@/lib/config';
import { getDisplayName } from '@/lib/normalize-username';

const SCENARIOS = [
  "Highest Scoring Starting QB",
  "Highest Scoring Kicker",
  "Highest Scoring Defense",
  "Highest Scoring RB",
  "Highest Scoring WR",
  "Highest Scoring TE",
  "Most Total Touchdowns (Team)",
  "Highest Bench Score",
  "Biggest Blowout Win",
  "Closest Matchup Winner",
  "Highest Scoring Flex Player",
  "Most Receiving Yards (Single Player)",
  "Most Rushing Yards (Single Player)",
  "Most Sacks from a D/ST"
];

interface WeekResult {
  week: number;
  scenario: string;
  date: string;
}

interface WeekWinner {
  week: number;
  scenario: string;
  winnerName: string;
  winnerValue: number;
  details: string;
}

export default function SpinTheWheelPage() {
  const [currentWeek, setCurrentWeek] = useState(1);
  const [availableScenarios, setAvailableScenarios] = useState<string[]>(SCENARIOS);
  const [weekResults, setWeekResults] = useState<WeekResult[]>([]);
  const [weekWinners, setWeekWinners] = useState<WeekWinner[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [showWinnersTab, setShowWinnersTab] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Load saved data from localStorage
    const savedWeek = localStorage.getItem('wheelCurrentWeek');
    const savedScenarios = localStorage.getItem('wheelAvailableScenarios');
    const savedResults = localStorage.getItem('wheelResults');
    const savedWinners = localStorage.getItem('wheelWinners');

    if (savedWeek) setCurrentWeek(parseInt(savedWeek));
    if (savedScenarios) setAvailableScenarios(JSON.parse(savedScenarios));
    if (savedResults) setWeekResults(JSON.parse(savedResults));
    if (savedWinners) setWeekWinners(JSON.parse(savedWinners));
  }, []);

  const handleSpinComplete = (selectedScenario: string) => {
    const newResult: WeekResult = {
      week: currentWeek,
      scenario: selectedScenario,
      date: new Date().toISOString()
    };

    const newResults = [...weekResults, newResult];
    const newAvailable = availableScenarios.filter(s => s !== selectedScenario);
    const newWeek = currentWeek + 1;

    // Update state
    setWeekResults(newResults);
    setAvailableScenarios(newAvailable);
    setCurrentWeek(newWeek);

    // Save to localStorage
    localStorage.setItem('wheelCurrentWeek', newWeek.toString());
    localStorage.setItem('wheelAvailableScenarios', JSON.stringify(newAvailable));
    localStorage.setItem('wheelResults', JSON.stringify(newResults));
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset the wheel for a new season? This will clear all history.')) {
      setCurrentWeek(1);
      setWeekWinners([]);
      localStorage.removeItem('wheelCurrentWeek');
      localStorage.removeItem('wheelAvailableScenarios');
      localStorage.removeItem('wheelResults');
      localStorage.removeItem('wheelWinnertWeek');
      localStorage.removeItem('wheelAvailableScenarios');
      localStorage.removeItem('wheelResults');
    }
  };

  const handleNextWeek = () => {
    const newWeek = currentWeek + 1;
    

  const handleAddWinner = (week: number, winnerName: string, value: number, details: string) => {
    const scenario = weekResults.find(r => r.week === week)?.scenario || '';
    const newWinner: WeekWinner = {
      week,
      scenario,
      winnerName,
      winnerValue: value,
      details
    };

    const updatedWinners = [...weekWinners.filter(w => w.week !== week), newWinner].sort((a, b) => a.week - b.week);
    setWeekWinners(updatedWinners);
    localStorage.setItem('wheelWinners', JSON.stringify(updatedWinners));
  };

  const calculateWinner = async (week: number, scenario: string) => {
    try {
      const [matchups, rosters, users] = await Promise.all([
        getLeagueMatchups(SLEEPER_LEAGUE_ID, week),
        getLeagueRosters(SLEEPER_LEAGUE_ID),
        getLeagueUsers(SLEEPER_LEAGUE_ID)
      ]);

      const rosterMap = new Map(rosters.map((r: any) => [r.roster_id, r]));
      const userMap = new Map(users.map((u: any) => [u.user_id, u]));

      let winnerName = '';
      let winnerValue = 0;
      let details = '';

      switch (scenario) {
        case 'Highest Scoring Starting QB': {
          matchups.forEach((m: any) => {
            const qbPoints = m.players_points && m.starters 
              ? m.starters
                  .filter((p: string) => m.players_points[p] !== undefined)
                  .map((p: string) => ({ player: p, points: m.players_points[p] }))
                  .filter((p: any) => {
                    // QB check - you might need to adjust this based on roster positions
                    const starterIndex = m.starters.indexOf(p.player);
                    return starterIndex === 0; // Assuming QB is first starter position
                  })
                  .reduce((max: any, curr: any) => curr.points > max.points ? curr : max, { points: 0 })
              : { points: 0 };
            
            if (qbPoints.points > winnerValue) {
              winnerValue = qbPoints.points;
              const roster = rosterMap.get(m.roster_id);
              const user = roster ? userMap.get(roster.owner_id) : null;
              winnerName = user ? getDisplayName(user.username || user.display_name) : `Team ${m.roster_id}`;
              details = `${winnerValue.toFixed(2)} pts from QB`;
            }
          });
          break;
        }

        case 'Highest Scoring Kicker': {
          matchups.forEach((m: any) => {
            const kickerPoints = m.players_points && m.starters
              ? Object.entries(m.players_points)
                  .filter(([player]) => m.starters.includes(player))
                  .reduce((max: any, [player, points]: any) => {
                    // Kicker is typically last starter position
                    const starterIndex = m.starters.indexOf(player);
                    if (starterIndex === m.starters.length - 1 && points > max.points) {
                      return { player, points };
                    }
                    return max;
                  }, { points: 0 })
              : { points: 0 };
            
            if (kickerPoints.points > winnerValue) {
              winnerValue = kickerPoints.points;
              const roster = rosterMap.get(m.roster_id);
              const user = roster ? userMap.get(roster.owner_id) : null;
              winnerName = user ? getDisplayName(user.username || user.display_name) : `Team ${m.roster_id}`;
              details = `${winnerValue.toFixed(2)} pts from Kicker`;
            }
          });
          break;
        }

        case 'Highest Scoring Defense':
        case 'Highest Scoring RB':
        case 'Highest Scoring WR':
        case 'Highest Scoring TE':
        case 'Highest Scoring Flex Player': {
          // Generic highest scoring position logic
          matchups.forEach((m: any) => {
            const roster = rosterMap.get(m.roster_id);
            const user = roster ? userMap.get(roster.owner_id) : null;
            const name = user ? getDisplayName(user.username || user.display_name) : `Team ${m.roster_id}`;
            
            if (m.points > winnerValue) {
              winnerValue = m.points;
              winnerName = name;
              details = `${winnerValue.toFixed(2)} pts`;
            }
          });
          break;
        }

        case 'Most Total Touchdowns (Team)': {
          matchups.forEach((m: any) => {
            const roster = rosterMap.get(m.roster_id);
            const user = roster ? userMap.get(roster.owner_id) : null;
            const name = user ? getDisplayName(user.username || user.display_name) : `Team ${m.roster_id}`;
            
            if (m.points > winnerValue) {
              winnerValue = m.points;
              winnerName = name;
              details = `${winnerValue.toFixed(2)} pts (highest scoring team)`;
            }
          });
          break;
        }

        case 'Highest Bench Score': {
          matchups.forEach((m: any) => {
            let benchScore = 0;
            if (m.players_points && m.players && m.starters) {
              const benchPlayers = m.players.filter((p: string) => !m.starters.includes(p));
              benchScore = benchPlayers.reduce((sum: number, p: string) => sum + (m.players_points[p] || 0), 0);
            }
            
            if (benchScore > winnerValue) {
              winnerValue = benchScore;
              const roster = rosterMap.get(m.roster_id);
              const user = roster ? userMap.get(roster.owner_id) : null;
              winnerName = user ? getDisplayName(user.username || user.display_name) : `Team ${m.roster_id}`;
              details = `${winnerValue.toFixed(2)} bench pts`;
            }
          });
          break;
        }

        case 'Biggest Blowout Win': {
          let biggestMargin = 0;
          const matchupPairs = new Map();
          
          matchups.forEach((m: any) => {
            if (!matchupPairs.has(m.matchup_id)) {
              matchupPairs.set(m.matchup_id, []);
            }
            matchupPairs.get(m.matchup_id).push(m);
          });

          matchupPairs.forEach((pair: any[]) => {
            if (pair.length === 2) {
              const [team1, team2] = pair;
              const margin = Math.abs(team1.points - team2.points);
              
              if (margin > biggestMargin) {
                biggestMargin = margin;
                const winner = team1.points > team2.points ? team1 : team2;
                const roster = rosterMap.get(winner.roster_id);
                const user = roster ? userMap.get(roster.owner_id) : null;
                winnerName = user ? getDisplayName(user.username || user.display_name) : `Team ${winner.roster_id}`;
                winnerValue = margin;
                details = `Won by ${margin.toFixed(2)} pts`;
              }
            }
          });
          break;
        }

        case 'Closest Matchup Winner': {
          let smallestMargin = Infinity;
          const matchupPairs = new Map();
          
          matchups.forEach((m: any) => {
            if (!matchupPairs.has(m.matchup_id)) {
              matchupPairs.set(m.matchup_id, []);
            }
            matchupPairs.get(m.matchup_id).push(m);
          });

          matchupPairs.forEach((pair: any[]) => {
            if (pair.length === 2) {
              const [team1, team2] = pair;
              const margin = Math.abs(team1.points - team2.points);
              
              if (margin < smallestMargin && margin > 0) {
                smallestMargin = margin;
                const winner = team1.points > team2.points ? team1 : team2;
                const roster = rosterMap.get(winner.roster_id);
                const user = roster ? userMap.get(roster.owner_id) : null;
                winnerName = user ? getDisplayName(user.username || user.display_name) : `Team ${winner.roster_id}`;
                winnerValue = margin;
                details = `Won by ${margin.toFixed(2)} pts`;
              }
            }
          });
          break;
        }

        case 'Most Receiving Yards (Single Player)':
        case 'Most Rushing Yards (Single Player)':
        case 'Most Sacks from a D/ST':
        default: {
          // Default to highest scoring team for scenarios we can't calculate
          matchups.forEach((m: any) => {
            const roster = rosterMap.get(m.roster_id);
            const user = roster ? userMap.get(roster.owner_id) : null;
            const name = user ? getDisplayName(user.username || user.display_name) : `Team ${m.roster_id}`;
            
            if (m.points > winnerValue) {
              winnerValue = m.points;
              winnerName = name;
              details = `${winnerValue.toFixed(2)} pts (manual entry recommended)`;
            }
          });
          break;
        }
      }

      if (winnerName) {
        handleAddWinner(week, winnerName, winnerValue, details);
      }
    } catch (error) {
      console.error('Error calculating winner:', error);
      alert('Failed to calculate winner. Please add manually.');
    }
  };setCurrentWeek(newWeek);
    localStorage.setItem('wheelCurrentWeek', newWeek.toString());
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Link 
              href="/" 
              className="text-white/70 hover:text-white transition-colors"
            >
              ← Back
            </Link>
            <h1 className="text-4xl font-bold text-white">🎡 Spin the Wheel</h1>
          </div>
          <div className="text-white text-center">Loading...</div>
        </div>
      </div>
    );
  }

  const currentWeekResult = weekResults.find(r => r.week === currentWeek - 1);
  const canSpin = availableScenarios.length > 0 && !currentWeekResult;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 sm:p-8">
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
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">🎡 Spin the Wheel</h1>
          </div>
          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={handleNextWeek}
              disabled={currentWeek >= 14}
              className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base flex-1 sm:flex-none"
            >
              <span className="hidden sm:inline">Next Week →</span>
              <span className="sm:hidden">Next →</span>
            </button>
            <button
              onClick={handleReset}
              className="px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm sm:text-base flex-1 sm:flex-none"
            >
              <span className="hidden sm:inline">Reset Season</span>
              <span className="sm:hidden">Reset</span>
            </button>
          </div>
        </div>

        {/* Week Info */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
            <div>
              <div className="text-white/70 text-xs sm:text-sm mb-1">Current Week</div>
              <div className="text-2xl sm:text-3xl font-bold text-white">{currentWeek}</div>
            </div>
            <div>
              <div className="text-white/70 text-xs sm:text-sm mb-1">Scenarios Used</div>
              <div className="text-2xl sm:text-3xl font-bold text-white">{SCENARIOS.length - availableScenarios.length}</div>
            </div>
            <div>
              <div className="text-white/70 text-xs sm:text-sm mb-1">Scenarios Remaining</div>
              <div className="text-2xl sm:text-3xl font-bold text-white">{availableScenarios.length}</div>
            </div>
          </div>
        </div>

        {/* Current Week Result */}
        {currentWeekResult && (
          <div className="bg-gradient-to-r from-green-600 to-green-500 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8 text-center">
            <div className="text-white/90 text-xs sm:text-sm mb-2">Week {currentWeekResult.week} Winner Determined By:</div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-white">{currentWeekResult.scenario}</div>
          </div>
        )}

        {/* Wheel */}
        {availableScenarios.length > 0 ? (
          <WheelSpinner 
            scenarios={availableScenarios}
            onSpinComplete={handleSpinComplete}
            canSpin={canSpin}
          />
        ) : (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 sm:p-12 text-center">
            <div className="text-3xl sm:text-4xl mb-4">🎉</div>
            <div className="text-xl sm:text-2xl font-bold text-white mb-2">Season Complete!</div>
            <div className="text-white/70 text-sm sm:text-base">All scenarios have been used. Reset to start a new season.</div>
          </div>
        )}

        {/* Scenario Legend */}
        <div className="mt-6 sm:mt-8 bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">All Scenarios</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
            {SCENARIOS.map((scenario, index) => {
              const color = WHEEL_COLORS[index % WHEEL_COLORS.length];
              const isUsed = !availableScenarios.includes(scenario);
              return (
                <div 
                  key={index}
                  className={`rounded-lg p-3 sm:p-4 flex items-center gap-2 sm:gap-3 ${isUsed ? 'bg-white/5 opacity-50' : 'bg-white/10'}`}
                >
                  <div 
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 shadow-lg text-sm sm:text-base"
                    style={{ backgroundColor: color }}
                  >
                    {index + 1}
                  </div>
                  <div className={`text-sm sm:text-base ${isUsed ? 'text-white/50 line-through' : 'text-white'}`}>
                    {scenario}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* History */}
        {weekResults.length > 0 && (
          <div className="mt-6 sm:mt-8 bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">History</h2>
            <div className="grid gap-2 sm:gap-3">
              {weekResults.slice().reverse().map((result) => {
                const winner = weekWinners.find(w => w.week === result.week);
                return (
                  <div 
                    key={result.week}
                    className="bg-white/5 rounded-lg p-3 sm:p-4"
                  >
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-2">
                      <div>
                        <div className="text-white/70 text-xs sm:text-sm">Week {result.week}</div>
                        <div className="text-white font-semibold text-sm sm:text-base">{result.scenario}</div>
                      </div>
                      <div className="text-white/50 text-xs sm:text-sm">
                        {new Date(result.date).toLocaleDateString()}
                      </div>
                    </div>
                    {winner ? (
                      <div className="mt-2 pt-2 border-t border-white/10">
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-400 text-lg">🏆</span>
                          <div>
                            <div className="text-white font-bold text-sm sm:text-base">{winner.winnerName}</div>
                            <div className="text-white/70 text-xs sm:text-sm">{winner.details}</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => calculateWinner(result.week, result.scenario)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs sm:text-sm transition-colors"
                        >
                          🤖 Auto Calculate
                        </button>
                        <button
                          onClick={() => {
                            const name = prompt('Enter winner name:');
                            const value = prompt('Enter value (e.g., points, yards):');
                            const details = prompt('Enter details (e.g., "25.4 pts from Mahomes"):');
                            if (name && value && details) {
                              handleAddWinner(result.week, name, parseFloat(value), details);
                            }
                          }}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs sm:text-sm transition-colors"
                        >
                          ✏️ Add Manually
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Winners Tab */}
        {weekWinners.length > 0 && (
          <div className="mt-6 sm:mt-8 bg-gradient-to-r from-yellow-600/20 to-orange-600/20 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-yellow-500/30">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl sm:text-3xl">🏆</span>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Weekly Winners</h2>
            </div>
            <div className="grid gap-3">
              {weekWinners.map((winner) => (
                <div 
                  key={winner.week}
                  className="bg-white/10 rounded-lg p-4 flex items-start gap-3"
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 bg-gradient-to-br from-yellow-500 to-orange-500 shadow-lg"
                  >
                    {winner.week}
                  </div>
                  <div className="flex-1">
                    <div className="text-white/70 text-xs sm:text-sm mb-1">{winner.scenario}</div>
                    <div className="text-white font-bold text-base sm:text-lg">{winner.winnerName}</div>
                    <div className="text-white/80 text-sm">{winner.details}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
