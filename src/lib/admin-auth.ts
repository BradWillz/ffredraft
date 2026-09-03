import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "main-leagues-admin";

function adminToken() {
  const password = process.env.ADMIN_PASSWORD;
  return password ? createHash("sha256").update(password).digest("hex") : null;
}

export async function isAdmin() {
  const expected = adminToken();
  const actual = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!expected || !actual || expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export function validateAdminPassword(password: string) {
  const expected = adminToken();
  if (!expected) return false;
  const actual = createHash("sha256").update(password).digest("hex");
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export function getAdminToken() {
  return adminToken();
}