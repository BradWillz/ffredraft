import LeagueHub from "@/components/LeagueHub";

export default function BullrushPage() {
  const pages = [
    {
      title: "Standings",
      description: "Current season standings and team records",
      href: "/bullrush/standings",
      label: "Current form",
    },
    {
      title: "Head-to-Head Records",
      description: "All-time win/loss records between teams",
      href: "/bullrush/head-to-head",
      label: "Rivalries",
    },
    {
      title: "Weekly High Scores",
      description: "Top 20 single-week team performances",
      href: "/bullrush/weekly-high-scores",
      label: "Scoreboard",
    },
    {
      title: "Player High Scores",
      description: "Best individual player performances",
      href: "/bullrush/player-high-scores",
      label: "Game breakers",
    },
    {
      title: "League History",
      description: "All-time points for & against",
      href: "/bullrush/league-history",
      label: "The archive",
    },
    {
      title: "Champion's Corner",
      description: "Hall of fame trophy cabinet",
      href: "/bullrush/history",
      label: "Champions",
    },
    {
      title: "Draft Analysis",
      description: "Draft board and performance analysis",
      href: "/bullrush/draft-analysis",
      label: "War room",
    }
  ];

  return <LeagueHub name="Bullrush" format="Survivor League" monogram="B" tone="bullrush" statement="Survive the slate. Take the hit. Keep moving when everyone else folds." features={pages} />;
}
