// app/dynastry-of-darkness/draft-analysis/page.tsx

import { DYNASTRY_LEAGUE_ID } from "@/lib/config";
import {
  getLeagueHistory,
  getLeagueDrafts,
  getDraftPicks,
  getLeagueRosters,
  getLeagueUsers,
  getAllPlayers,
} from "@/lib/sleeper";
import { getDisplayName, getRosterUsername } from "@/lib/normalize-username";
import Link from "next/link";
import DraftAnalysisTabs from "./DraftAnalysisTabs";

interface DraftPick {
  pickNumber: number;
  playerId: string;
  playerName: string;
  position: string;
  draftedBy: string;
  draftedByName: string;
  totalPoints: number;
  trueValue: number;
}

interface SeasonDraft {
  season: string;
  draftId: string;
  picks: DraftPick[];
  teamsCount: number;
}

async function getPlayerSeasonStats(
  leagueId: string,
  playerId: string,
  totalWeeks: number
): Promise<number> {
  try {
    let totalPoints = 0;

    // Fetch all matchups for the regular season and sum up player points
    for (let week = 1; week <= totalWeeks; week++) {
      const matchups: any = await fetch(
        `https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`,
        { next: { revalidate: 3600 } }
      ).then((r) => r.json());

      for (const matchup of matchups || []) {
        if (matchup.players_points && matchup.players_points[playerId]) {
          totalPoints += matchup.players_points[playerId];
        }
      }
    }

    return totalPoints;
  } catch (error) {
    console.error(`Error fetching stats for player ${playerId}:`, error);
    return 0;
  }
}

export default async function DraftAnalysisPage() {
  const leagues = await getLeagueHistory(DYNASTRY_LEAGUE_ID);
  const allPlayers = await getAllPlayers();

  const seasonsData: (SeasonDraft | null)[] = await Promise.all(
    leagues.map(async (league: any) => {
      try {
        const [drafts, rosters, users] = await Promise.all([
          getLeagueDrafts(league.league_id),
          getLeagueRosters(league.league_id),
          getLeagueUsers(league.league_id),
        ]);

        const draftsArray = (drafts as any[]) || [];
        if (draftsArray.length === 0) {
          return null;
        }

        // Get the first draft (typically there's only one per season)
        const draft = draftsArray[0];
        const picks = (await getDraftPicks(draft.draft_id)) as any[];
        const teamsCount = rosters.length;

        const usersById = new Map(
          (users as any[]).map((u: any) => [u.user_id, u])
        );

        // Create roster to user mapping
        const rosterToUser = new Map();
        for (const roster of rosters as any[]) {
          rosterToUser.set(roster.roster_id, roster.owner_id);
        }

        // Get the number of regular season weeks
        const regularSeasonWeeks =
          (league.settings?.playoff_week_start ?? 15) - 1;

        // Process each draft pick and get their season stats
        const draftPicks: DraftPick[] = await Promise.all(
          picks.map(async (pick: any) => {
            const player = allPlayers[pick.player_id];
            const playerName = player
              ? player.full_name ||
                `${player.first_name || ""} ${player.last_name || ""}`.trim() ||
                pick.player_id
              : pick.player_id;
            const position = player?.position || "UNKNOWN";

            const userId = rosterToUser.get(pick.roster_id);
            const user = usersById.get(userId);
            const mappedUsername = getRosterUsername(
              league.league_id,
              pick.roster_id
            );
            const username =
              mappedUsername ||
              user?.username ||
              user?.display_name ||
              user?.user_id ||
              `Team ${pick.roster_id}`;
            const displayName = getDisplayName(username);

            // Get total points for this player during the season
            const totalPoints = await getPlayerSeasonStats(
              league.league_id,
              pick.player_id,
              regularSeasonWeeks
            );

            return {
              pickNumber: pick.pick_no,
              playerId: pick.player_id,
              playerName,
              position,
              draftedBy: username,
              draftedByName: displayName,
              totalPoints,
              trueValue: 0, // Will be calculated after sorting
            };
          })
        );

        // Sort by total points to determine true value
        const sortedByPoints = [...draftPicks].sort(
          (a, b) => b.totalPoints - a.totalPoints
        );

        // Assign true value positions
        sortedByPoints.forEach((pick, index) => {
          const originalPick = draftPicks.find(
            (p) => p.playerId === pick.playerId
          );
          if (originalPick) {
            originalPick.trueValue = index + 1;
          }
        });

        return {
          season: league.season,
          draftId: draft.draft_id,
          picks: draftPicks.sort((a, b) => a.pickNumber - b.pickNumber),
          teamsCount,
        };
      } catch (error) {
        console.error(
          `Error processing draft for season ${league.season}:`,
          error
        );
        return null;
      }
    })
  );

  const validSeasons = seasonsData.filter(
    (s): s is SeasonDraft => s !== null
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-800 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Home Button */}
        <div className="mb-4 sm:mb-6">
          <Link
            href="/dynastry-of-darkness"
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-800/30 hover:bg-purple-700/40 text-purple-200 rounded-lg transition-all duration-200 backdrop-blur-sm border border-purple-700/50"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8 sm:mb-12 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
            📊 Draft Analysis
          </h1>
          <p className="text-purple-200 text-sm sm:text-base md:text-lg">
            Where players were drafted vs. where they should have been
          </p>
        </div>

        {/* Season Tabs */}
        <DraftAnalysisTabs seasonsData={validSeasons} />
      </div>
    </main>
  );
}
