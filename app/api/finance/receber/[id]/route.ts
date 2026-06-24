import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

// Avança o título: receber (concilia), cancelar ou reabrir.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const r = await prisma.receivable.findUnique({ where: { id: params.id }, select: { id: true, companyId: true } });
  if (!r || !canAccessCompany(user, r.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const b = await req.json();
  const action = b.action as string;
  let data: Record<string, unknown> = {};
  if (action === "receber") data = { status: "paga", pagoEm: b.dataPagamento ? new Date(b.dataPagamento) : new Date() };
  else if (action === "cancelar") data = { status: "cancelada" };
  else if (action === "reabrir") data = { status: "pendente", pagoEm: null };
  else return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  await prisma.receivable.update({ where: { id: params.id }, data });
  await logAudit({ req, user, action: action === "receber" ? "pay" : "update", entity: "recebivel", entityId: params.id, companyId: r.companyId, meta: action });
  return NextResponse.json({ ok: true });
}

// Exclui um título (apenas lançamento manual; admin).
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const r = await prisma.receivable.findUnique({ where: { id: params.id }, select: { companyId: true, provider: true } });
  if (!r || !canAccessCompany(user, r.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (r.provider !== "manual") return NextResponse.json({ error: "Só títulos manuais podem ser excluídos." }, { status: 400 });
  await prisma.receivable.delete({ where: { id: params.id } });
  await logAudit({ req, user, action: "delete", entity: "recebivel", entityId: params.id, companyId: r.companyId });
  return NextResponse.json({ ok: true });
}
