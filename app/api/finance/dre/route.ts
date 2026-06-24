import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany, approversOf } from "@/lib/finance";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

const ym = (d: Date | null) => (d ? d.toISOString().slice(0, 7) : "");

// DRE por COMPETÊNCIA (data de vencimento). Receitas = contas a receber; despesas = contas a pagar.
// Diferente do Fluxo de Caixa (que é por caixa / extrato).
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const fin = await approversOf(companyId);
  if (!isAdmin(user) && !fin.financeiros.includes(user.id)) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });

  const de = url.searchParams.get("de");
  const ate = url.searchParams.get("ate");
  const inRange = (d: Date | null) => { if (!d) return true; if (de && ym(d) < de.slice(0, 7)) return false; if (ate && ym(d) > ate.slice(0, 7)) return false; return true; };

  const meses = new Set<string>();
  const add = (acc: Record<string, number>, m: string, v: number) => { acc[m] = (acc[m] || 0) + v; };

  // ---- RECEITAS (contas a receber, competência = vencimento) ----
  const recs: any[] = await prisma.receivable.findMany({
    where: { companyId, status: { notIn: ["cancelada", "estornada"] } },
    select: { valorCents: true, vencimento: true, createdAt: true, origem: true },
  });
  const receitaPorMes: Record<string, number> = {};
  const receitaPorCat: Record<string, { nome: string; total: number; porMes: Record<string, number> }> = {};
  for (const r of recs) {
    const d = r.vencimento || r.createdAt; if (!inRange(d)) continue;
    const m = ym(d); meses.add(m);
    const v = (r.valorCents || 0) / 100;
    const nome = r.origem === "assinatura" ? "Membership" : "Outras receitas";
    add(receitaPorMes, m, v);
    const c = (receitaPorCat[nome] = receitaPorCat[nome] || { nome, total: 0, porMes: {} });
    c.total += v; add(c.porMes, m, v);
  }

  // ---- DESPESAS (contas a pagar, competência = vencimento) ----
  const reqs: any[] = await prisma.paymentRequest.findMany({
    where: { companyId, status: { notIn: ["cancelada", "recusada"] } },
    include: { categoriaRef: { select: { grupo: true, nome: true, bloco: true, tipo: true } } },
  });
  // bloco -> grupo -> {categoria}
  type Cat = { grupo: string; nome: string; total: number; porMes: Record<string, number> };
  const blocos: Record<string, Record<string, Cat>> = { operacional: {}, investimento: {}, financiamento: {} };
  const despOpPorMes: Record<string, number> = {};
  for (const r of reqs) {
    const d = r.vencimento || r.createdAt; if (!inRange(d)) continue;
    const m = ym(d); meses.add(m);
    const v = Number(r.valor || 0);
    const cat = r.categoriaRef;
    const bloco = cat?.bloco || "operacional";
    const grupo = cat?.grupo || "Sem categoria";
    const nome = cat?.nome || (r.categoria || "Sem categoria");
    const key = `${grupo} › ${nome}`;
    const dest = blocos[bloco] || (blocos[bloco] = {});
    const c = (dest[key] = dest[key] || { grupo, nome, total: 0, porMes: {} });
    c.total += v; add(c.porMes, m, v);
    if (bloco === "operacional") add(despOpPorMes, m, v);
  }

  const mesesArr = [...meses].sort();
  const round = (n: number) => Math.round(n);
  const cats = (o: Record<string, Cat>) => Object.values(o).map((c) => ({ grupo: c.grupo, nome: c.nome, total: round(c.total), porMes: Object.fromEntries(Object.entries(c.porMes).map(([k, x]) => [k, round(x)])) })).sort((a, b) => b.total - a.total);

  const receitaTotal = Object.values(receitaPorMes).reduce((s, v) => s + v, 0);
  const despOpTotal = Object.values(despOpPorMes).reduce((s, v) => s + v, 0);
  const resultadoPorMes: Record<string, number> = {};
  for (const m of mesesArr) resultadoPorMes[m] = round((receitaPorMes[m] || 0) - (despOpPorMes[m] || 0));

  await logAudit({ req, user, action: "view", entity: "config", companyId, meta: "DRE competência" });

  return NextResponse.json({
    regime: "competência (data de vencimento)",
    meses: mesesArr,
    receitas: { total: round(receitaTotal), porMes: Object.fromEntries(Object.entries(receitaPorMes).map(([k, v]) => [k, round(v)])), categorias: cats(receitaPorCat as any) },
    despesasOperacional: { total: round(despOpTotal), porMes: Object.fromEntries(Object.entries(despOpPorMes).map(([k, v]) => [k, round(v)])), categorias: cats(blocos.operacional) },
    resultadoOperacional: { total: round(receitaTotal - despOpTotal), porMes: resultadoPorMes },
    naoOperacional: { investimento: cats(blocos.investimento), financiamento: cats(blocos.financiamento) },
  });
}
