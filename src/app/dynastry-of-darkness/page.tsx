import LeagueHub from "@/components/LeagueHub";

export default function DynastryOfDarknessPage() {
  const pages = [
    {
      title: "Standings",
      description: "Current season standings and team records",
      href: "/dynastry-of-darkness/standings",
      label: "Current form",
    },
    {
      title: "Head-to-Head Records",
      description: "All-time win/loss records between teams",
      href: "/dynastry-of-darkness/head-to-head",
      label: "Rivalries",
    },
    {
      title: "Weekly High Scores",
      description: "Top 20 single-week team performances",
      href: "/dynastry-of-darkness/weekly-high-scores",
      label: "Scoreboard",
    },
    {
      title: "Player High Scores",
      description: "Best individual player performances",
      href: "/dynastry-of-darkness/player-high-scores",
      label: "Game breakers",
    },
    {
      title: "League History",
      description: "All-time points for & against",
      href: "/dynastry-of-darkness/league-history",
      label: "The archive",
    },
    {
      title: "Champion's Corner",
      description: "Hall of fame trophy cabinet",
      href: "/dynastry-of-darkness/history",
      label: "Champions",
    },
    {
      title: "Draft Analysis",
      description: "Draft board and performance analysis",
      href: "/dynastry-of-darkness/draft-analysis",
      label: "War room",
    }
  ];

  return <LeagueHub name="Dynastry Of Darkness" format="Wrestling Dynasty League" monogram="DOD" tone="dynasty" statement="Build the stable. Cut the promo. Take the belt and defend the dynasty for years." features={pages} />;
}
