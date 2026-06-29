import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany, approversOf } from "@/lib/finance";
import { getLancamentos } from "@/lib/ledger";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
const ym = (s: string) => (s || "").slice(0, 7);
function chunksMensais(de: string, ate: string): [string, string][] {
  const out: [string, string][] = []; let cur = new Date(de + "T00:00:00"); const fim = new Date(ate + "T00:00:00");
  while (cur <= fim) {
    const ini = new Date(cur.getFullYear(), cur.getMonth(), 1); const fimMes = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    out.push([ymd(ini > new Date(de + "T00:00:00") ? ini : new Date(de + "T00:00:00")), ymd(fimMes < fim ? fimMes : fim)]);
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return out;
}

// DRE por competência aproximada (data do movimento; cartão na data da compra),
// lida dos lançamentos REAIS: extrato Inter + contas bancárias (cartão TP, C6…) + recebíveis.
// Cada categoria traz os lançamentos que a compõem (drill-down).
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const fin = await approversOf(companyId);
  if (!isAdmin(user) && !fin.financeiros.includes(user.id)) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });

  const de = url.searchParams.get("de") || ymd(new Date(2025, 11, 1));
  const ate = url.searchParams.get("ate") || ymd(new Date());
  const regime = url.searchParams.get("regime") || "competencia";

  const regras: any[] = await prisma.categoriaRegra.findMany({
    where: { companyId }, orderBy: { prioridade: "desc" },
    include: { categoria: { select: { grupo: true, nome: true, bloco: true, tipo: true } } },
  });
  const classifica = (tipo: string, txt: string) => {
    const up = (txt || "").toUpperCase();
    for (const r of regras) { if (r.aplicaA !== "ambos" && r.aplicaA !== tipo) continue; if (up.includes(r.padrao)) return r.categoria; }
    return null;
  };

  // ---- Regime de CAIXA: demonstrativo no formato DRE, mas pela data do pagamento ----
  // Tudo que entrou/saiu das contas de caixa (cartão e sócio ficam fora), agrupado por categoria.
  if (regime === "caixa") {
    type CatC = { grupo: string; nome: string; total: number; porMes: Record<string, number>; itens: { data: string; descricao: string; valor: number }[] };
    const meses = new Set<string>();
    const ent: Record<string, CatC> = {}, sai: Record<string, CatC> = {};
    const push = (store: Record<string, CatC>, grupo: string, nome: string, l: any) => {
      const key = `${grupo} › ${nome}`; const c = (store[key] = store[key] || { grupo, nome, total: 0, porMes: {}, itens: [] });
      const m = ym(l.data); if (m) meses.add(m);
      c.total += l.valor; c.porMes[m] = (c.porMes[m] || 0) + l.valor; c.itens.push({ data: l.data, descricao: (l.descricao || "").slice(0, 60), valor: Math.round(l.valor) });
    };
    const bancoC = await getLancamentos(companyId, de, ate, { apenasCaixa: true });
    for (const t of bancoC) {
      const c = t.override || classifica(t.tipo, t.descricao);
      const grupo = c?.grupo || "Sem categoria"; const nome = c?.nome || "Não categorizado";
      push(t.tipo === "credito" ? ent : sai, grupo, nome, t);
    }
    const round = (n: number) => Math.round(n);
    const fmt = (store: Record<string, CatC>) => Object.values(store)
      .map((c) => ({ grupo: c.grupo, nome: c.nome, total: round(c.total), porMes: Object.fromEntries(Object.entries(c.porMes).map(([k, v]) => [k, round(v)])), itens: c.itens.sort((a, b) => (a.data < b.data ? -1 : 1)) }))
      .sort((a, b) => b.total - a.total);
    const somaMes = (store: Record<string, CatC>) => { const o: Record<string, number> = {}; for (const c of Object.values(store)) for (const [m, v] of Object.entries(c.porMes)) o[m] = (o[m] || 0) + v; return o; };
    const totalOf = (store: Record<string, CatC>) => Object.values(store).reduce((s, c) => s + c.total, 0);
    const mesesArr = [...meses].sort();
    const entMes = somaMes(ent), saiMes = somaMes(sai);
    const varMes: Record<string, number> = {};
    for (const m of mesesArr) varMes[m] = round((entMes[m] || 0) - (saiMes[m] || 0));
    return NextResponse.json({
      regime: "caixa (data do pagamento)",
      meses: mesesArr,
      receitas: { total: round(totalOf(ent)), porMes: Object.fromEntries(Object.entries(entMes).map(([k, v]) => [k, round(v)])), categorias: fmt(ent) },
      despesasOperacional: { total: round(totalOf(sai)), porMes: Object.fromEntries(Object.entries(saiMes).map(([k, v]) => [k, round(v)])), categorias: fmt(sai) },
      resultadoOperacional: { total: round(totalOf(ent) - totalOf(sai)), porMes: varMes },
      naoOperacional: { investimento: [], financiamento: [] },
    });
  }

  type Lanc = { data: string; tipo: string; valor: number; descricao: string; cat: any };
  const lancs: Lanc[] = [];

  const banco = await getLancamentos(companyId, de, ate);
  for (const t of banco) lancs.push({ data: t.data, tipo: t.tipo, valor: t.valor, descricao: t.descricao, cat: t.override || classifica(t.tipo, t.descricao) });

  // agrega
  const meses = new Set<string>();
  type Cat = { grupo: string; nome: string; total: number; porMes: Record<string, number>; itens: { data: string; descricao: string; valor: number }[] };
  const mk = (): Record<string, Cat> => ({});
  const rec: Record<string, Cat> = mk(), desp: Record<string, Cat> = mk(), inv: Record<string, Cat> = mk(), finc: Record<string, Cat> = mk();
  const push = (store: Record<string, Cat>, grupo: string, nome: string, l: Lanc) => {
    const key = `${grupo} › ${nome}`; const c = (store[key] = store[key] || { grupo, nome, total: 0, porMes: {}, itens: [] });
    const m = ym(l.data); if (m) meses.add(m);
    c.total += l.valor; c.porMes[m] = (c.porMes[m] || 0) + l.valor; c.itens.push({ data: l.data, descricao: l.descricao.slice(0, 60), valor: Math.round(l.valor) });
  };
  for (const l of lancs) {
    const c = l.cat; const bloco = c?.bloco || (l.tipo === "credito" ? "" : "operacional");
    if (l.tipo === "credito") {
      if (c?.tipo === "receita" && bloco === "operacional") push(rec, c.grupo, c.nome, l);
      else if (bloco === "financiamento") push(finc, c?.grupo || "Aporte de Sócios", c?.nome || "Aporte", l);
      // outros créditos (resgates, etc.) ignorados no resultado
    } else {
      if (bloco === "investimento") push(inv, c?.grupo || "Investimento", c?.nome || "—", l);
      else if (bloco === "financiamento") push(finc, c?.grupo || "Partes Relacionadas", c?.nome || "—", l);
      else if (bloco === "interno") { /* transferência: fora do resultado */ }
      else push(desp, c?.grupo || "Sem categoria", c?.nome || "Não categorizado", l);
    }
  }

  const round = (n: number) => Math.round(n);
  const fmt = (store: Record<string, Cat>) => Object.values(store)
    .map((c) => ({ grupo: c.grupo, nome: c.nome, total: round(c.total), porMes: Object.fromEntries(Object.entries(c.porMes).map(([k, v]) => [k, round(v)])), itens: c.itens.sort((a, b) => (a.data < b.data ? -1 : 1)) }))
    .sort((a, b) => b.total - a.total);
  const somaMes = (store: Record<string, Cat>) => { const o: Record<string, number> = {}; for (const c of Object.values(store)) for (const [m, v] of Object.entries(c.porMes)) o[m] = (o[m] || 0) + v; return o; };
  const totalOf = (store: Record<string, Cat>) => Object.values(store).reduce((s, c) => s + c.total, 0);

  const mesesArr = [...meses].sort();
  const recMes = somaMes(rec), despMes = somaMes(desp);
  const resultadoPorMes: Record<string, number> = {};
  for (const m of mesesArr) resultadoPorMes[m] = round((recMes[m] || 0) - (despMes[m] || 0));

  await logAudit({ req, user, action: "view", entity: "config", companyId, meta: "DRE drill-down" });

  return NextResponse.json({
    regime: "competência aproximada (data do movimento; cartão na data da compra)",
    meses: mesesArr,
    receitas: { total: round(totalOf(rec)), porMes: Object.fromEntries(Object.entries(recMes).map(([k, v]) => [k, round(v)])), categorias: fmt(rec) },
    despesasOperacional: { total: round(totalOf(desp)), porMes: Object.fromEntries(Object.entries(despMes).map(([k, v]) => [k, round(v)])), categorias: fmt(desp) },
    resultadoOperacional: { total: round(totalOf(rec) - totalOf(desp)), porMes: resultadoPorMes },
    naoOperacional: { investimento: fmt(inv), financiamento: fmt(finc) },
  });
}
