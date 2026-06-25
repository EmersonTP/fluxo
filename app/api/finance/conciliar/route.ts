import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
const ymd = (d: Date) => d.toISOString().slice(0, 10);

// Conciliação: lista lançamentos do extrato e sugere o pagamento/recebimento que casa (mesmo valor).
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  const ate = url.searchParams.get("ate") || ymd(new Date());
  const de = url.searchParams.get("de") || ymd(new Date(Date.now() - 90 * 86400000));
  const soPendentes = url.searchParams.get("pendentes") === "1";

  // lançamentos de contas de caixa (cartão fica de fora da conciliação)
  const txs: any[] = await prisma.bankTransaction.findMany({
    where: { companyId, data: { gte: new Date(de + "T00:00:00"), lte: new Date(ate + "T23:59:59") }, account: { tipo: { not: "cartao" } }, ...(soPendentes ? { conciliado: false } : {}) },
    include: { account: { select: { nome: true } } }, orderBy: { data: "desc" },
  });

  // candidatos: contas a pagar (não canceladas/recusadas) e a receber, ainda não amarrados
  const pagar: any[] = await prisma.paymentRequest.findMany({ where: { companyId, status: { notIn: ["cancelada", "recusada"] } }, select: { id: true, descricao: true, areaName: true, valor: true, status: true } });
  const receber: any[] = await prisma.receivable.findMany({ where: { companyId, status: { notIn: ["cancelada", "estornada"] } }, select: { id: true, descricao: true, valorCents: true, status: true } });

  const round = (n: number) => Math.round(Math.abs(n));
  const out = txs.map((t) => {
    const v = round(t.valor);
    const sugestoes = t.tipo === "debito"
      ? pagar.filter((p) => round(p.valor) === v).slice(0, 4).map((p) => ({ tipo: "pagar", id: p.id, descricao: p.descricao || p.areaName, valor: Math.round(p.valor), status: p.status }))
      : receber.filter((r) => round(r.valorCents / 100) === v).slice(0, 4).map((r) => ({ tipo: "receber", id: r.id, descricao: r.descricao, valor: Math.round(r.valorCents / 100), status: r.status }));
    return { id: t.id, data: ymd(t.data as Date), descricao: t.descricao, valor: Math.round(t.valor), tipo: t.tipo, conta: t.account?.nome, conciliado: t.conciliado, requestId: t.requestId, sugestoes };
  });
  const totalPend = out.filter((x) => !x.conciliado).length;
  return NextResponse.json({ periodo: { de, ate }, total: out.length, pendentes: totalPend, lancamentos: out });
}

// Amarra (ou desamarra) um lançamento a um pagamento/recebimento, ou marca conciliado avulso.
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const b = await req.json();
  const t = await prisma.bankTransaction.findUnique({ where: { id: b.transactionId }, select: { companyId: true } });
  if (!t || !canAccessCompany(user, t.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const data: Record<string, unknown> = {};
  if (b.action === "desconciliar") { data.conciliado = false; data.requestId = null; }
  else { data.conciliado = true; if (b.requestId) data.requestId = b.requestId; }
  await prisma.bankTransaction.update({ where: { id: b.transactionId }, data });
  await logAudit({ req, user, action: "update", entity: "extrato", entityId: b.transactionId, companyId: t.companyId, meta: b.action || "conciliar" });
  return NextResponse.json({ ok: true });
}
