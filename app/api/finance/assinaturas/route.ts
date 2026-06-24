import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ assinaturas: [] });
  const rows = await prisma.assinatura.findMany({
    where: { companyId }, orderBy: { createdAt: "desc" },
    include: { cliente: { select: { nome: true } }, plano: { select: { nome: true, valorCents: true } } },
  });
  return NextResponse.json({ assinaturas: rows.map((a: any) => ({
    id: a.id, status: a.status, proximaCobranca: a.proximaCobranca,
    cliente: a.cliente?.nome || "—", plano: a.plano?.nome || "—", valor: ((a.valorCents ?? a.plano?.valorCents) || 0) / 100,
  })) });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const b = await req.json();
  if (!b.companyId || !canAccessCompany(user, b.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (!b.clienteId || !b.planoId) return NextResponse.json({ error: "Cliente e plano obrigatórios." }, { status: 400 });
  // Primeira cobrança: data informada, ou dia 1 do mês que vem.
  let prox: Date;
  if (b.proximaCobranca) prox = new Date(b.proximaCobranca);
  else { const n = new Date(); prox = new Date(n.getFullYear(), n.getMonth() + 1, 1); }
  const a = await prisma.assinatura.create({
    data: { companyId: b.companyId, clienteId: b.clienteId, planoId: b.planoId, status: "ativa", proximaCobranca: prox, valorCents: b.valor ? Math.round(Number(b.valor) * 100) : null, diaCobranca: b.diaCobranca ? Number(b.diaCobranca) : prox.getDate() },
  });
  return NextResponse.json({ ok: true, id: a.id });
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") || "";
  const a = await prisma.assinatura.findUnique({ where: { id }, select: { companyId: true } });
  if (!a || !canAccessCompany(user, a.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  await prisma.assinatura.update({ where: { id }, data: { status: "cancelada" } });
  return NextResponse.json({ ok: true });
}
