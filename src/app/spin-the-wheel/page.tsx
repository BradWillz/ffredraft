'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import WheelSpinner, { WHEEL_COLORS } from './WheelSpinner';

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

export default function SpinTheWheelPage() {
  const [currentWeek, setCurrentWeek] = useState(1);
  const [availableScenarios, setAvailableScenarios] = useState<string[]>(SCENARIOS);
  const [weekResults, setWeekResults] = useState<WeekResult[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Load saved data from localStorage
    const savedWeek = localStorage.getItem('wheelCurrentWeek');
    const savedScenarios = localStorage.getItem('wheelAvailableScenarios');
    const savedResults = localStorage.getItem('wheelResults');

    if (savedWeek) setCurrentWeek(parseInt(savedWeek));
    if (savedScenarios) setAvailableScenarios(JSON.parse(savedScenarios));
    if (savedResults) setWeekResults(JSON.parse(savedResults));
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
      setAvailableScenarios(SCENARIOS);
      setWeekResults([]);
      localStorage.removeItem('wheelCurrentWeek');
      localStorage.removeItem('wheelAvailableScenarios');
      localStorage.removeItem('wheelResults');
    }
  };

  const handleNextWeek = () => {
    const newWeek = currentWeek + 1;
    setCurrentWeek(newWeek);
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
              {weekResults.slice().reverse().map((result) => (
                <div 
                  key={result.week}
                  className="bg-white/5 rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-2"
                >
                  <div>
                    <div className="text-white/70 text-xs sm:text-sm">Week {result.week}</div>
                    <div className="text-white font-semibold text-sm sm:text-base">{result.scenario}</div>
                  </div>
                  <div className="text-white/50 text-xs sm:text-sm">
                    {new Date(result.date).toLocaleDateString()}
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
