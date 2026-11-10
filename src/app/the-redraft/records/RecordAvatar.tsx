"use client";

import type { RecordTeam } from "@/lib/league-records";
import UserAvatar from "@/components/UserAvatar";

export default function RecordAvatar({ team }: { team: RecordTeam }) {
  return <UserAvatar username={team.username} size="md" />;
}
