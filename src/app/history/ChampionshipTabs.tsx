"use client";

import { useState } from "react";

type HistoryItem = {
  season: string;
  leagueName: string;
  championName: string;
  lastPlaceName: string;
};

interface ChampionshipTabsProps {
  history: HistoryItem[];
}

export default function ChampionshipTabs({ history }: ChampionshipTabsProps) {
  const [selectedTab, setSelectedTab] = useState<"championship" | "poopBowl">("championship");

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Tabs */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
        <div className="flex">
          <button
            onClick={() => setSelectedTab("championship")}
            className={`flex-1 px-4 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-bold transition-all duration-200 ${
              selectedTab === "championship"
                ? "bg-gradient-to-r from-yellow-600 to-yellow-500 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-700/30"
            }`}
          >
            🏆 Championship
          </button>
          <button
            onClick={() => setSelectedTab("poopBowl")}
            className={`flex-1 px-4 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-bold transition-all duration-200 ${
              selectedTab === "poopBowl"
                ? "bg-gradient-to-r from-amber-700 to-amber-600 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-700/30"
            }`}
          >
            💩 Poop Bowl
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-2xl border border-slate-700 overflow-hidden p-4 sm:p-6 md:p-8">
        <div className="space-y-3 sm:space-y-4">
          {history.map((item) => (
            <div 
              key={item.season} 
              className="bg-slate-900/50 rounded-lg sm:rounded-xl p-4 sm:p-6 border border-slate-700 hover:border-blue-500/50 transition-all duration-200"
            >
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                <span className={`inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full font-bold text-lg sm:text-xl ${
                  selectedTab === "championship"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-amber-700/20 text-amber-400"
                }`}>
                  {item.season}
                </span>
                <div className="flex-1 min-w-[200px]">
                  <h3 className="text-base sm:text-xl font-bold text-white">{item.leagueName}</h3>
                  <p className="text-slate-400 text-xs sm:text-base">
                    {selectedTab === "championship" ? "Season Champion" : "Last Place"}
                  </p>
                </div>
                <div className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg border min-w-[120px] sm:min-w-[140px] text-center ${
                  selectedTab === "championship"
                    ? "bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-yellow-500/30"
                    : "bg-gradient-to-r from-amber-700/20 to-amber-600/20 border-amber-600/30"
                }`}>
                  <span className={`text-sm sm:text-lg font-bold ${
                    selectedTab === "championship" ? "text-yellow-400" : "text-amber-400"
                  }`}>
                    {selectedTab === "championship" ? `👑 ${item.championName}` : `💩 ${item.lastPlaceName}`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
