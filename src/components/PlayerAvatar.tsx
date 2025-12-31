"use client";

interface PlayerAvatarProps {
  playerId: string;
  playerName: string;
}

export default function PlayerAvatar({ playerId, playerName }: PlayerAvatarProps) {
  return (
    <img 
      src={`https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`}
      alt={playerName}
      className="w-12 h-12 rounded-full object-cover border-2 border-slate-600"
      onError={(e) => {
        e.currentTarget.src = 'https://sleepercdn.com/images/v2/icons/player_default.webp';
      }}
    />
  );
}
