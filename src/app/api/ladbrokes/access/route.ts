import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getLadbrokesContext, getProvisionedRosterIds, provisionAccessCode, revokeAccessCode } from "@/lib/ladbrokes";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [{ owners }, provisioned] = await Promise.all([getLadbrokesContext(), getProvisionedRosterIds()]);
  return NextResponse.json({ owners: owners.map((owner) => ({ ...owner, hasCode: provisioned.includes(owner.rosterId) })) });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { rosterId } = await request.json();
  const owner = (await getLadbrokesContext()).owners.find((item) => item.rosterId === rosterId);
  if (!owner) return NextResponse.json({ error: "Roster not found" }, { status: 404 });
  return NextResponse.json({ owner, code: await provisionAccessCode(owner) });
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { rosterId } = await request.json();
  if (!Number.isInteger(rosterId)) return NextResponse.json({ error: "Invalid roster" }, { status: 400 });
  await revokeAccessCode(rosterId);
  return NextResponse.json({ revoked: true });
}