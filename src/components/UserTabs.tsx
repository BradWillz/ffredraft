"use client";

import { useState } from "react";
import UserAvatar from "./UserAvatar";

type HeadToHeadRow = {
  teamId: string;
  teamName: string;
  opponentId: string;
  opponentName: string;
  wins: number;
  losses: number;
  ties: number;
};

interface UserTabsProps {
  groupedByTeam: Map<string, HeadToHeadRow[]>;
}

export default function UserTabs({ groupedByTeam }: UserTabsProps) {
  const teams = Array.from(groupedByTeam.entries());
  const [selectedTeam, setSelectedTeam] = useState(teams[0]?.[0] || "");

  const currentTeamData = groupedByTeam.get(selectedTeam);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
        <div className="flex flex-wrap">
          {teams.map(([teamName]) => (
            <button
              key={teamName}
              onClick={() => setSelectedTeam(teamName)}
              className={`flex-1 px-4 py-4 text-base font-bold whitespace-nowrap transition-all duration-200 flex items-center justify-center gap-2 ${
                selectedTeam === teamName
                  ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/30"
              }`}
            >
              <span>{teamName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Team Data */}
      {currentTeamData && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
          {/* Team Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4">
            <div className="flex items-center gap-3">
              <UserAvatar username={selectedTeam} />
              <h2 className="text-2xl font-bold text-white">{selectedTeam}</h2>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr className="border-b border-slate-700">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Opponent</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">W</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">L</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">T</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {currentTeamData.map((row) => (
                  <tr 
                    key={`${row.teamId}-${row.opponentId}`}
                    className="hover:bg-slate-700/30 transition-colors duration-150"
                  >
                    <td className="px-6 py-4 text-slate-200 font-medium">
                      {row.opponentName}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-500/20 text-green-400 font-bold">
                        {row.wins}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-500/20 text-red-400 font-bold">
                        {row.losses}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-500/20 text-slate-400 font-bold">
                        {row.ties}
                      </span>
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
