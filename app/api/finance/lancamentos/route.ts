import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany, approversOf } from "@/lib/finance";
import { getLancamentos } from "@/lib/ledger";

export const runtime = "nodejs";

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function chunksMensais(de: string, ate: string): [string, string][] {
  const out: [string, string][] = [];
  let cur = new Date(de + "T00:00:00"); const fim = new Date(ate + "T00:00:00");
  while (cur <= fim) {
    const ini = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const fimMes = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    out.push([ymd(ini > new Date(de + "T00:00:00") ? ini : new Date(de + "T00:00:00")), ymd(fimMes < fim ? fimMes : fim)]);
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return out;
}

// Lista TODOS os lançamentos (extrato Inter + contas a pagar + contas a receber), cada um classificado.
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const fin = await approversOf(companyId);
  if (!isAdmin(user) && !fin.financeiros.includes(user.id)) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });

  const de = url.searchParams.get("de") || ymd(new Date(2026, 0, 1));
  const ate = url.searchParams.get("ate") || ymd(new Date());

  const regras: any[] = await prisma.categoriaRegra.findMany({
    where: { companyId }, orderBy: { prioridade: "desc" },
    include: { categoria: { select: { grupo: true, nome: true, bloco: true } } },
  });
  const classifica = (tipo: string, txt: string) => {
    const up = (txt || "").toUpperCase();
    for (const r of regras) { if (r.aplicaA !== "ambos" && r.aplicaA !== tipo) continue; if (up.includes(r.padrao)) return r.categoria; }
    return null;
  };

  const out: any[] = [];

  // 1) lançamentos do banco (extrato Inter sincronizado + contas manuais)
  for (const t of await getLancamentos(companyId, de, ate)) {
    const c = classifica(t.tipo, t.descricao);
    out.push({ origem: t.conta || "banco", data: t.data, tipo: t.tipo, valor: t.valor, descricao: t.descricao, grupo: c?.grupo || "", categoria: c?.nome || "", bloco: c?.bloco || "", status: "" });
  }

  // 2) contas a pagar
  const reqs: any[] = await prisma.paymentRequest.findMany({
    where: { companyId }, include: { categoriaRef: { select: { grupo: true, nome: true, bloco: true } } },
  });
  for (const r of reqs) {
    out.push({ origem: "a_pagar", data: (r.vencimento || r.createdAt).toISOString().slice(0, 10), tipo: "debito", valor: Number(r.valor || 0),
      descricao: r.descricao || r.areaName || "", grupo: r.categoriaRef?.grupo || "", categoria: r.categoriaRef?.nome || r.categoria || "", bloco: r.categoriaRef?.bloco || "", status: r.status });
  }

  // 3) contas a receber
  const recs: any[] = await prisma.receivable.findMany({ where: { companyId }, include: { cliente: { select: { nome: true } } } });
  for (const r of recs) {
    out.push({ origem: "a_receber", data: (r.vencimento || r.createdAt).toISOString().slice(0, 10), tipo: "credito", valor: (r.valorCents || 0) / 100,
      descricao: r.descricao || r.cliente?.nome || "", grupo: "Receita", categoria: r.origem === "assinatura" ? "Membership" : "Outras receitas", bloco: "operacional", status: r.status });
  }

  out.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  return NextResponse.json({ periodo: { de, ate }, total: out.length, lancamentos: out });
}

// Override manual: fixa (ou limpa) a categoria de um lançamento. Tem prioridade sobre as regras.
export async function PATCH(req: Request) {
  const { requireUser, isResponse } = await import("@/lib/api");
  const { isAdmin, canAccessCompany } = await import("@/lib/finance");
  const { logAudit } = await import("@/lib/audit");
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const b = await req.json();
  const tx = await prisma.bankTransaction.findUnique({ where: { id: String(b.txId || "") }, select: { id: true, companyId: true, data: true } });
  if (!tx || !canAccessCompany(user, tx.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const { periodoFechado } = await import("@/lib/finance");
  if (tx.data && await periodoFechado(tx.companyId, tx.data as Date)) return NextResponse.json({ error: "Período fechado: não é possível reclassificar lançamento de mês fechado." }, { status: 409 });
  const categoriaId = b.categoriaId ? String(b.categoriaId) : null;
  await prisma.bankTransaction.update({ where: { id: tx.id }, data: { categoriaId } });
  await logAudit({ req, user, action: "update", entity: "extrato", companyId: tx.companyId, meta: `categoria do lançamento ${categoriaId ? "fixada" : "limpa"}` });
  return NextResponse.json({ ok: true });
}
