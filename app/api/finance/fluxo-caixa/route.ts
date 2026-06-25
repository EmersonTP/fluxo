import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany, approversOf } from "@/lib/finance";
import { getLancamentos } from "@/lib/ledger";
import { getInterConfig, getSaldo } from "@/lib/inter";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function ym(s: string) { return (s || "").slice(0, 7); }

export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const fin = await approversOf(companyId);
  if (!isAdmin(user) && !fin.financeiros.includes(user.id)) return NextResponse.json({ error: "Acesso restrito ao financeiro." }, { status: 403 });

  const hoje = new Date();
  const de = url.searchParams.get("de") || ymd(new Date(2026, 2, 1)); // mar/2026
  const ate = url.searchParams.get("ate") || ymd(hoje);

  // 1) lancamentos de caixa (extrato Inter sincronizado + contas manuais; cartao fica de fora)
  const banco = await getLancamentos(companyId, de, ate, { apenasCaixa: true });
  const lanc = banco.map((t) => ({ data: t.data as string | null, tipo: t.tipo, valor: t.valor, descricao: t.descricao, titulo: "", override: t.override }));

  // 2) regras + categorias
  const regras = await prisma.categoriaRegra.findMany({
    where: { companyId },
    orderBy: { prioridade: "desc" },
    include: { categoria: { select: { grupo: true, nome: true, bloco: true, tipo: true } } },
  });
  function classifica(l: { tipo: string; descricao: string; titulo: string }) {
    const txt = `${l.descricao} ${l.titulo}`.toUpperCase();
    for (const r of regras) {
      if (r.aplicaA !== "ambos" && r.aplicaA !== l.tipo) continue;
      if (txt.includes(r.padrao)) return r.categoria;
    }
    return null;
  }

  // 3) agrega por bloco > categoria > mes, guardando os itens p/ drill-down
  type Item = { data: string; tipo: string; valor: number; descricao: string };
  type Cat = { grupo: string; nome: string; entrada: number; saida: number; porMes: Record<string, number>; itens: Item[] };
  const blocos: Record<string, { entrada: number; saida: number; cats: Record<string, Cat> }> = {};
  const naoCat: { itens: Item[]; entrada: number; saida: number } = { itens: [], entrada: 0, saida: 0 };
  const mesesSet = new Set<string>();
  const movMes: Record<string, { entrada: number; saida: number }> = {};

  for (const l of lanc) {
    const mes = ym(l.data || "");
    if (mes) { mesesSet.add(mes); (movMes[mes] = movMes[mes] || { entrada: 0, saida: 0 }); }
    const item: Item = { data: (l.data || "").slice(0, 10), tipo: l.tipo, valor: Math.round(l.valor), descricao: (l.descricao || l.titulo).slice(0, 60) };
    if (l.tipo === "credito") { if (mes) movMes[mes].entrada += l.valor; } else { if (mes) movMes[mes].saida += l.valor; }
    const c = l.override || classifica(l);
    const signed = l.tipo === "credito" ? l.valor : -l.valor;
    if (!c) {
      naoCat.itens.push(item);
      if (l.tipo === "credito") naoCat.entrada += l.valor; else naoCat.saida += l.valor;
      continue;
    }
    const b = (blocos[c.bloco] = blocos[c.bloco] || { entrada: 0, saida: 0, cats: {} });
    const key = `${c.grupo} > ${c.nome}`;
    const cat = (b.cats[key] = b.cats[key] || { grupo: c.grupo, nome: c.nome, entrada: 0, saida: 0, porMes: {}, itens: [] });
    if (l.tipo === "credito") { cat.entrada += l.valor; b.entrada += l.valor; } else { cat.saida += l.valor; b.saida += l.valor; }
    cat.porMes[mes] = (cat.porMes[mes] || 0) + signed;
    cat.itens.push(item);
  }

  const meses = [...mesesSet].sort();
  const round = (n: number) => Math.round(n);
  const blocosOut = ["operacional", "investimento", "financiamento", "interno"].filter((b) => blocos[b]).map((b) => {
    const x = blocos[b];
    return {
      bloco: b,
      entrada: round(x.entrada), saida: round(x.saida), liquido: round(x.entrada - x.saida),
      categorias: Object.values(x.cats).map((c) => ({
        grupo: c.grupo, nome: c.nome, entrada: round(c.entrada), saida: round(c.saida), liquido: round(c.entrada - c.saida),
        porMes: Object.fromEntries(Object.entries(c.porMes).map(([m, v]) => [m, round(v)])),
        itens: c.itens.sort((a, z) => (a.data < z.data ? 1 : -1)).slice(0, 200),
      })).sort((a, b2) => (b2.entrada + b2.saida) - (a.entrada + a.saida)),
    };
  });

  const liq = (b: string) => blocos[b] ? blocos[b].entrada - blocos[b].saida : 0;
  const resumo = {
    operacional: round(liq("operacional")),
    investimento: round(liq("investimento")),
    financiamento: round(liq("financiamento")),
    variacaoCaixa: round(liq("operacional") + liq("investimento") + liq("financiamento")),
  };

  // 4) saldos das contas de caixa (cartao fica de fora) + carimbo da ultima sincronizacao
  const contasCaixa: any[] = await prisma.bankAccount.findMany({ where: { companyId, tipo: { notIn: ["cartao", "socio"] } } });
  const saldos: { nome: string; saldo: number | null }[] = [];
  let ultimoSync: string | null = null;
  for (const c of contasCaixa) {
    if (c.lastSyncAt && (!ultimoSync || c.lastSyncAt > new Date(ultimoSync))) ultimoSync = c.lastSyncAt.toISOString();
    if (c.conexao === "inter") {
      const cfg = await getInterConfig(companyId);
      const s = cfg ? await getSaldo(cfg) : NaN;
      saldos.push({ nome: c.nome, saldo: Number.isNaN(s) ? null : Math.round(s) });
    } else {
      const agg = await prisma.bankTransaction.aggregate({ where: { accountId: c.id }, _sum: { valor: true } });
      saldos.push({ nome: c.nome, saldo: Math.round(Number(agg._sum.valor || 0)) });
    }
  }
  const saldoTotal = saldos.reduce((acc, x) => acc + (x.saldo || 0), 0);

  // 5) evolucao do saldo mes a mes - ancorada no saldo atual real, caminhando de tras pra frente
  const porMes: { mes: string; entradas: number; saidas: number; saldoInicial: number; saldoFinal: number }[] = [];
  const mov = meses.map((m) => ({ mes: m, e: movMes[m]?.entrada || 0, s: movMes[m]?.saida || 0 }));
  const saldoFinalArr: number[] = new Array(mov.length).fill(0);
  for (let i = mov.length - 1; i >= 0; i--) {
    if (i === mov.length - 1) saldoFinalArr[i] = saldoTotal;
    else saldoFinalArr[i] = saldoFinalArr[i + 1] - (mov[i + 1].e - mov[i + 1].s);
  }
  for (let i = 0; i < mov.length; i++) {
    const liquido = mov[i].e - mov[i].s;
    porMes.push({
      mes: mov[i].mes,
      entradas: round(mov[i].e),
      saidas: round(mov[i].s),
      saldoFinal: round(saldoFinalArr[i]),
      saldoInicial: round(saldoFinalArr[i] - liquido),
    });
  }

  await logAudit({ req, user, action: "view", entity: "config", companyId, meta: `fluxo de caixa ${de}...${ate}` });

  return NextResponse.json({
    periodo: { de, ate }, meses,
    saldos, saldoTotal: Math.round(saldoTotal),
    ultimoSync,
    porMes,
    blocos: blocosOut,
    naoCategorizado: { entrada: round(naoCat.entrada), saida: round(naoCat.saida), itens: naoCat.itens.sort((a, b) => b.valor - a.valor).slice(0, 60) },
    resumo,
  });
}
