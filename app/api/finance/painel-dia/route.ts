import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany, approversOf } from "@/lib/finance";
import { getInterConfig, getSaldo } from "@/lib/inter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Painel do dia (visão do sócio): caixa, entrou/saiu hoje, a receber/pagar, MRR, conciliação pendente.
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const fin = await approversOf(companyId);
  if (!isAdmin(user) && !fin.financeiros.includes(user.id)) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });

  const hojeStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const d0 = new Date(`${hojeStr}T00:00:00-03:00`);
  const d1 = new Date(d0.getTime() + 24 * 3600 * 1000);
  const inicioMes = new Date(`${hojeStr.slice(0, 7)}-01T00:00:00-03:00`);
  const agora = new Date();
  const c = (v: number) => Math.round((v || 0) / 100);

  const [txHoje, contasCaixa, receb, assinaturas, pagarPend, aguardandoPag, semCategoria] = await Promise.all([
    prisma.bankTransaction.findMany({ where: { companyId, data: { gte: d0, lt: d1 }, account: { tipo: { notIn: ["cartao", "socio"] } } }, select: { tipo: true, valor: true, conciliado: true, requestId: true, categoria: { select: { nome: true } }, descricao: true } }),
    prisma.bankAccount.findMany({ where: { companyId, tipo: { notIn: ["cartao", "socio"] } }, select: { id: true, nome: true, conexao: true } }),
    prisma.receivable.findMany({ where: { companyId }, select: { status: true, valorCents: true, vencimento: true, pagoEm: true, conciliadoManual: true, id: true } }),
    prisma.assinatura.findMany({ where: { companyId, status: "ativa" }, select: { valorCents: true, plano: { select: { valorCents: true } } } }),
    prisma.paymentRequest.count({ where: { companyId, status: { notIn: ["paga", "recusada", "cancelada"] } } }),
    prisma.paymentRequest.count({ where: { companyId, status: "conferida" } }),
    prisma.bankTransaction.count({ where: { companyId, categoriaId: null, conciliado: false, account: { tipo: { not: "cartao" } } } }),
  ]);

  const entrouHoje = txHoje.filter((t) => t.tipo === "credito").reduce((s, t) => s + t.valor, 0);
  const saiuHoje = txHoje.filter((t) => t.tipo === "debito").reduce((s, t) => s + t.valor, 0);

  // saldo: Inter ao vivo (guardado) + soma das demais contas
  let saldoTotal = 0; let ultimoSync: string | null = null;
  for (const acc of contasCaixa) {
    if (acc.conexao === "inter") {
      const cfg = await getInterConfig(companyId);
      const s = cfg ? await getSaldo(cfg) : NaN;
      if (!Number.isNaN(s)) saldoTotal += s;
    } else {
      const agg = await prisma.bankTransaction.aggregate({ where: { accountId: acc.id }, _sum: { valor: true } });
      saldoTotal += Number(agg._sum.valor || 0);
    }
  }
  const cfgI = await prisma.integrationConfig.findFirst({ where: { companyId, provider: "inter" }, select: { lastSyncAt: true } });
  ultimoSync = cfgI?.lastSyncAt ? cfgI.lastSyncAt.toISOString() : null;

  const conciliadoDoRec = (r: any) => r.conciliadoManual; // lastro por bank tx é resolvido no /receber; aqui usamos o flag manual + status
  const aReceberAberto = receb.filter((r) => r.status === "pendente").reduce((s, r) => s + r.valorCents, 0);
  const vencidos = receb.filter((r) => r.status === "pendente" && r.vencimento && r.vencimento < agora);
  const vencidoValor = vencidos.reduce((s, r) => s + r.valorCents, 0);
  const recebidoMes = receb.filter((r) => r.status === "paga" && r.pagoEm && r.pagoEm >= inicioMes).reduce((s, r) => s + r.valorCents, 0);
  const mrr = assinaturas.reduce((s, a) => s + (a.valorCents || a.plano?.valorCents || 0), 0);

  // conciliação pendente
  const recIds = receb.map((r) => r.id);
  const txConc = recIds.length ? await prisma.bankTransaction.findMany({ where: { companyId, tipo: "credito", conciliado: true, requestId: { in: recIds } }, select: { requestId: true } }) : [];
  const comLastro = new Set(txConc.map((t) => t.requestId));
  const pagosSemLastro = receb.filter((r) => r.status === "paga" && !r.conciliadoManual && !comLastro.has(r.id)).length;
  const aCasar = await prisma.bankTransaction.count({ where: { companyId, tipo: "credito", conciliado: false, account: { tipo: { not: "cartao" } } } });

  return NextResponse.json({
    data: hojeStr,
    caixa: Math.round(saldoTotal), ultimoSync,
    entrouHoje: Math.round(entrouHoje), saiuHoje: Math.round(saiuHoje),
    aReceberAberto: c(aReceberAberto), vencidoValor: c(vencidoValor), vencidoQtd: vencidos.length,
    recebidoMes: c(recebidoMes), mrr: c(mrr),
    aPagarPend: pagarPend, aguardandoPagamento: aguardandoPag,
    conciliar: { aCasar, pagosSemLastro }, semCategoria,
  });
}
