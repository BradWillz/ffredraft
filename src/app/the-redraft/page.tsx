import LeagueHub from "@/components/LeagueHub";

export default function TheRedraftPage() {
  const pages = [
    {
      title: "Standings",
      description: "Current season standings and team records",
      href: "/standings",
      label: "Current form",
    },
    {
      title: "Head-to-Head Records",
      description: "All-time win/loss records between teams",
      href: "/head-to-head",
      label: "Rivalries",
    },
    {
      title: "Weekly High Scores",
      description: "Top 20 single-week team performances",
      href: "/weekly-high-scores",
      label: "Scoreboard",
    },
    {
      title: "Player High Scores",
      description: "Best individual player performances",
      href: "/player-high-scores",
      label: "Game breakers",
    },
    {
      title: "League History",
      description: "All-time points for & against",
      href: "/league-history",
      label: "The archive",
    },
    {
      title: "Champion's Corner",
      description: "Hall of fame trophy cabinet",
      href: "/history",
      label: "Champions",
    },
    {
      title: "Draft Analysis",
      description: "Draft board and performance analysis",
      href: "/the-redraft/draft-analysis",
      label: "War room",
    },
    {
      title: "Ladbrokes",
      description: "Bet on this week's matchups",
      href: "/ladbrokes",
      label: "The book",
    },
    {
      title: "Spin the Wheel",
      description: "Weekly winner scenario selector",
      href: "/spin-the-wheel",
      label: "Chaos engine",
    },
    {
      title: "THE POWER",
      description: "Track the rubber duck holder",
      href: "/the-power",
      label: "The curse",
    },
    {
      title: "CASH MONEY",
      description: "Season prize board and weekly payouts",
      href: "/the-redraft/cash-money",
      label: "Payouts",
    }
  ];

  return <LeagueHub name="Left, Down, Wide to the Right, Up" format="PlayStation Redraft" monogram="PS" tone="redraft" statement="Enter the combination. Set the lineup. No continues when the waiver wire runs dry." features={pages} />;
}
