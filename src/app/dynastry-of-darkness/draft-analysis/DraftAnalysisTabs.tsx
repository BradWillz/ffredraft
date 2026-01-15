"use client";

import { useState } from "react";

interface DraftPick {
  pickNumber: number;
  playerId: string;
  playerName: string;
  position: string;
  draftedBy: string;
  draftedByName: string;
  totalPoints: number;
  trueValue: number;
}

interface SeasonDraft {
  season: string;
  draftId: string;
  picks: DraftPick[];
  teamsCount: number;
}

interface DraftAnalysisTabsProps {
  seasonsData: SeasonDraft[];
}

function formatPick(pickNumber: number, teamsCount: number): string {
  const round = Math.ceil(pickNumber / teamsCount);
  const pickInRound = ((pickNumber - 1) % teamsCount) + 1;
  return `${round}.${pickInRound.toString().padStart(2, '0')}`;
}

type SortField = 'drafted' | 'shouldBe' | 'points' | 'player';
type SortDirection = 'asc' | 'desc';

export default function DraftAnalysisTabs({ seasonsData }: DraftAnalysisTabsProps) {
  const [selectedSeason, setSelectedSeason] = useState(seasonsData[0]?.season || "");
  const [sortField, setSortField] = useState<SortField>('drafted');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const currentSeasonData = seasonsData.find(s => s.season === selectedSeason);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedPicks = currentSeasonData ? [...currentSeasonData.picks].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'drafted':
        comparison = a.pickNumber - b.pickNumber;
        break;
      case 'shouldBe':
        comparison = a.trueValue - b.trueValue;
        break;
      case 'points':
        comparison = a.totalPoints - b.totalPoints;
        break;
      case 'player':
        comparison = a.playerName.localeCompare(b.playerName);
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  }) : [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Tabs */}
      <div className="bg-purple-800/30 backdrop-blur-sm rounded-xl border border-purple-700/50 overflow-hidden">
        <div className="flex flex-wrap">
          {seasonsData.map((seasonData) => (
            <button
              key={seasonData.season}
              onClick={() => setSelectedSeason(seasonData.season)}
              className={`flex-1 px-3 sm:px-6 md:px-8 py-3 sm:py-4 text-base sm:text-lg font-bold whitespace-nowrap transition-all duration-200 ${
                selectedSeason === seasonData.season
                  ? "bg-gradient-to-r from-purple-700 to-indigo-700 text-white"
                  : "text-purple-300 hover:text-white hover:bg-purple-700/30"
              }`}
            >
              {seasonData.season}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Season Table */}
      {currentSeasonData && (
        <div className="bg-purple-800/30 backdrop-blur-sm rounded-xl border border-purple-600/30 overflow-hidden">
          {/* Season Header */}
          <div className="bg-gradient-to-r from-purple-700 to-indigo-700 px-4 sm:px-6 py-3 sm:py-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white">{currentSeasonData.season} Season</h2>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-purple-900/50">
                <tr className="border-b border-purple-700">
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">
                    <button onClick={() => handleSort('player')} className="flex items-center gap-1 hover:text-white transition-colors">
                      Player {sortField === 'player' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-purple-300 uppercase tracking-wider">Pos</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-purple-300 uppercase tracking-wider">Drafted By</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-purple-300 uppercase tracking-wider">
                    <button onClick={() => handleSort('drafted')} className="flex items-center gap-1 hover:text-white transition-colors mx-auto">
                      Drafted {sortField === 'drafted' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-purple-300 uppercase tracking-wider">
                    <button onClick={() => handleSort('shouldBe')} className="flex items-center gap-1 hover:text-white transition-colors mx-auto">
                      Should've Been {sortField === 'shouldBe' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-purple-300 uppercase tracking-wider">
                    <button onClick={() => handleSort('points')} className="flex items-center gap-1 hover:text-white transition-colors mx-auto">
                      Total Pts {sortField === 'points' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-700/30">
                {sortedPicks.map((pick, index) => {
                  const diff = pick.pickNumber - pick.trueValue;
                  const isSteal = diff > 5;
                  const isBust = diff < -5;

                  return (
                    <tr 
                      key={pick.pickNumber} 
                      className={`hover:bg-purple-700/20 transition-colors duration-150 ${
                        index % 2 === 0 ? "bg-purple-900/20" : ""
                      } ${isSteal ? "bg-green-900/20" : ""} ${
                        isBust ? "bg-red-900/40" : ""
                      }`}
                    >
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <span className="text-white font-semibold text-sm sm:text-base">{pick.playerName}</span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                        <span className="text-purple-300 text-sm sm:text-base">{pick.position}</span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <span className="text-purple-200 text-sm sm:text-base">{pick.draftedByName}</span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                        <span className="text-white font-mono font-bold text-sm sm:text-base">
                          {formatPick(pick.pickNumber, currentSeasonData.teamsCount)}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                        <span className={`font-mono font-bold text-sm sm:text-base ${
                          diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-gray-400"
                        }`}>
                          {formatPick(pick.trueValue, currentSeasonData.teamsCount)}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                        <span className="text-white font-mono text-sm sm:text-base">{pick.totalPoints.toFixed(2)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-purple-900/20 border-t border-purple-700/30">
            <div className="flex flex-wrap gap-3 sm:gap-4 text-xs text-purple-200">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-900/40 border border-green-700"></div>
                <span>Steal (drafted 5+ picks later)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-red-900/60 border border-red-700"></div>
                <span>Bust (drafted 5+ picks earlier)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {seasonsData.length === 0 && (
        <div className="text-center text-purple-200 text-lg py-12">
          No draft data available yet.
        </div>
      )}
    </div>
  );
}
