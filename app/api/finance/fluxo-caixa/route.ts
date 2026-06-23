import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany, approversOf } from "@/lib/finance";
import { getInterConfig, getExtrato } from "@/lib/inter";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function ym(s: string) { return (s || "").slice(0, 7); }

// Lista [de,ate] por mês entre duas datas (respeita limite de período do Inter).
function chunksMensais(de: string, ate: string): [string, string][] {
  const out: [string, string][] = [];
  let cur = new Date(de + "T00:00:00");
  const fim = new Date(ate + "T00:00:00");
  while (cur <= fim) {
    const ini = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const fimMes = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    out.push([ymd(ini > new Date(de + "T00:00:00") ? ini : new Date(de + "T00:00:00")), ymd(fimMes < fim ? fimMes : fim)]);
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return out;
}

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

  const cfg = await getInterConfig(companyId);
  if (!cfg) return NextResponse.json({ error: "Inter não conectado." }, { status: 400 });

  // 1) extrato (por mês)
  let lanc: { data: string | null; tipo: string; valor: number; descricao: string; titulo: string }[] = [];
  try {
    for (const [d1, d2] of chunksMensais(de, ate)) {
      const raw: any = await getExtrato(cfg, d1, d2);
      const lista: any[] = Array.isArray(raw?.transacoes) ? raw.transacoes : Array.isArray(raw) ? raw : [];
      for (const t of lista) {
        lanc.push({
          data: t.dataEntrada || t.dataInclusao || t.data || null,
          tipo: (t.tipoOperacao || t.tipo || "").toUpperCase() === "C" ? "credito" : "debito",
          valor: Number(t.valor || 0),
          descricao: t.descricao || t.detalhes?.descricaoOperacao || "",
          titulo: t.titulo || t.tipoTransacao || "",
        });
      }
    }
  } catch (e: any) {
    return NextResponse.json({ error: `Inter recusou o extrato: ${e.message}` }, { status: 400 });
  }
  // dedupe
  const seen = new Set<string>();
  lanc = lanc.filter((l) => { const k = `${l.data}|${l.tipo}|${l.valor}|${l.descricao}`; if (seen.has(k)) return false; seen.add(k); return true; });

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

  // 3) agrega por bloco › categoria › mês
  type Cat = { grupo: string; nome: string; entrada: number; saida: number; porMes: Record<string, number> };
  const blocos: Record<string, { entrada: number; saida: number; cats: Record<string, Cat> }> = {};
  const naoCat: { itens: any[]; entrada: number; saida: number } = { itens: [], entrada: 0, saida: 0 };
  const mesesSet = new Set<string>();

  for (const l of lanc) {
    const mes = ym(l.data || "");
    if (mes) mesesSet.add(mes);
    const c = classifica(l);
    const signed = l.tipo === "credito" ? l.valor : -l.valor;
    if (!c) {
      naoCat.itens.push({ data: (l.data || "").slice(0, 10), tipo: l.tipo, valor: Math.round(l.valor), descricao: (l.descricao || l.titulo).slice(0, 40) });
      if (l.tipo === "credito") naoCat.entrada += l.valor; else naoCat.saida += l.valor;
      continue;
    }
    const b = (blocos[c.bloco] = blocos[c.bloco] || { entrada: 0, saida: 0, cats: {} });
    const key = `${c.grupo} › ${c.nome}`;
    const cat = (b.cats[key] = b.cats[key] || { grupo: c.grupo, nome: c.nome, entrada: 0, saida: 0, porMes: {} });
    if (l.tipo === "credito") { cat.entrada += l.valor; b.entrada += l.valor; } else { cat.saida += l.valor; b.saida += l.valor; }
    cat.porMes[mes] = (cat.porMes[mes] || 0) + signed;
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

  await logAudit({ req, user, action: "view", entity: "config", companyId, meta: `fluxo de caixa ${de}…${ate}` });

  return NextResponse.json({
    periodo: { de, ate }, meses,
    blocos: blocosOut,
    naoCategorizado: { entrada: round(naoCat.entrada), saida: round(naoCat.saida), itens: naoCat.itens.sort((a, b) => b.valor - a.valor).slice(0, 40) },
    resumo,
  });
}
