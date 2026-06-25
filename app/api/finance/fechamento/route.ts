import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const c = await prisma.company.findUnique({ where: { id: companyId }, select: { fechadoAte: true } });
  return NextResponse.json({ fechadoAte: c?.fechadoAte ? c.fechadoAte.toISOString().slice(0, 10) : null });
}

// Define (ou limpa) a data ate a qual o financeiro esta fechado. Admin.
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const b = await req.json();
  if (!b.companyId || !canAccessCompany(user, b.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const data = b.fechadoAte ? new Date(String(b.fechadoAte) + "T23:59:59") : null;
  if (b.fechadoAte && (!data || isNaN(data.getTime()))) return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  await prisma.company.update({ where: { id: b.companyId }, data: { fechadoAte: data } });
  await logAudit({ req, user, action: "update", entity: "config", companyId: b.companyId, meta: `fechamento de mês: ${b.fechadoAte || "reaberto"}` });
  return NextResponse.json({ ok: true, fechadoAte: data ? data.toISOString().slice(0, 10) : null });
}

