"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { TradeAsset, TradeRecord, TradeSeason } from "@/lib/trade-history";
import type { SideGrade, TradeAssessment } from "@/lib/trade-grading";
import styles from "./trade-history.module.css";

function ordinal(round: number) {
  return `${round}${round === 1 ? "st" : round === 2 ? "nd" : round === 3 ? "rd" : "th"}`;
}

function tradeWhen(trade: TradeRecord) {
  const date = new Date(trade.timestamp);
  const month = date.getUTCMonth();
  const offseason = trade.week <= 1 && month >= 1 && month <= 7;
  return {
    date: date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
    label: offseason ? "Offseason" : `Week ${Math.max(1, trade.week)}`,
  };
}

function assetText(asset: TradeAsset) {
  if (asset.kind === "player") return `${asset.name} ${asset.position} ${asset.team}`;
  if (asset.kind === "faab") return `$${asset.amount} faab`;
  return `${asset.season} ${ordinal(asset.round)} ${asset.originalOwner} ${asset.selection?.playerName ?? ""}`;
}

function Asset({ asset }: { asset: TradeAsset }) {
  if (asset.kind === "player") {
    return (
      <li className={styles.asset}>
        <span className={styles.badge} data-position={asset.position}>{asset.position || "—"}</span>
        <div><strong>{asset.name}</strong><small>{asset.team}</small></div>
      </li>
    );
  }
  if (asset.kind === "faab") {
    return (
      <li className={styles.asset}>
        <span className={`${styles.badge} ${styles.faabBadge}`}>$</span>
        <div><strong>${asset.amount} FAAB</strong><small>Waiver budget</small></div>
      </li>
    );
  }
  return (
    <li className={`${styles.asset} ${styles.pickAsset}`}>
      <span className={`${styles.badge} ${styles.pickBadge}`}>R{asset.round}</span>
      <div>
        <strong>{asset.season} {ordinal(asset.round)} round pick</strong>
        <small>Originally {asset.originalOwner}&apos;s</small>
        {asset.selection
          ? <span className={styles.selection}><b>{asset.selection.pickLabel}</b> {asset.selection.playerName}{asset.selection.position && ` · ${asset.selection.position}`}<i>picked by {asset.selection.pickedBy}</i></span>
          : <span className={styles.pending}>Not yet drafted</span>}
      </div>
    </li>
  );
}

function GradeCard({ grade }: { grade: SideGrade | undefined }) {
  if (!grade || grade.status === "unrated") {
    return <div className={styles.grading}><strong>Not rated</strong><p>{grade?.reason ?? "No valuation assessment available."}</p></div>;
  }
  const delta = (value: number | undefined) => value === undefined ? "Unavailable" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
  return (
    <div className={styles.grading}>
      <div className={styles.grades}>
        <span>At the trade <b data-grade={grade.now}>{grade.now}</b></span>
        <span>Future base case <b data-grade={grade.future}>{grade.future}</b></span>
      </div>
      <p>{grade.strategy} · {grade.score?.toFixed(1)}/100</p>
      <p>Market value: {grade.received?.toLocaleString("en-GB")} received / {grade.given?.toLocaleString("en-GB")} given up.</p>
      <p>Value edge {delta(grade.marketDelta)} · Starter impact {delta(grade.lineupDelta)} · Depth impact {delta(grade.depthDelta)}</p>
      <p>Conditional future range: <strong>{grade.downside} to {grade.upside}</strong>. Scenarios, not predictions.</p>
      <details><summary>What would change the grade?</summary><ul>{grade.scenarios?.map((scenario, index) => <li key={index}>{scenario}</li>)}</ul></details>
    </div>
  );
}

