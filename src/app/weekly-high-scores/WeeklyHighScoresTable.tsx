"use client";

import { useMemo } from "react";

type WeeklyHigh = {
  season: string;
  week: number;
  teamName: string;
  points: number;
  opponentName: string;
};

export default function WeeklyHighScoresTable({ data }: { data: WeeklyHigh[] }) {
  // Get top 20 by points
  const top20 = useMemo(() => {
    return [...data].sort((a, b) => b.points - a.points).slice(0, 20);
  }, [data]);

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-900/50">
            <tr className="border-b border-slate-700">
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">#</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Season</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Week</th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Team 🔥
              </th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Points
              </th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Buried 🪦
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {top20.map((row, index) => (
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
