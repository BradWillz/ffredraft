"use client";

import { useState } from "react";

type HistoryItem = {
  season: string;
  leagueName: string;
  championName: string;
  lastPlaceName: string;
  championshipLineup?: Array<{ name: string; position: string }> | null;
  lastPlaceLineup?: Array<{ name: string; position: string }> | null;
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
            🏆 Champions
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

      {/* Trophy Cabinet */}
      {selectedTab === "championship" ? (
        <div className="relative">
          {/* Cabinet Background with Wood Texture */}
          <div className="bg-gradient-to-br from-amber-800 via-amber-900 to-amber-950 rounded-xl sm:rounded-2xl shadow-2xl border-4 border-amber-950 p-2 sm:p-3 md:p-4">
            {/* Cabinet Inner Shadow */}
            <div className="bg-gradient-to-b from-amber-950/20 to-transparent rounded-lg p-2 sm:p-3">
              
              {/* Trophy Shelves */}
              <div className="space-y-3 sm:space-y-4 md:space-y-5">
                {history.map((item, index) => (
                  <div key={item.season}>
                    {/* Shelf */}
                    <div className="relative">
                      {/* Shelf Shadow/Depth */}
                      <div className="absolute inset-0 bg-gradient-to-b from-amber-950/40 to-amber-950/10 rounded-t-lg transform translate-y-1" />
                      
                      {/* Shelf Surface */}
                      <div className="relative bg-gradient-to-b from-amber-700 via-amber-800 to-amber-900 rounded-lg border-t-2 border-amber-600 border-b-4 border-b-amber-950 shadow-xl">
                        {/* Wood Grain Effect */}
                        <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-transparent via-amber-950 to-transparent" style={{
                          backgroundSize: '100px 100%',
                          backgroundRepeat: 'repeat-x'
                        }} />
                        
                        {/* Trophy Display */}
                        <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 md:gap-8 p-4 sm:p-6 md:p-8 min-h-[300px] sm:min-h-[400px] md:min-h-[500px]">
                          {/* Plaque - Above trophy on mobile, on trophy on desktop */}
                          <div className="sm:hidden mb-4">
                            <div className="relative bg-gradient-to-br from-yellow-600 via-yellow-700 to-yellow-800 rounded-lg px-4 py-2 border-2 border-yellow-500 shadow-lg min-w-[200px]">
                              <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent rounded-lg pointer-events-none" />
                              
                              <div className="relative text-center space-y-1">
                                <div className="text-yellow-950 font-black text-xs tracking-wide">
                                  CHAMPION
                                </div>
                                <div className="text-white font-bold text-lg leading-tight">
                                  👑 {item.championName}
                                </div>
                                <div className="text-yellow-950 font-semibold text-sm border-t border-yellow-800/50 pt-1">
                                  {item.season}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Trophy with Integrated Plaque */}
                          <div className="relative group">
                            {/* Trophy Glow */}
                            <div className="absolute inset-0 bg-yellow-400/20 blur-2xl rounded-full scale-150 group-hover:bg-yellow-400/40 transition-all" />
                            
                            {/* Trophy Emoji */}
                            <div className="relative text-9xl sm:text-[10rem] md:text-[12rem] lg:text-[14rem] transform group-hover:scale-105 transition-transform duration-300 drop-shadow-2xl z-10">
                              🏆
                            </div>
                            
                            {/* Plaque Integrated into Trophy Base - Hidden on mobile */}
                            <div className="hidden sm:block absolute bottom-[1.5%] sm:bottom-[2.5%] md:bottom-[3.5%] left-1/2 -translate-x-1/2 z-20">
                              <div className="relative bg-gradient-to-br from-yellow-600 via-yellow-700 to-yellow-800 rounded px-1.5 py-0.5 sm:px-2 sm:py-1 md:px-3 md:py-1.5 border border-yellow-500 shadow-lg">
                                {/* Plaque Shine */}
                                <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent rounded pointer-events-none" />
                                
                                <div className="relative text-center">
                                  <div className="text-yellow-950 font-black text-[0.35rem] sm:text-[0.4rem] md:text-[0.5rem] tracking-tight leading-tight">
                                    CHAMPION
                                  </div>
                                  <div className="text-white font-bold text-[0.5rem] sm:text-xs md:text-sm leading-tight">
                                    👑 {item.championName}
                                  </div>
                                  <div className="text-yellow-950 font-semibold text-[0.4rem] sm:text-[0.5rem] md:text-[0.65rem] border-t border-yellow-800/50 mt-0.5">
                                    {item.season}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Championship Lineup */}
                          {item.championshipLineup && item.championshipLineup.length > 0 && (
                            <div className="bg-slate-800/60 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-slate-700 shadow-xl max-w-xs">
                              <h4 className="text-yellow-400 font-bold text-sm sm:text-base mb-2 text-center border-b border-yellow-500/30 pb-2">
                                🏈 Winning Lineup
                              </h4>
                              <div className="space-y-1 max-h-[280px] sm:max-h-[340px] overflow-y-auto">
                                {item.championshipLineup.map((player, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs sm:text-sm py-1 px-2 rounded hover:bg-slate-700/50 transition-colors">
                                    <span className="text-slate-300 truncate flex-1">{player.name}</span>
                                    <span className="text-yellow-400 font-semibold ml-2 text-[0.65rem] sm:text-xs">{player.position}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Shelf Front Edge */}
                      <div className="h-2 bg-gradient-to-b from-amber-800 to-amber-950 rounded-b-sm shadow-md" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Poop Bowl Cabinet */
        <div className="relative">
          {/* Cabinet Background with Wood Texture */}
          <div className="bg-gradient-to-br from-amber-800 via-amber-900 to-amber-950 rounded-xl sm:rounded-2xl shadow-2xl border-4 border-amber-950 p-2 sm:p-3 md:p-4">
            {/* Cabinet Inner Shadow */}
            <div className="bg-gradient-to-b from-amber-950/20 to-transparent rounded-lg p-2 sm:p-3">
              
              {/* Toilet Shelves */}
              <div className="space-y-3 sm:space-y-4 md:space-y-5">
                {history.map((item, index) => (
                  <div key={item.season}>
                    {/* Shelf */}
                    <div className="relative">
                      {/* Shelf Shadow/Depth */}
                      <div className="absolute inset-0 bg-gradient-to-b from-amber-950/40 to-amber-950/10 rounded-t-lg transform translate-y-1" />
                      
                      {/* Shelf Surface */}
                      <div className="relative bg-gradient-to-b from-amber-700 via-amber-800 to-amber-900 rounded-lg border-t-2 border-amber-600 border-b-4 border-b-amber-950 shadow-xl">
                        {/* Wood Grain Effect */}
                        <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-transparent via-amber-950 to-transparent" style={{
                          backgroundSize: '100px 100%',
                          backgroundRepeat: 'repeat-x'
                        }} />
                        
                        {/* Toilet Display */}
                        <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 md:gap-8 p-4 sm:p-6 md:p-8 min-h-[300px] sm:min-h-[400px] md:min-h-[500px]">
                          {/* Plaque - Above toilet on mobile, on toilet on desktop */}
                          <div className="sm:hidden mb-4">
                            <div className="relative bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500 rounded-lg px-4 py-2 border-2 border-slate-300 shadow-lg min-w-[200px]">
                              <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent rounded-lg pointer-events-none" />
                              
                              <div className="relative text-center space-y-1">
                                <div className="text-slate-800 font-black text-xs tracking-wide">
                                  LAST PLACE
                                </div>
                                <div className="text-slate-900 font-bold text-lg leading-tight">
                                  💩 {item.lastPlaceName}
                                </div>
                                <div className="text-slate-800 font-semibold text-sm border-t border-slate-600/50 pt-1">
                                  {item.season}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Toilet with Integrated Plaque */}
                          <div className="relative group">
                            {/* Toilet Glow */}
                            <div className="absolute inset-0 bg-amber-600/20 blur-2xl rounded-full scale-150 group-hover:bg-amber-600/40 transition-all" />
                            
                            {/* Toilet Emoji */}
                            <div className="relative text-9xl sm:text-[10rem] md:text-[12rem] lg:text-[14rem] transform group-hover:scale-105 transition-transform duration-300 drop-shadow-2xl z-10">
                              🚽
                            </div>
                            
                            {/* Plaque Integrated into Toilet Base - Hidden on mobile */}
                            <div className="hidden sm:block absolute bottom-[1.5%] sm:bottom-[2.5%] md:bottom-[3.5%] left-1/2 -translate-x-1/2 z-20">
                              <div className="relative bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500 rounded px-1.5 py-0.5 sm:px-2 sm:py-1 md:px-3 md:py-1.5 border border-slate-300 shadow-lg">
                                {/* Plaque Shine */}
                                <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent rounded pointer-events-none" />
                                
                                <div className="relative text-center">
                                  <div className="text-slate-800 font-black text-[0.35rem] sm:text-[0.4rem] md:text-[0.5rem] tracking-tight leading-tight">
                                    LAST PLACE
                                  </div>
                                  <div className="text-slate-900 font-bold text-[0.5rem] sm:text-xs md:text-sm leading-tight">
                                    💩 {item.lastPlaceName}
                                  </div>
                                  <div className="text-slate-800 font-semibold text-[0.4rem] sm:text-[0.5rem] md:text-[0.65rem] border-t border-slate-600/50 mt-0.5">
                                    {item.season}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Last Place Lineup */}
                          {item.lastPlaceLineup && item.lastPlaceLineup.length > 0 && (
                            <div className="bg-slate-800/60 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-slate-700 shadow-xl max-w-xs">
                              <h4 className="text-amber-400 font-bold text-sm sm:text-base mb-2 text-center border-b border-amber-500/30 pb-2">
                                💩 Losing Lineup
                              </h4>
                              <div className="space-y-1 max-h-[280px] sm:max-h-[340px] overflow-y-auto">
                                {item.lastPlaceLineup.map((player, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs sm:text-sm py-1 px-2 rounded hover:bg-slate-700/50 transition-colors">
                                    <span className="text-slate-300 truncate flex-1">{player.name}</span>
                                    <span className="text-amber-400 font-semibold ml-2 text-[0.65rem] sm:text-xs">{player.position}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Shelf Front Edge */}
                      <div className="h-2 bg-gradient-to-b from-amber-800 to-amber-950 rounded-b-sm shadow-md" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
