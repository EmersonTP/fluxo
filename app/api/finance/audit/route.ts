import { NextResponse } from "next/server";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";
import { recentAudit } from "@/lib/audit";
import { hasEncKey } from "@/lib/crypto";

// Trilha de auditoria (LGPD) — só admin. Mostra quem acessou/alterou dado sensível.
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ logs: [], encryption: hasEncKey() });
  const logs = await recentAudit(companyId, 200);
  return NextResponse.json({ logs, encryption: hasEncKey() });
}
