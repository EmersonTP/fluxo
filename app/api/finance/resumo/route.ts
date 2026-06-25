import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany, approversOf } from "@/lib/finance";
import { getClassifier, getLancamentos } from "@/lib/ledger";
import { getInterConfig, getSaldo } from "@/lib/inter";

export const runtime = "nodejs";
function ymd(d: Date) { return d.toISOString().slice(0, 10); }

// Resumo executivo do financeiro p/ a home (Visão geral). Lê do banco (rápido).
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const fin = await approversOf(companyId);
  if (!isAdmin(user) && !fin.financeiros.includes(user.id)) return NextResponse.json({ error: "Acesso restrito ao financeiro." }, { status: 403 });

  const hoje = new Date();

  // saldo de caixa (cartão e sócio ficam de fora) + última sincronização
  const contasCaixa: any[] = await prisma.bankAccount.findMany({ where: { companyId, tipo: { notIn: ["cartao", "socio"] } } });
  let saldoTotal = 0; let ultimoSync: string | null = null;
  for (const c of contasCaixa) {
    if (c.lastSyncAt && (!ultimoSync || c.lastSyncAt > new Date(ultimoSync))) ultimoSync = c.lastSyncAt.toISOString();
    if (c.conexao === "inter") {
      const cfg = await getInterConfig(companyId);
      const s = cfg ? await getSaldo(cfg) : NaN;
      if (!Number.isNaN(s)) saldoTotal += s;
    } else {
      const agg = await prisma.bankTransaction.aggregate({ where: { accountId: c.id }, _sum: { valor: true } });
      saldoTotal += Number(agg._sum.valor || 0);
    }
  }

  // contas a pagar em aberto
  const aPagarRows = await prisma.paymentRequest.findMany({
    where: { companyId, status: { notIn: ["paga", "recusada", "cancelada"] } },
    select: { valor: true, vencimento: true },
  });
  const aPagar = { qtd: aPagarRows.length, total: 0, vencidas: 0, totalVencidas: 0 };
  for (const r of aPagarRows) { aPagar.total += r.valor || 0; if (r.vencimento && r.vencimento < hoje) { aPagar.vencidas++; aPagar.totalVencidas += r.valor || 0; } }

  // contas a receber em aberto
  const aReceberRows = await prisma.receivable.findMany({
    where: { companyId, status: { in: ["pendente", "vencida"] } },
    select: { valorCents: true, vencimento: true, status: true },
  });
  const aReceber = { qtd: aReceberRows.length, total: 0, vencidas: 0, totalVencidas: 0 };
  for (const r of aReceberRows) { const v = (r.valorCents || 0) / 100; aReceber.total += v; const venc = r.status === "vencida" || (r.vencimento && r.vencimento < hoje); if (venc) { aReceber.vencidas++; aReceber.totalVencidas += v; } }

  // lançamentos sem categoria (últimos 90 dias) — aponta o que falta classificar
  const de = ymd(new Date(hoje.getTime() - 90 * 864e5));
  const classifica = await getClassifier(companyId);
  const lanc = await getLancamentos(companyId, de, ymd(hoje), {});
  let semCategoria = 0;
  for (const l of lanc) { if (!l.override && !classifica(l.tipo, l.descricao)) semCategoria++; }

  // últimos lançamentos
  const ult = await prisma.bankTransaction.findMany({
    where: { companyId }, orderBy: { data: "desc" }, take: 8,
    include: { account: { select: { nome: true } } },
  });
  const ultimos = ult.map((t: any) => ({
    data: (t.data as Date).toISOString().slice(0, 10),
    descricao: (t.descricao || "").slice(0, 50),
    valor: Math.round(Math.abs(Number(t.valor || 0))),
    tipo: t.tipo || (Number(t.valor) >= 0 ? "credito" : "debito"),
    conta: t.account?.nome || "",
  }));

  return NextResponse.json({
    saldoTotal: Math.round(saldoTotal), ultimoSync,
    aPagar: { qtd: aPagar.qtd, total: Math.round(aPagar.total), vencidas: aPagar.vencidas, totalVencidas: Math.round(aPagar.totalVencidas) },
    aReceber: { qtd: aReceber.qtd, total: Math.round(aReceber.total), vencidas: aReceber.vencidas, totalVencidas: Math.round(aReceber.totalVencidas) },
    semCategoria,
    ultimos,
  });
}
