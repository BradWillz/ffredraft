"use client";

import { useState, useMemo } from "react";
import UserAvatar from "@/components/UserAvatar";

type TeamRow = {
  rosterId: number;
  userId: string;
  username: string;  // Normalized username for avatar lookup
  name: string;      // Display name (real name)
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
};

type SeasonData = {
  season: string;
  leagueName: string;
  teams: TeamRow[];
};

interface StandingsTabsProps {
  seasonsData: SeasonData[];
}

type SortField = "record" | "pointsFor" | "pointsAgainst";
type SortDirection = "asc" | "desc";

export default function StandingsTabs({ seasonsData }: StandingsTabsProps) {
  const [selectedSeason, setSelectedSeason] = useState(seasonsData[0]?.season || "");
  const [sortField, setSortField] = useState<SortField>("record");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const currentSeasonData = seasonsData.find(s => s.season === selectedSeason);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedTeams = useMemo(() => {
    if (!currentSeasonData) return [];

    const teams = [...currentSeasonData.teams];

    teams.sort((a, b) => {
      let comparison = 0;

      if (sortField === "record") {
        if (b.wins !== a.wins) {
          comparison = b.wins - a.wins;
        } else {
          comparison = b.pointsFor - a.pointsFor;
        }
      } else if (sortField === "pointsFor") {
        comparison = b.pointsFor - a.pointsFor;
      } else if (sortField === "pointsAgainst") {
        comparison = b.pointsAgainst - a.pointsAgainst;
      }

      return sortDirection === "desc" ? comparison : -comparison;
    });

    return teams;
  }, [currentSeasonData, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="ml-1 text-slate-500">↕</span>;
    }
    return (
      <span className="ml-1">
        {sortDirection === "desc" ? "↓" : "↑"}
      </span>
    );
  };

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
                  <th 
                    className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors select-none"
                    onClick={() => handleSort("record")}
                  >
                    Record <SortIcon field="record" />
                  </th>
                  <th 
                    className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors select-none"
                    onClick={() => handleSort("pointsFor")}
                  >
                    Points For <SortIcon field="pointsFor" />
                  </th>
                  <th 
                    className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors select-none"
                    onClick={() => handleSort("pointsAgainst")}
                  >
                    Points Against <SortIcon field="pointsAgainst" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {sortedTeams.map((team, index) => (
                  <tr key={team.rosterId} className="hover:bg-slate-700/30 transition-colors duration-150">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs sm:text-sm">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex-shrink-0">
                          <UserAvatar username={team.username} size="sm" />
                        </div>
                        <span className="text-slate-200 font-medium text-sm sm:text-base">{team.name}</span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <span className="text-slate-200 font-semibold text-sm sm:text-base">
                        <span className="text-green-400">{team.wins}</span>-<span className="text-red-400">{team.losses}</span>
                        {team.ties ? <span className="text-slate-400">-{team.ties}</span> : ""}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <span className="text-yellow-400 font-bold text-sm sm:text-base">{team.pointsFor.toFixed(2)}</span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <span className="text-red-400 font-bold text-sm sm:text-base">{team.pointsAgainst.toFixed(2)}</span>
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
