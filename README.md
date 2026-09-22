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

## Weekly newsletter

Side quests include the highest-scoring completed waiver or free-agent addition from that Sleeper week. The player must appear on the acquiring manager's weekly roster with a recorded score; bench players count and scoring ties share the award. Trades and failed claims do not count. Scores use the league's actual scoring, not projections.

The default summaries use the matchup result, leading starter and best higher-scoring direct bench substitution allowed by the league's lineup slots. Counterfactuals are explicitly hindsight, not next-week start recommendations. No injury claims are inferred from scores.

Optional AI commentary:

1. Set `OPENAI_API_KEY` server-side, never in a `NEXT_PUBLIC_` variable. `OPENAI_NEWSLETTER_MODEL` defaults to `gpt-4.1` and must support Responses API web search and structured output.
2. Configure shared Redis storage in production. Development can use the existing in-memory store, which resets on restart.
3. Sign in at `/admin`, select a completed week under Weekly Commentary, and choose **Generate AI copy**. This sends manager display names, starter names, scores and factual summaries to OpenAI and incurs model/web-search costs.
4. Review the newsletter and its source links. The model is instructed to use reporting from the exact NFL season/week and omit unverified injury context. Source URLs must have been retrieved by the search tool, but automated checks cannot guarantee every claim is correct. **Use factual copy** removes the saved AI copy; generating again then incurs another API call.

Ordinary newsletter views never call OpenAI. Generated copy is cached by season, week and a fingerprint of the underlying facts; unchanged generation requests reuse it. Score/lineup corrections invalidate old copy automatically. Missing configuration, search failures or rejected output leave the factual summaries available. Upcoming weeks must be generated after Sleeper marks them completed; there is no scheduled background generation.

Run `npm run test:newsletter` for the scoring, source-validation and mocked generation/cache regression tests. These tests do not call OpenAI.

Commentary diagnostics are structured server logs with `scope: "newsletter.commentary"`. After deploying, filter Vercel runtime logs by the `requestId` shown in the admin failure message. Events cover route/generation start and end, configuration presence, OpenAI status/response ID/output length, JSON parsing, per-roster validation (with matchup IDs), citations, and cache operations (`backend: "redis"` or `"memory"`). Errors include redacted exception stacks and causes via `console.error`; keys, authentication headers/cookies, and raw commentary/source URLs are not intentionally logged. The admin API returns safe `stage` and `reason` fields without exposing provider exception bodies. A validation pass means the existing checks passed, not that every generated claim was independently fact-checked. Diagnostics do not alter prompts, generation settings, acceptance rules, or the factual fallback.

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
