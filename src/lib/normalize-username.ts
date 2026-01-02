// lib/normalize-username.ts

/**
 * Mapping of Sleeper usernames to real names
 */
const DISPLAY_NAMES: Record<string, string> = {
  'AshHarris': 'Cup',
  'BradWillz': 'Brad',
  'BradKane': 'Brad', // Same person as BradWillz
  'connorjl': 'Connor',
  'DaleGriff': 'Griff',
  'DeclanHughes3': 'Randall',
  'dewcrabbe': 'Dewi',
  'dto1989': 'Danny',
  'ieuanlewis21': 'YS',
  'Lee_Edge': 'Fringe',
  'liminoso': 'Tucker',
  'Rbreeezy': 'Rhys',
  'SPowell91': 'Powell',
  'Steve47': 'Weave',
  'Tee2Sugars': 'Tee',
  'Thomas1995': 'Tommy Mac',
};

/**
 * Mapping of roster IDs to usernames for cases where owner_id is missing
 * Format: "leagueId_rosterId" -> username
 * Roster 8 has had multiple players across different seasons
 */
const ROSTER_TO_USERNAME: Record<string, string> = {
  // 2021 season - Team 8 is Thomas1995 (Tommy Mac)
  '726147812953296896_8': 'Thomas1995',
  // 2022 season - Team 8 is DeclanHughes3 (Randall)
  '850075634540597248_8': 'DeclanHughes3',
  // 2023 season - Team 8 is DeclanHughes3 (Randall)
  '991770914062688256_8': 'DeclanHughes3',
  // 2024 season - Team 8 is ieuanlewis21 (YS)
  '1096400120607780864_8': 'ieuanlewis21',
  // 2025 season - Team 8 is ieuanlewis21 (YS)
  '1187453772455809024_8': 'ieuanlewis21',
  // Fallback for current/future seasons
  '8': 'ieuanlewis21',
};

/**
 * Gets the username for a roster, accounting for missing owner_id cases
 */
export function getRosterUsername(leagueId: string, rosterId: number): string | null {
  // Try league-specific mapping first
  const specificKey = `${leagueId}_${rosterId}`;
  if (ROSTER_TO_USERNAME[specificKey]) {
    return ROSTER_TO_USERNAME[specificKey];
  }
  
  // Try roster ID alone as fallback
  const fallbackKey = `${rosterId}`;
  if (ROSTER_TO_USERNAME[fallbackKey]) {
    return ROSTER_TO_USERNAME[fallbackKey];
  }
  
  return null;
}

/**
 * Normalizes usernames to handle cases where users have changed their names
 * This is used for data fetching and avatar lookup
 */
export function normalizeUsername(username: string): string {
  // Remove @ if present for comparison
  const cleanName = username.replace('@', '');
  
  // BradKane and BradWillz are the same person (BradWillz is most recent)
  if (cleanName === 'BradKane') {
    return 'BradWillz';
  }
  
  return cleanName;
}

/**
 * Gets the display name (real name) for a username
 * Falls back to the username if no display name is configured
 */
export function getDisplayName(username: string): string {
  const cleanName = username.replace('@', '');
  const normalized = normalizeUsername(cleanName);
  return DISPLAY_NAMES[normalized] || normalized;
}

/**
 * Formats a username with @ prefix after normalization
 * Use this for internal data handling
 */
export function formatUsername(username: string | undefined, fallback: string = 'Unknown'): string {
  if (!username) return fallback;
  
  const normalized = normalizeUsername(username);
  return normalized.startsWith('@') ? normalized : `@${normalized}`;
}

/**
 * Gets the formatted display name for showing to users
 * This returns the real name without @ prefix
 */
export function formatDisplayName(username: string | undefined, fallback: string = 'Unknown'): string {
  if (!username) return fallback;
  
  return getDisplayName(username);
}
