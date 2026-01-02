// User authentication for Ladbrokes betting

export type UserAccess = {
  code: string;
  rosterId: number;
  displayName: string;
  username: string;
};

// Generate unique access codes for each team owner
// These can be distributed as QR codes or shared links
export const USER_ACCESS_CODES: UserAccess[] = [
  { code: 'CUP-2025-X7K9', rosterId: 1, displayName: 'Cup', username: '@AshHarris' },
  { code: 'BRAD-2025-M3P8', rosterId: 2, displayName: 'Brad', username: '@BradWillz' },
  { code: 'CONNOR-2025-Q5R2', rosterId: 3, displayName: 'Connor', username: '@connorjl' },
  { code: 'GRIFF-2025-W8T4', rosterId: 4, displayName: 'Griff', username: '@DaleGriff' },
  { code: 'DEWI-2025-A1N6', rosterId: 5, displayName: 'Dewi', username: '@dewcrabbe' },
  { code: 'DANNY-2025-L9H3', rosterId: 6, displayName: 'Danny', username: '@dto1989' },
  { code: 'FRINGE-2025-K2V7', rosterId: 7, displayName: 'Fringe', username: '@Lee_Edge' },
  { code: 'YS-2025-B6D1', rosterId: 8, displayName: 'YS', username: '@ieuanlewis21' },
  { code: 'TUCKER-2025-F4S9', rosterId: 9, displayName: 'Tucker', username: '@liminoso' },
  { code: 'RHYS-2025-G8P5', rosterId: 10, displayName: 'Rhys', username: '@Rbreeezy' },
  { code: 'POWELL-2025-J3M2', rosterId: 11, displayName: 'Powell', username: '@SPowell91' },
  { code: 'WEAVE-2025-Z7C4', rosterId: 12, displayName: 'Weave', username: '@Steve47' },
];

export function validateAccessCode(code: string): UserAccess | null {
  return USER_ACCESS_CODES.find(u => u.code === code) || null;
}

export function hasUserAlreadyBet(displayName: string): boolean {
  if (typeof window === 'undefined') return false;
  
  const stored = localStorage.getItem('ladbrokes_bets');
  if (!stored) return false;
  
  const bets = JSON.parse(stored);
  return bets.some((bet: any) => bet.userName === displayName);
}

export function generateQRCodeUrl(code: string): string {
  // You can use a QR code generator service or library
  // This returns a URL that includes the access code as a parameter
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  return `${baseUrl}/ladbrokes?code=${code}`;
}

// Generate all QR code URLs for printing/distribution
export function getAllQRCodeUrls(): Array<{ user: UserAccess; url: string; qrCodeImageUrl: string }> {
  return USER_ACCESS_CODES.map(user => ({
    user,
    url: generateQRCodeUrl(user.code),
    // Using a free QR code API (you can also use a library like qrcode.react)
    qrCodeImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(generateQRCodeUrl(user.code))}`,
  }));
}
