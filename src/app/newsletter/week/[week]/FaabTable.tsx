"use client";

import Image from "next/image";
import { useState } from "react";
import type { WeeklyReport } from "@/lib/weekly-report";
import styles from "./report.module.css";

type SortMode = "spent" | "value";

export default function FaabTable({ teams, budget }: { teams: WeeklyReport["faab"]["teams"]; budget: number }) {
  const [sort, setSort] = useState<SortMode>("spent");
  const sorted = sort === "spent"
    ? teams
    : [...teams].sort((left, right) => (right.pointsPerDollar ?? -1) - (left.pointsPerDollar ?? -1) || right.startedPoints - left.startedPoints);

  return (
    <>
      <div className={styles.faabToggle} role="group" aria-label="Sort FAAB table">
        <span>Sort by</span>
        <button type="button" aria-pressed={sort === "spent"} onClick={() => setSort("spent")}>Most spent</button>
        <button type="button" aria-pressed={sort === "value"} onClick={() => setSort("value")}>Pts per $1 (high–low)</button>
      </div>
      <div className={styles.faabTable}>
        <div className={styles.faabHeader}><span>Manager</span><span>Spent</span><span>Started pts</span><span>Pts per $1</span></div>
        {sorted.map((team) => (
          <div key={team.rosterId} className={styles.faabRow}>
            <div className={styles.faabManager}>
              <Image src={`/avatars/${team.username}.jpg`} alt="" width={34} height={34} className={styles.avatar} />
              <strong>{team.name}</strong>
            </div>
            <div className={styles.faabSpent}>
              <b>${team.spent}</b><small>${budget - team.spent} left</small>
              <i aria-hidden="true"><em style={{ width: `${Math.min(100, team.spent / budget * 100)}%` }} /></i>
            </div>
            <b className={styles.faabNumber}>{team.startedPoints.toFixed(2)}</b>
            <b className={`${styles.faabNumber} ${sort === "value" ? styles.faabSorted : ""}`}>{team.pointsPerDollar == null ? "—" : team.pointsPerDollar.toFixed(2)}</b>
            <div className={styles.faabPlayers}>
              {team.players.length
                ? team.players.map((player) => <span key={player.playerId}><strong>{player.playerName}</strong>{player.position && ` ${player.position}`} · ${player.bid} · {player.startedPoints.toFixed(2)} pts</span>)
                : <span className={styles.faabNone}>No paid bids yet</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
