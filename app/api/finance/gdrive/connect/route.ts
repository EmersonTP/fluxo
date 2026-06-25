import { NextResponse } from "next/server";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessCompany, isAdmin } from "@/lib/finance";
import { authUrl, hasGoogleCreds } from "@/lib/gdrive";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId) || !isAdmin(user)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (!hasGoogleCreds()) return NextResponse.json({ error: "Faltam GOOGLE_CLIENT_ID/SECRET no servidor." }, { status: 400 });
  return NextResponse.redirect(authUrl(companyId));
}
