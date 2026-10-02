"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { TradeAsset, TradeRecord, TradeSeason } from "@/lib/trade-history";
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

export default function TradeHistory({ seasons }: { seasons: TradeSeason[] }) {
  const [season, setSeason] = useState(seasons[0]?.season ?? "");
  const [manager, setManager] = useState("all");
  const [query, setQuery] = useState("");

  const current = seasons.find((candidate) => candidate.season === season) ?? seasons[0];
  const managers = useMemo(() => [...new Map(current?.trades.flatMap((trade) => trade.sides.map((side) => [side.manager.username, side.manager.name] as const)) ?? []).entries()]
    .sort((left, right) => left[1].localeCompare(right[1])), [current]);

  const trades = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (current?.trades ?? []).filter((trade) =>
      (manager === "all" || trade.sides.some((side) => side.manager.username === manager))
      && (!search || trade.sides.some((side) => side.manager.name.toLowerCase().includes(search)
        || side.receives.some((asset) => assetText(asset).toLowerCase().includes(search)))));
  }, [current, manager, query]);

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
  };

  return (
    <section>
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
          <select value={manager} onChange={(event) => setManager(event.target.value)}>
            <option value="all">All managers</option>
            {managers.map(([username, name]) => <option key={username} value={username}>{name}</option>)}
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
                  </div>
                ))}
              </div>
            </article>
          );
        })}
        {!trades.length && <p className={styles.empty}>No trades match those filters.</p>}
      </div>
    </section>
  );
}
