import { NextResponse } from "next/server";
import { authenticateLadbrokesCode, getLadbrokesContext, getLadbrokesSession, LADBROKES_COOKIE } from "@/lib/ladbrokes";

export async function GET() {
  const session = await getLadbrokesSession();
  if (!session) return NextResponse.json({ user: null });
  const owner = (await getLadbrokesContext()).owners.find((item) => item.rosterId === session.rosterId);
  return NextResponse.json({ user: owner ?? null });
}

export async function POST(request: Request) {
  const { code } = await request.json();
  if (typeof code !== "string") return NextResponse.json({ error: "Invalid access code" }, { status: 400 });
  const session = await authenticateLadbrokesCode(code);
  if (!session?.token) return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(LADBROKES_COOKIE, session.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 90 });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ user: null });
  response.cookies.set(LADBROKES_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}