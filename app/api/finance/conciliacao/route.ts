import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";
import { getInterConfig, getExtrato } from "@/lib/inter";

export const runtime = "nodejs";

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function chunksMensais(de: string, ate: string): [string, string][] {
  const out: [string, string][] = []; let cur = new Date(de + "T00:00:00"); const fim = new Date(ate + "T00:00:00");
  while (cur <= fim) {
    const ini = new Date(cur.getFullYear(), cur.getMonth(), 1); const fimMes = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    out.push([ymd(ini > new Date(de + "T00:00:00") ? ini : new Date(de + "T00:00:00")), ymd(fimMes < fim ? fimMes : fim)]);
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return out;
}

// Conciliação/vigilância: cruza extrato + contas + regras e aponta o que não está batendo ou está manual.
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });

  // janela: últimos ~90 dias (3 chunks) por padrão
  const ate = url.searchParams.get("ate") || ymd(new Date());
  const de = url.searchParams.get("de") || ymd(new Date(Date.now() - 90 * 86400000));

  const regras: any[] = await prisma.categoriaRegra.findMany({ where: { companyId }, orderBy: { prioridade: "desc" }, include: { categoria: { select: { nome: true } } } });
  const match = (tipo: string, txt: string) => { const up = (txt || "").toUpperCase(); for (const r of regras) { if (r.aplicaA !== "ambos" && r.aplicaA !== tipo) continue; if (up.includes(r.padrao)) return true; } return false; };

  const alertas: { sev: "critico" | "atencao" | "ok"; texto: string }[] = [];
  const naoCat: { data: string; tipo: string; valor: number; descricao: string; origem: string }[] = [];
  let ultimoExtrato = "";

  // 1) extrato Inter
  const cfg = await getInterConfig(companyId);
  if (cfg) {
    try {
      const seen = new Set<string>();
      for (const [d1, d2] of chunksMensais(de, ate)) {
        const raw: any = await getExtrato(cfg, d1, d2);
        const lista: any[] = Array.isArray(raw?.transacoes) ? raw.transacoes : Array.isArray(raw) ? raw : [];
        for (const t of lista) {
          const data = (t.dataEntrada || t.dataInclusao || t.data || "").slice(0, 10);
          const tipo = (t.tipoOperacao || t.tipo || "").toUpperCase() === "C" ? "credito" : "debito";
          const valor = Number(t.valor || 0); const descricao = t.descricao || t.detalhes?.descricaoOperacao || t.titulo || "";
          const k = `${data}|${tipo}|${valor}|${descricao}`; if (seen.has(k)) continue; seen.add(k);
          if (data > ultimoExtrato) ultimoExtrato = data;
          if (!match(tipo, `${descricao} ${t.titulo || ""}`)) naoCat.push({ data, tipo, valor, descricao: descricao.slice(0, 50), origem: "Inter" });
        }
      }
    } catch (e: any) { alertas.push({ sev: "atencao", texto: `Extrato Inter não pôde ser lido agora (${e.message}). Tente de novo em instantes.` }); }
  } else alertas.push({ sev: "atencao", texto: "Banco Inter não conectado." });

  // 2) contas bancárias (frescor + não categorizado)
  const contas = await prisma.bankAccount.findMany({ where: { companyId }, include: { transacoes: { orderBy: { data: "desc" }, take: 1 } } });
  const contasOut: { nome: string; conexao: string; ultimo: string | null; total: number }[] = [];
  for (const c of contas as any[]) {
    const txs: any[] = await prisma.bankTransaction.findMany({ where: { accountId: c.id }, select: { data: true, tipo: true, valor: true, descricao: true } });
    const ultimo = txs.length ? txs.map((t) => t.data).sort((a, b) => (a > b ? -1 : 1))[0] : null;
    contasOut.push({ nome: c.nome, conexao: c.conexao, ultimo: ultimo ? ymd(ultimo as Date) : null, total: txs.length });
    for (const t of txs) { if (!match(t.tipo || "debito", t.descricao || "")) naoCat.push({ data: ymd(t.data as Date), tipo: t.tipo, valor: Math.abs(Number(t.valor)), descricao: (t.descricao || "").slice(0, 50), origem: c.nome }); }
    // frescor: conta sem lançamento no mês corrente
    const mesAtual = new Date().toISOString().slice(0, 7);
    if (c.conexao === "manual" && (!ultimo || ymd(ultimo as Date).slice(0, 7) < mesAtual)) alertas.push({ sev: "atencao", texto: `Conta "${c.nome}" sem lançamentos no mês atual — reimportar extrato/fatura.` });
  }

  // 3) só Inter conectado? sugerir outras contas
  if (!contas.some((c: any) => c.nome.toUpperCase().includes("C6"))) alertas.push({ sev: "atencao", texto: "Conta C6 não cadastrada — aportes/movimentos do C6 ficam fora dos relatórios." });

  // 4) não categorizado
  const totalNaoCat = naoCat.reduce((s, x) => s + x.valor, 0);
  if (naoCat.length) alertas.push({ sev: "critico", texto: `${naoCat.length} lançamento(s) sem categoria (R$ ${totalNaoCat.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) — criam furo nos relatórios até receberem regra.` });
  else alertas.push({ sev: "ok", texto: "Todos os lançamentos do período estão categorizados." });

  naoCat.sort((a, b) => b.valor - a.valor);
  return NextResponse.json({
    periodo: { de, ate }, ultimoExtrato,
    contas: contasOut,
    naoCategorizado: { qtd: naoCat.length, valor: Math.round(totalNaoCat), itens: naoCat.slice(0, 25) },
    alertas,
  });
}
