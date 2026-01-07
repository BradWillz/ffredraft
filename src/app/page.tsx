'use client';

import Link from "next/link";

export default function Home() {
  const leagues = [
    {
      title: "The Redraft",
      description: "Your main redraft fantasy league",
      href: "/the-redraft",
      icon: "🏈",
      color: "from-blue-600 to-indigo-600"
    },
    {
      title: "Dynastry of Darkness",
      description: "Your dynasty fantasy league",
      href: "/dynastry-of-darkness",
      icon: "👑",
      color: "from-purple-600 to-pink-600"
    },
    {
      title: "BULLRUSH",
      description: "Your BULLRUSH league",
      href: "/bullrush",
      icon: "🐂",
      color: "from-red-600 to-orange-600"
    }
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6 md:p-8 flex items-center justify-center">
      <div className="max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="mb-12 sm:mb-16 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4 sm:mb-6">
            🏈 Fantasy Football
          </h1>
          <p className="text-slate-400 text-base sm:text-lg md:text-xl lg:text-2xl">
            Select Your League
          </p>
        </div>

        {/* League Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {leagues.map((league) => (
            <Link
              key={league.href}
              href={league.href}
              className="group bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700 overflow-hidden hover:border-slate-500 transition-all duration-300 hover:scale-105"
            >
              <div className={`bg-gradient-to-r ${league.color} px-6 py-8 text-center`}>
                <div className="text-6xl mb-4">{league.icon}</div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white">{league.title}</h2>
              </div>
              <div className="p-6 text-center">
                <p className="text-slate-300 text-base">{league.description}</p>
                <div className="mt-4 flex items-center justify-center text-blue-400 font-semibold group-hover:text-blue-300">
                  Enter League
                  <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