export default function TradeHistory({ seasons, assessments }: { seasons: TradeSeason[]; assessments: Record<string, TradeAssessment> }) {
  const [season, setSeason] = useState(seasons[0]?.season ?? "");
  const [manager, setManager] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");

  const current = seasons.find((candidate) => candidate.season === season) ?? seasons[0];
  const managers = useMemo(() => [...new Map(current?.trades.flatMap((trade) => trade.sides.map((side) => [side.manager.username, side.manager.name] as const)) ?? []).entries()]
    .sort((left, right) => left[1].localeCompare(right[1])), [current]);

  const trades = useMemo(() => {
    const search = query.trim().toLowerCase();
    const filtered = (current?.trades ?? []).filter((trade) =>
      (manager === "all" || trade.sides.some((side) => side.manager.username === manager))
      && (!search || trade.sides.some((side) => side.manager.name.toLowerCase().includes(search)
        || side.receives.some((asset) => assetText(asset).toLowerCase().includes(search)))));
    if (sort === "best") {
      const score = (trade: TradeRecord) => {
        const rosterId = trade.sides.find((side) => side.manager.username === manager)?.manager.rosterId;
        return assessments[trade.id]?.sides.find((side) => side.rosterId === rosterId)?.score ?? -1;
      };
      filtered.sort((left, right) => score(right) - score(left) || right.timestamp - left.timestamp);
    }
    return filtered;
  }, [current, manager, query, sort, assessments]);

  const stats = useMemo(() => {
    const counts = new Map<string, number>();
    let picks = 0;
    let players = 0;
    for (const trade of current?.trades ?? []) {
      for (const side of trade.sides) {
        counts.set(side.manager.name, (counts.get(side.manager.name) ?? 0) + 1);
        picks += side.receives.filter((asset) => asset.kind === "pick").length;
        players += side.receives.filter((asset) => asset.kind === "player").length;
      }
    }
    const busiest = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
    return { picks, players, busiest };
  }, [current]);

  const selectSeason = (next: string) => {
    setSeason(next);
    setManager("all");
    setSort("newest");
  };

  return (
    <section>
      <details className={styles.methodology}>
        <summary>How team-specific trade grades work</summary>
        <p>A = 80+, B = 65–79.9, C = 45–64.9, D = 30–44.9, F = below 30. An even trade starts at 50 (C).</p>
        <p>At-trade grades combine received-versus-given market value, the best legal starting lineup and remaining bench strength. Market / starters / depth weights are 55 / 35 / 10 for the top third of standings, 65 / 25 / 10 for the middle third and 80 / 10 / 10 for the bottom third. Standings are a strategy proxy, not a declaration of a manager&apos;s intent.</p>
        <p>Future grades compare package values at the midpoint of supplied low/high outcomes. The upside pairs received assets&apos; highs with outgoing assets&apos; lows; downside reverses that. These are conditional bounds, not probabilities or guarantees. Pick ranges must reflect the original team&apos;s likely draft slot, that draft class and its prospects; completed selections shown below are hindsight and never used in at-trade grades.</p>
        <p>Only authorised snapshots from the seven days before a trade are accepted. Roster, standings, format and valuations must describe that time. Missing inputs mean Not rated. Values must share a scale; this is our transparent model, not KeepTradeCut&apos;s proprietary calculator or a claim of access to its API.</p>
      </details>
      <nav className={styles.tabs} aria-label="Seasons">
        {seasons.map((candidate) => (
          <button key={candidate.season} type="button" aria-pressed={candidate.season === current?.season} onClick={() => selectSeason(candidate.season)}>
            {candidate.season}<small>{candidate.trades.length} trades</small>
          </button>
        ))}
      </nav>

      <div className={styles.stats}>
        <div><strong>{current?.trades.length ?? 0}</strong><span>Trades</span></div>
        <div><strong>{stats.players}</strong><span>Players moved</span></div>
        <div><strong>{stats.picks}</strong><span>Picks moved</span></div>
        <div><strong>{stats.busiest?.[0] ?? "—"}</strong><span>{stats.busiest ? `Most active · ${stats.busiest[1]} trades` : "Most active"}</span></div>
      </div>

      <div className={styles.filters}>
        <label>
          <span>Manager</span>
          <select value={manager} onChange={(event) => { setManager(event.target.value); setSort("newest"); }}>
            <option value="all">All managers</option>
            {managers.map(([username, name]) => <option key={username} value={username}>{name}</option>)}
          </select>
        </label>
        <label>
          <span>Order</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="best" disabled={manager === "all"}>Best grade for selected manager</option>
          </select>
        </label>
        <label className={styles.search}>
          <span>Search</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Player, pick or manager" />
        </label>
      </div>

      <p className={styles.count}>{trades.length === (current?.trades.length ?? 0) ? `Showing all ${trades.length} trades` : `Showing ${trades.length} of ${current?.trades.length ?? 0} trades`}</p>

      <div className={styles.list}>
        {trades.map((trade) => {
          const when = tradeWhen(trade);
          return (
            <article key={trade.id} className={styles.trade}>
              <header>
                <span>{when.label}</span>
                <time dateTime={new Date(trade.timestamp).toISOString()}>{when.date}</time>
              </header>
              <div className={styles.sides} data-count={trade.sides.length}>
                {trade.sides.map((side, index) => (
                  <div key={side.manager.rosterId} className={styles.side}>
                    {index > 0 && <span className={styles.swap} aria-hidden="true">⇄</span>}
                    <div className={styles.manager}>
                      <Image src={`/avatars/${side.manager.username}.jpg`} alt="" width={36} height={36} />
                      <div><strong>{side.manager.name}</strong><small>receives</small></div>
                    </div>
                    <ul>
                      {side.receives.length
                        ? side.receives.map((asset, assetIndex) => <Asset key={assetIndex} asset={asset} />)
                        : <li className={styles.nothing}>Nothing</li>}
                    </ul>
                    <details className={styles.outgoing}>
                      <summary>Gives up ({side.givesUp?.length ?? "unknown"})</summary>
                      <ul>{side.givesUp === null
                        ? <li className={styles.nothing}>Outgoing player ownership unavailable.</li>
                        : side.givesUp.length
                          ? side.givesUp.map((asset, assetIndex) => <Asset key={assetIndex} asset={asset} />)
                          : <li className={styles.nothing}>Nothing</li>}</ul>
                    </details>
                    <GradeCard grade={assessments[trade.id]?.sides.find((grade) => grade.rosterId === side.manager.rosterId)} />
                  </div>
                ))}
              </div>
              {assessments[trade.id]?.source && <p className={styles.source}>Valuation source: {assessments[trade.id].source} · As of {assessments[trade.id].asOf} · Future horizon: {assessments[trade.id].futureHorizon}</p>}
            </article>
          );
        })}
        {!trades.length && <p className={styles.empty}>No trades match those filters.</p>}
      </div>
    </section>
  );
}
