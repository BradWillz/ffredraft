import { redirect } from "next/navigation";
import { DYNASTRY_LEAGUE_ID } from "@/lib/config";
import { getLeague } from "@/lib/sleeper";

type SleeperLeague = { settings?: { last_scored_leg?: number } };

export default async function DynastryNewsletterIndexPage() {
  const league = await getLeague(DYNASTRY_LEAGUE_ID) as SleeperLeague;
  const latestWeek = Math.max(1, Number(league.settings?.last_scored_leg ?? 0));
  redirect(`/dynastry-of-darkness/newsletter/week/${latestWeek}`);
}
