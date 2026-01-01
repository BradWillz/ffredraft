"use client";

import { useMemo, useState } from "react";

type WeeklyHigh = {
  season: string;
  week: number;
  teamName: string;
  points: number;
  opponentName: string;
};

type SortField = "points" | "team" | "buried" | null;
type SortDirection = "asc" | "desc";

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <span className="text-slate-500 ml-1">↕</span>;
  return direction === "desc" ? (
    <span className="text-blue-400 ml-1">↓</span>
  ) : (
    <span className="text-blue-400 ml-1">↑</span>
  );
}

export default function WeeklyHighScoresTable({ data }: { data: WeeklyHigh[] }) {
  const [sortField, setSortField] = useState<SortField>("points");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedData = useMemo(() => {
    if (!sortField) return data;

    const sorted = [...data];

    if (sortField === "points") {
      sorted.sort((a, b) => {
        const diff = b.points - a.points;
        return sortDirection === "desc" ? diff : -diff;
      });
    } else if (sortField === "team") {
      // Count occurrences of each team
      const teamCounts = new Map<string, number>();
      data.forEach((row) => {
        teamCounts.set(row.teamName, (teamCounts.get(row.teamName) || 0) + 1);
      });
      
      sorted.sort((a, b) => {
        const countDiff = (teamCounts.get(b.teamName) || 0) - (teamCounts.get(a.teamName) || 0);
        if (countDiff !== 0) {
          return sortDirection === "desc" ? countDiff : -countDiff;
        }
        // Secondary sort by points
        return b.points - a.points;
      });
    } else if (sortField === "buried") {
      // Count occurrences of each buried opponent
      const buriedCounts = new Map<string, number>();
      data.forEach((row) => {
        buriedCounts.set(row.opponentName, (buriedCounts.get(row.opponentName) || 0) + 1);
      });
      
      sorted.sort((a, b) => {
        const countDiff = (buriedCounts.get(b.opponentName) || 0) - (buriedCounts.get(a.opponentName) || 0);
        if (countDiff !== 0) {
          return sortDirection === "desc" ? countDiff : -countDiff;
        }
        // Secondary sort by points
        return b.points - a.points;
      });
    }

    return sorted;
  }, [data, sortField, sortDirection]);

  const top = sortedData.slice(0, 20);

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-900/50">
            <tr className="border-b border-slate-700">
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">#</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Season</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Week</th>
              <th 
                className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors select-none"
                onClick={() => handleSort("team")}
              >
                Team 🔥
                <SortIcon active={sortField === "team"} direction={sortDirection} />
              </th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Points
              </th>
              <th 
                className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors select-none"
                onClick={() => handleSort("buried")}
              >
                Buried 🪦
                <SortIcon active={sortField === "buried"} direction={sortDirection} />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {top.map((row, index) => (
              <tr key={`${row.season}-${row.week}-${row.teamName}`} className="hover:bg-slate-700/30 transition-colors duration-150">
                <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                  <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs sm:text-sm">
                    {index + 1}
                  </span>
                </td>
                <td className="px-3 sm:px-6 py-3 sm:py-4 text-slate-200 font-medium text-sm sm:text-base">{row.season}</td>
                <td className="px-3 sm:px-6 py-3 sm:py-4 text-center text-slate-300 text-sm sm:text-base">{row.week}</td>
                <td className="px-3 sm:px-6 py-3 sm:py-4 text-slate-200 font-medium text-sm sm:text-base">{row.teamName}</td>
                <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                  <span className="text-yellow-400 font-bold text-sm sm:text-base">{row.points.toFixed(2)}</span>
                </td>
                <td className="px-3 sm:px-6 py-3 sm:py-4 text-slate-200 font-medium text-sm sm:text-base">{row.opponentName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
