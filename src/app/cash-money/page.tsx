'use client';

import { useEffect, useState } from 'react';
import HomeButton from '@/components/HomeButton';
import { SLEEPER_LEAGUE_ID } from '@/lib/config';
import { getDisplayName } from '@/lib/normalize-username';
import { getLeagueMatchups, getLeagueRosters, getLeagueUsers } from '@/lib/sleeper';

type WeeklyWinner = {
  week: number;
  winner: string;
};

type Prize = {
  id: string;
  title: string;
  amount: string;
  weeklyAmount?: string;
  note?: string;
  description: string;
  icon: string;
  accent: string;
  isWeekly?: boolean;
  weeklyWinners?: WeeklyWinner[];
};

const buildWeeklyWinners = (weeks: number, fallback = 'TBD'): WeeklyWinner[] =>
  Array.from({ length: weeks }, (_, index) => ({
    week: index + 1,
    winner: fallback,
  }));

const starterPrizes: Prize[] = [
  {
    id: 'last-man-standing',
    title: 'Last Man Standing',
    amount: '£200',
    description: 'The final survivor of the season takes the crown.',
    icon: '🛡️',
    accent: 'from-amber-400 to-orange-500',
  },
  {
    id: 'wheel',
    title: 'Wheel of Fortune',
    amount: '£70',
    weeklyAmount: '£5 a week',
    description: 'Weekly payout for the wheel winner each week.',
    icon: '🎲',
    accent: 'from-fuchsia-500 to-purple-600',
    isWeekly: true,
    weeklyWinners: buildWeeklyWinners(14),
  },
  {
    id: 'highest-points',
    title: 'Highest Points Scored',
    amount: '£70',
    weeklyAmount: '£5 a week',
    description: 'The highest scorer of the week pockets the cash.',
    icon: '📈',
    accent: 'from-cyan-500 to-sky-600',
    isWeekly: true,
    weeklyWinners: buildWeeklyWinners(14),
  },
  {
    id: 'ladbrokes',
    title: 'Ladbrokes',
    amount: '£70',
    weeklyAmount: '£5 a week',
    note: 'Was £140, -£70',
    description: 'A weekly payout with a little extra history attached.',
    icon: '🎰',
    accent: 'from-emerald-500 to-green-600',
    isWeekly: true,
    weeklyWinners: buildWeeklyWinners(14),
  },
  {
    id: 'the-power',
    title: 'The Power',
    amount: '£100',
    description: 'A season-long bonus for the team who holds the power.',
    icon: '⚡',
    accent: 'from-violet-500 to-indigo-600',
  },
  {
    id: 'champ-champ',
    title: 'Champ Champ',
    amount: '£810',
    description: 'The big one. The title-winning prize on the board.',
    icon: '🏆',
    accent: 'from-rose-500 to-pink-600',
  },
];

