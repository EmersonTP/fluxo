import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany, approversOf } from "@/lib/finance";
import { getClassifier, getLancamentos } from "@/lib/ledger";
import { getInterConfig, getSaldo } from "@/lib/inter";

export const runtime = "nodejs";
function ymd(d: Date) { return d.toISOString().slice(0, 10); }

// Balanço gerencial (Ativo = Passivo + PL). Derivado dos lançamentos; mostra diferença a conciliar.
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const fin = await approversOf(companyId);
  if (!isAdmin(user) && !fin.financeiros.includes(user.id)) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });

  const hoje = new Date();
  const classifica = await getClassifier(companyId);
  const banco = await getLancamentos(companyId, "2020-01-01", ymd(hoje), {}); // todas as contas, todo o período

  let intangivel = 0, cdb = 0, recOper = 0, despOper = 0, aportes = 0, reembolsoSocios = 0;
  for (const l of banco) {
    const c = l.override || classifica(l.tipo, l.descricao);
    if (!c) continue;
    const v = l.valor;
    if (c.grupo === "Ativo Intangível") { if (l.tipo === "debito") intangivel += v; }
    else if (c.grupo === "Aplicações Financeiras") { cdb += l.tipo === "debito" ? v : -v; }      // aplicação(+), resgate(-)
    else if (c.grupo === "Aporte de Sócios") { if (l.tipo === "credito") aportes += v; }
    else if (c.nome === "Reembolso a sócios") { if (l.tipo === "debito") reembolsoSocios += v; }   // saída p/ sócio (reduz dívida)
    else if (c.bloco === "operacional") { if (l.tipo === "credito") recOper += v; else despOper += v; }
  }
  const resultadoAcum = recOper - despOper;        // prejuízo se negativo
  if (cdb < 0) cdb = 0;

  // Caixa (contas tipo caixa: Inter ao vivo + manuais)
  const contasCaixa: any[] = await prisma.bankAccount.findMany({ where: { companyId, tipo: { notIn: ["cartao", "socio"] } } });
  let caixa = 0;
  for (const cc of contasCaixa) {
    if (cc.conexao === "inter") { const cfg = await getInterConfig(companyId); const s = cfg ? await getSaldo(cfg) : NaN; if (!Number.isNaN(s)) caixa += s; }
    else { const agg = await prisma.bankTransaction.aggregate({ where: { accountId: cc.id }, _sum: { valor: true } }); caixa += Number(agg._sum.valor || 0); }
  }

  // A Receber (títulos em aberto) e A Pagar (em aberto)
  const arRows = await prisma.receivable.findMany({ where: { companyId, status: { in: ["pendente", "vencida"] } }, select: { valorCents: true } });
  const aReceber = arRows.reduce((s: number, r: any) => s + (r.valorCents || 0) / 100, 0);
  const apRows = await prisma.paymentRequest.findMany({ where: { companyId, status: { notIn: ["paga", "recusada", "cancelada"] } }, select: { valor: true } });
  const aPagar = apRows.reduce((s: number, r: any) => s + (r.valor || 0), 0);

  const r = (n: number) => Math.round(n);
  const ativoCirc = caixa + cdb + aReceber;
  const ativoNaoCirc = intangivel;
  const ativoTotal = ativoCirc + ativoNaoCirc;
  const passivoTotal = aPagar;
  const plAportes = aportes - reembolsoSocios; // aportes líquidos
  const plTotal = plAportes + resultadoAcum;
  const diferenca = ativoTotal - (passivoTotal + plTotal);

  return NextResponse.json({
    data: ymd(hoje),
    ativo: {
      circulante: { caixa: r(caixa), aplicacoesCDB: r(cdb), contasAReceber: r(aReceber), total: r(ativoCirc) },
      naoCirculante: { intangivelDevSoftware: r(intangivel), total: r(ativoNaoCirc) },
      total: r(ativoTotal),
    },
    passivo: {
      circulante: { contasAPagar: r(aPagar), total: r(aPagar) },
      total: r(passivoTotal),
    },
    patrimonioLiquido: {
      aportesSocios: r(plAportes),
      resultadoAcumulado: r(resultadoAcum),
      total: r(plTotal),
    },
    conferencia: { ativo: r(ativoTotal), passivoMaisPL: r(passivoTotal + plTotal), diferencaAConciliar: r(diferenca) },
    notas: [
      "Intangível (dev) está pelo valor bruto — amortização ainda não aplicada.",
      "Resultado acumulado = receitas − despesas operacionais (regime de competência), todo o período.",
      "PL usa os aportes reais que entraram (lastro), não o capital social nominal do contrato.",
      "A Receber = só títulos em aberto; mensalidades futuras não entram (são MRR, métrica gerencial).",
      "Fatura de cartão em aberto e receita diferida (cobrança antecipada) ainda não modeladas — podem explicar a diferença a conciliar.",
    ],
  });
}
