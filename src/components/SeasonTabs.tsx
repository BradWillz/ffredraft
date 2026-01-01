"use client";

import { useState } from "react";

type SeasonRow = {
  userId: string;
  name: string;
  pf: number;
  pa: number;
};

type SeasonData = {
  season: string;
  teams: SeasonRow[];
};

interface SeasonTabsProps {
  seasonsData: SeasonData[];
}

function formatNumber(value: number) {
  return value.toFixed(2);
}

export default function SeasonTabs({ seasonsData }: SeasonTabsProps) {
  const [selectedSeason, setSelectedSeason] = useState(seasonsData[0]?.season || "");

  const currentSeasonData = seasonsData.find(s => s.season === selectedSeason);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Tabs */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
        <div className="flex flex-wrap">
          {seasonsData.map((seasonData) => (
            <button
              key={seasonData.season}
              onClick={() => setSelectedSeason(seasonData.season)}
              className={`flex-1 px-3 sm:px-6 md:px-8 py-3 sm:py-4 text-base sm:text-lg font-bold whitespace-nowrap transition-all duration-200 ${
                selectedSeason === seasonData.season
                  ? "bg-gradient-to-r from-purple-600 to-purple-500 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/30"
              }`}
            >
              {seasonData.season}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Season Table */}
      {currentSeasonData && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
          {/* Season Header */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-500 px-4 sm:px-6 py-3 sm:py-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white">{currentSeasonData.season} Season</h2>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr className="border-b border-slate-700">
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">#</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Team</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Points For</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Points Against</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {currentSeasonData.teams.map((team, index) => (
                  <tr key={team.userId} className="hover:bg-slate-700/30 transition-colors duration-150">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs sm:text-sm">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-slate-200 font-medium text-sm sm:text-base">{team.name}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <span className="text-green-400 font-bold text-sm sm:text-base">{formatNumber(team.pf)}</span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <span className="text-red-400 font-bold text-sm sm:text-base">{formatNumber(team.pa)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
