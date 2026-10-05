"use client";

const FALLBACK = "https://sleepercdn.com/images/v2/icons/player_default.webp";

// Sleeper uses team abbreviations (e.g. "DET") as player IDs for team defences.
function headshotUrl(playerId: string) {
  return /^[A-Z]{2,3}$/.test(playerId)
    ? `https://sleepercdn.com/images/team_logos/nfl/${playerId.toLowerCase()}.png`
    : `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
}

export default function PlayerHeadshot({ playerId, className }: { playerId: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote Sleeper CDN image with a runtime fallback
    <img
      src={headshotUrl(playerId)}
      alt=""
      width={44}
      height={44}
      loading="lazy"
      className={className}
      onError={(event) => {
        if (event.currentTarget.src !== FALLBACK) event.currentTarget.src = FALLBACK;
      }}
    />
  );
}
