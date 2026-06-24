import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany, approversOf } from "@/lib/finance";
import { getInterConfig, getExtrato } from "@/lib/inter";

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
          const valor = Number(t.valor || 0);
          const descricao = t.descricao || t.detalhes?.descricaoOperacao || t.titulo || "";
          const k = `${data}|${tipo}|${valor}|${descricao}`;
          if (seen.has(k)) continue; seen.add(k);
          const c = classifica(tipo, `${descricao} ${t.titulo || ""}`);
          out.push({ origem: "extrato", data, tipo, valor, descricao, grupo: c?.grupo || "", categoria: c?.nome || "", bloco: c?.bloco || "", status: "" });
        }
      }
    } catch (e: any) { return NextResponse.json({ error: `Inter recusou o extrato: ${e.message}`, parcial: out }, { status: 400 }); }
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
