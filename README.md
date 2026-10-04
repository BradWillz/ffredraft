This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Commissioner tools

The wheel and duck pages are public and read-only. Commissioner controls are available at `/admin` after signing in. Ladbrokes uses commissioner-generated, per-owner access codes; picks are stored privately by Sleeper week while the public lock-status board shows only who has submitted.

Copy `.env.example` to `.env.local` and set `ADMIN_PASSWORD`. For shared persistent state, create an Upstash Redis integration in the Vercel Marketplace and provide `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Without Redis, development uses process-local memory that resets when the server restarts.

Set the same variables in the Vercel project's Environment Variables settings before deploying. Do not commit their values.

## Dynasty trade grades

The dynasty trade history includes each manager's outgoing assets, an A–F at-trade grade, a conditional future grade/range, component explanations and manager-specific best-grade sorting. Trades without adequate data show **Not rated**, never an invented valuation.

There is no verified documented public KeepTradeCut API integrated here. Use only valuation data you are authorised to reuse. This model is not a reproduction of KTC's calculator: package market values are additive, with no proprietary consolidation/value-adjustment formula.

Set `DYNASTY_TRADE_SNAPSHOTS_PATH` to a server-readable JSON file containing an array of trade snapshots. On Windows use an absolute Windows path. Deploy the file privately with the server and configure its path; do not put credentials or private files in `public`. Without configuration the ledger remains usable and every trade is unrated. Malformed/unreadable files produce a visible warning and server error log. Snapshots are read on page requests, so replacing the file updates grades without changing code.

Each snapshot must match a Sleeper league/transaction ID and contain valuations, standings rank and rosters **immediately before that trade**. `asOf` must be an ISO timestamp no later than the trade and at most seven days earlier. This prevents using today's rosters or known rookie outcomes as if they were available at the time. The actual historical league's starter slots and team count must match. Only QB, RB, WR, TE, FLEX, SUPER_FLEX, WRRB_FLEX and REC_FLEX are supported; omit BN/IR. Unsupported configurations remain unrated.

Illustrative structure (fictional data, not an actual league valuation):

```json
[
  {
    "tradeId": "SLEEPER_TRANSACTION_ID",
    "leagueId": "SLEEPER_LEAGUE_ID",
    "asOf": "2026-10-01T11:00:00Z",
    "source": "Authorised provider, dataset/version",
    "futureHorizon": "End of the 2027 season",
    "format": "1qb",
    "slots": ["QB", "RB", "WR", "TE", "FLEX"],
    "teamCount": 12,
    "faabValuePerDollar": 1,
    "teams": [
      { "rosterId": 1, "rank": 2, "playersBefore": ["PLAYER_ID"] }
    ],
    "assets": {
      "player:PLAYER_ID": {
        "value": 5000,
        "starterValue": 4000,
        "position": "WR",
        "futureLow": 2000,
        "futureHigh": 6500,
        "downside": "the player loses their starting role",
        "upside": "the player maintains elite production"
      },
      "pick:2027:1:3": {
        "value": 4500,
        "starterValue": 0,
        "futureLow": 2500,
        "futureHigh": 7000,
        "downside": "original roster 3 earns a late pick and the class disappoints",
        "upside": "original roster 3 earns 1.01 and the top prospect breaks out"
      }
    }
  }
]
```

Supply a team entry for every participant, all players on each participant's pre-trade roster (including bench), and every transferred player/pick. Player keys use Sleeper player IDs; pick keys use **draft year:round:original roster ID**, not the recipient. Thus a third team's pick in a multi-way trade retains its provenance. Player positions describe snapshot-time eligibility, not today's metadata. This version supports one primary position per player; leagues using multi-position eligibility need an extended model. `format` must be `superflex` when `SUPER_FLEX` is present, otherwise `1qb`. Use the exact league slots, not the shortened example above.

All market and future values must use a consistent scale. `starterValue` is a nonnegative, comparable near-term contribution estimate, **not necessarily the market value**; supply a separate projection-derived estimate where available. Pick starter contribution is zero. `faabValuePerDollar` explicitly prices FAAB on the market-value scale (zero is allowed as an intentional exclusion). Supply future bounds at a consistent horizon, such as the end of the pick's rookie season, across all assets in that trade. Bounds should include the original team's possible draft slots and class/prospect quality, with dated research in the source dataset. No prospect research, draft order prediction or historical roster reconstruction is performed automatically.

Scoring:

- Each relative change is `(after - before) / max(before, after)`; both zero means no change. For the market component, before/after are outgoing/incoming package values.
- The starter component uses the maximum-value legal lineup. Depth is the sum of remaining player contribution values after allocating that lineup.
- At-trade score is `50 + 50 × weighted change`, clamped to 0–100. Market / starters / depth weights are 55/35/10 for the top third of standings, 65/25/10 for the middle third and 80/10/10 for the bottom third. Rank is an explicit strategy proxy; it does not establish the manager's actual intent.
- A ≥80, B ≥65, C ≥45, D ≥30, F <30. Neutral trades start at C/50. Gross overpayments can be F even if they add a starter.
- Future grades use **market value only**, not an invented future roster. Base case uses midpoint values; upside uses incoming highs against outgoing lows, downside the reverse. These are conditional extremes, not joint probability forecasts. A pick's eventual selection is shown separately as hindsight and does not affect the at-trade grade.

Run `npm run test:trades` for grading thresholds, roster fit, multi-party outgoing ownership, pick provenance, conditional F-to-A outcomes and input validation.

## Weekly newsletter

Side quests include the highest-scoring completed waiver or free-agent addition from that Sleeper week. The player must appear on the acquiring manager's weekly roster with a recorded score; bench players count and scoring ties share the award. Trades and failed claims do not count. Scores use the league's actual scoring, not projections.

The default summaries use the matchup result, leading starter and best higher-scoring direct bench substitution allowed by the league's lineup slots. Counterfactuals are explicitly hindsight, not next-week start recommendations. No injury claims are inferred from scores.

Optional AI commentary:

1. Set `OPENAI_API_KEY` server-side, never in a `NEXT_PUBLIC_` variable. `OPENAI_NEWSLETTER_MODEL` defaults to `gpt-4.1` and must support Responses API web search and structured output.
2. Configure shared Redis storage in production. Development can use the existing in-memory store, which resets on restart.
3. Sign in at `/admin`, select a completed week under Weekly Commentary, and choose **Generate AI copy**. The server fetches the selected league's week and roster details from Sleeper, calculates the ranking facts, then sends all managers together with results, scores, leading scorers, legal swap gains/outcomes, bench points, lineup efficiency, rankings/movement and next opponents. The model writes from those supplied facts; it does not call Sleeper itself. This incurs model costs and optional web-search costs.
4. Review the newsletter. OpenAI is the writer, not the calculator: it must preserve the supplied numbers and vary its jokes, sentence structure and next-opponent advice across the league. Optional injury research must relate to the exact season/week; uncertain, missing or contradictory information is omitted. No URLs, citation indexes or source lists are requested, displayed or validated. Missing injury context does not invalidate copy. **Use factual copy** removes saved AI copy; generating again then incurs another API call.

Ordinary newsletter views never call OpenAI. Generated copy is cached by format version, season, week and a fingerprint of the underlying facts; unchanged generation requests reuse it. Prompt changes invalidate prior generated copy by advancing the format version. Score/lineup corrections invalidate old copy automatically. API failures, missing configuration or malformed/incomplete JSON leave the factual summaries available. Upcoming weeks must be generated after Sleeper marks them completed; there is no scheduled background generation.

Run `npm run test:newsletter` for the scoring, authoritative request payload, source-free output and mocked generation/cache regression tests. These tests do not call OpenAI.

Commentary diagnostics are structured server logs with `scope: "newsletter.commentary"`. After deploying, filter Vercel runtime logs by the `requestId` shown in the admin failure message. Events cover route/generation start and end, configuration presence, OpenAI status/response ID/output length, JSON parsing, per-roster identity/text validation (with matchup IDs), and cache operations (`backend: "redis"` or `"memory"`). Errors include redacted exception stacks and causes via `console.error`; keys, authentication headers/cookies, and raw commentary are not intentionally logged. The admin API returns safe `stage` and `reason` fields without exposing provider exception bodies. Validation checks roster completeness, uniqueness and text shape/length, not the truth of every sentence: factual fidelity and conservative injury handling are model instructions, not a guarantee. The application's scores, rankings and calculations are never modified by AI output.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
