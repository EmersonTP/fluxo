import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessCompany, isAdmin } from "@/lib/finance";
import { hasGoogleCreds } from "@/lib/gdrive";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId) || !isAdmin(user)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const conn = await prisma.driveConn.findUnique({ where: { companyId }, select: { folderId: true, email: true, createdAt: true } });
  return NextResponse.json({ credsOk: hasGoogleCreds(), conectado: !!conn, folderId: conn?.folderId || null, email: conn?.email || null });
}