export default function CashMoneyPage() {
  const [selectedPrizeId, setSelectedPrizeId] = useState('wheel');
  const [prizes, setPrizes] = useState<Prize[]>(starterPrizes);
  const [loadingWeeklyResults, setLoadingWeeklyResults] = useState(true);

  useEffect(() => {
    const loadHighestPointsWinners = async () => {
      setLoadingWeeklyResults(true);

      try {
        const [users, rosters] = await Promise.all([
          getLeagueUsers(SLEEPER_LEAGUE_ID),
          getLeagueRosters(SLEEPER_LEAGUE_ID),
        ]);

        const userMap = new Map((users as any[]).map((user: any) => [user.user_id, user]));
        const rosterMap = new Map((rosters as any[]).map((roster: any) => [roster.roster_id, roster]));

        const winners: WeeklyWinner[] = [];

        for (let week = 1; week <= 14; week += 1) {
          const matchups = (await getLeagueMatchups(SLEEPER_LEAGUE_ID, week)) as any[];
          const highest = matchups.reduce<{ roster_id: number; points: number } | null>((best, matchup) => {
            const points = matchup.points ?? 0;
            if (!best || points > best.points) {
              return { roster_id: matchup.roster_id, points };
            }
            return best;
          }, null);

          if (!highest) {
            winners.push({ week, winner: 'TBD' });
            continue;
          }

          const roster = rosterMap.get(highest.roster_id);
          const owner = roster ? userMap.get(roster.owner_id) : null;
          const winnerName = owner
            ? getDisplayName(owner.username || owner.display_name || `Team ${highest.roster_id}`)
            : `Team ${highest.roster_id}`;

          winners.push({ week, winner: winnerName });
        }

        setPrizes((currentPrizes) =>
          currentPrizes.map((prize) =>
            prize.id === 'highest-points'
              ? { ...prize, weeklyWinners: winners }
              : prize
          )
        );
      } catch (error) {
        console.error('Failed to load weekly prize winners', error);
      } finally {
        setLoadingWeeklyResults(false);
      }
    };

    loadHighestPointsWinners();
  }, []);

  const selectedPrize = prizes.find((prize) => prize.id === selectedPrizeId) ?? prizes[0];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(250,204,21,0.22),_transparent_30%),linear-gradient(135deg,_#020617_0%,_#111827_55%,_#1f2937_100%)] p-4 sm:p-6 md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div>
          <HomeButton />
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-amber-400/30 bg-slate-900/70 shadow-2xl backdrop-blur">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
            <div className="flex flex-col justify-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.35em] text-amber-300">
                Seasonal prize board
              </p>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                💸 CASH MONEY
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                A slick, mobile-first prize page built for quick scanning on the phone and a clean layout on desktop. Weekly payouts are interactive and ready for you to update as the season rolls on.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  <span className="block text-xs uppercase tracking-[0.3em] text-amber-300/80">
                    Prize pool
                  </span>
                  £1,320
                </div>
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                  <span className="block text-xs uppercase tracking-[0.3em] text-cyan-300/80">
                    Weekly detail
                  </span>
                  Tap any weekly payout
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-6 shadow-inner">
              <div className="text-6xl sm:text-7xl">🏆</div>
              <h2 className="mt-4 text-2xl font-semibold text-white">Prize highlights</h2>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                The page is built so you can keep the big prizes front and center while letting the weekly payouts expand into week-by-week results when you need them.
              </p>
              <div className="mt-6 space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-3">
                  <span className="text-slate-400">Sleeper-ready:</span> highest-scoring weeks can be pulled from league data automatically.
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-3">
                  <span className="text-slate-400">Easy to update:</span> weekly winners are grouped in one spot so you can edit them quickly.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {prizes.map((prize) => {
            const isSelected = selectedPrize.id === prize.id;

            return (
              <button
                key={prize.id}
                type="button"
                onClick={() => setSelectedPrizeId(prize.id)}
                className={`rounded-[1.5rem] border p-5 text-left transition-all duration-200 ${
                  isSelected
                    ? 'border-amber-400/60 bg-slate-800/90 shadow-lg shadow-amber-500/10'
                    : 'border-slate-700 bg-slate-900/60 hover:border-slate-500 hover:bg-slate-800/70'
                }`}
              >
                <div className={`inline-flex rounded-2xl bg-gradient-to-r ${prize.accent} px-3 py-2 text-2xl`}>
                  {prize.icon}
                </div>
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{prize.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{prize.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-amber-300">{prize.amount}</p>
                    {prize.weeklyAmount ? (
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{prize.weeklyAmount}</p>
                    ) : null}
                  </div>
                </div>
                {prize.note ? <p className="mt-3 text-sm text-slate-500">{prize.note}</p> : null}
              </button>
            );
          })}
        </section>

        <section className="rounded-[1.75rem] border border-slate-700 bg-slate-900/70 p-5 shadow-xl sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
                {selectedPrize.isWeekly ? 'Weekly payout spotlight' : 'Season payout'}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{selectedPrize.title}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-400">{selectedPrize.description}</p>
            </div>
            {selectedPrize.weeklyAmount ? (
              <div className="inline-flex rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200">
                {selectedPrize.weeklyAmount}
              </div>
            ) : null}
          </div>

          {selectedPrize.isWeekly ? (
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Weeks 1–14
                </p>
                {selectedPrize.id === 'highest-points' && loadingWeeklyResults ? (
                  <p className="text-sm text-slate-400">Loading Sleeper results…</p>
                ) : null}
              </div>
              <div className="grid gap-3">
                {(selectedPrize.weeklyWinners ?? []).map((entry) => (
                  <div
                    key={entry.week}
                    className="flex flex-col gap-2 rounded-2xl border border-slate-700 bg-slate-800/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-white">Week {entry.week}</p>
                      <p className="text-sm text-slate-400">{selectedPrize.title} winner</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-semibold text-amber-300">{entry.winner}</p>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                        Update this later as needed
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-800/70 p-4 text-sm leading-7 text-slate-300">
              This payout stays simple and clean as a season-long prize, with no week-by-week expansion needed.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
