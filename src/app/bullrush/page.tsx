import Link from "next/link";

export default function BullrushPage() {
  const pages = [
    {
      title: "Standings",
      description: "Current season standings and team records",
      href: "/bullrush/standings",
      icon: "🏈",
      color: "from-blue-600 to-blue-500"
    },
    {
      title: "Head-to-Head Records",
      description: "All-time win/loss records between teams",
      href: "/bullrush/head-to-head",
      icon: "🤝",
      color: "from-purple-600 to-purple-500"
    },
    {
      title: "Weekly High Scores",
      description: "Top 20 single-week team performances",
      href: "/bullrush/weekly-high-scores",
      icon: "📈",
      color: "from-green-600 to-green-500"
    },
    {
      title: "Player High Scores",
      description: "Best individual player performances",
      href: "/bullrush/player-high-scores",
      icon: "💥",
      color: "from-red-600 to-red-500"
    },
    {
      title: "League History",
      description: "All-time points for & against",
      href: "/bullrush/league-history",
      icon: "📚",
      color: "from-yellow-600 to-yellow-500"
    },
    {
      title: "Champion's Corner",
      description: "Hall of fame trophy cabinet",
      href: "/bullrush/history",
      icon: "🏆",
      color: "from-orange-600 to-orange-500"
    },
    {
      title: "Draft Analysis",
      description: "Draft board and performance analysis",
      href: "/bullrush/draft-analysis",
      icon: "📊",
      color: "from-teal-600 to-teal-500"
    }
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-red-800 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 sm:mb-12 text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Link 
              href="/" 
              className="text-white/70 hover:text-white transition-colors text-sm sm:text-base"
            >
              ← Back to Leagues
            </Link>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3 sm:mb-4">
            🐂 BULLRUSH
          </h1>
          <p className="text-white/70 text-sm sm:text-base md:text-lg lg:text-xl">
            Built with love
          </p>
        </div>

        {/* Navigation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {pages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="group bg-red-800/30 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-2xl border border-red-600/30 overflow-hidden hover:border-red-500 transition-all duration-300 hover:scale-105"
            >
              <div className={`bg-gradient-to-r ${page.color} px-4 sm:px-6 py-3 sm:py-4`}>
                <div className="text-3xl sm:text-4xl mb-1 sm:mb-2">{page.icon}</div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">{page.title}</h2>
              </div>
              <div className="p-4 sm:p-6">
                <p className="text-red-200 text-sm sm:text-base">{page.description}</p>
                <div className="mt-3 sm:mt-4 flex items-center text-red-300 font-semibold group-hover:text-red-200 text-sm sm:text-base">
                  View Details
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
