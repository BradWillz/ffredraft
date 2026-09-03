import { NextResponse } from "next/server";
import { ADMIN_COOKIE, getAdminToken, isAdmin, validateAdminPassword } from "@/lib/admin-auth";

export async function GET() {
  return NextResponse.json({ isAdmin: await isAdmin() });
}

export async function POST(request: Request) {
  const { password } = await request.json();
  if (typeof password !== "string" || !validateAdminPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  const response = NextResponse.json({ isAdmin: true });
  response.cookies.set(ADMIN_COOKIE, getAdminToken()!, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 7 });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ isAdmin: false });
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}