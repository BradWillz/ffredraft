import { redirect } from "next/navigation";
import { SLEEPER_LEAGUE_ID } from "@/lib/config";
import { getLeague } from "@/lib/sleeper";

type SleeperLeague = { settings?: { last_scored_leg?: number } };

export default async function NewsletterPage() {
  const league = await getLeague(SLEEPER_LEAGUE_ID) as SleeperLeague;
  const latestWeek = Math.max(1, Number(league.settings?.last_scored_leg ?? 0));
  redirect(`/newsletter/week/${latestWeek}`);
}