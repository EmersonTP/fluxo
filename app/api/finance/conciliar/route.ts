import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";
import { getClassifier } from "@/lib/ledger";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
const ymd = (d: Date) => d.toISOString().slice(0, 10);

// Conciliação: lista lançamentos do extrato e sugere o pagamento/recebimento que casa (mesmo valor).
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  const ate = url.searchParams.get("ate") || ymd(new Date());
  const de = url.searchParams.get("de") || ymd(new Date(Date.now() - 90 * 86400000));
  const soPendentes = url.searchParams.get("pendentes") === "1";

  // lançamentos de contas de caixa (cartão fica de fora da conciliação)
  const txs: any[] = await prisma.bankTransaction.findMany({
    where: { companyId, data: { gte: new Date(de + "T00:00:00"), lte: new Date(ate + "T23:59:59") }, account: { tipo: { not: "cartao" } }, ...(soPendentes ? { conciliado: false } : {}) },
    include: { account: { select: { nome: true } }, categoria: { select: { grupo: true, nome: true } } }, orderBy: { data: "desc" },
  });

  // candidatos: contas a pagar (não canceladas/recusadas) e a receber, ainda não amarrados
  const pagar: any[] = await prisma.paymentRequest.findMany({ where: { companyId, status: { notIn: ["cancelada", "recusada"] } }, select: { id: true, descricao: true, areaName: true, valor: true, status: true, vencimento: true, credor: { select: { nome: true } } } });
  const receber: any[] = await prisma.receivable.findMany({ where: { companyId, status: { notIn: ["cancelada", "estornada"] } }, select: { id: true, descricao: true, valorCents: true, status: true, vencimento: true, metodo: true, cliente: { select: { nome: true } } } });
  const classifica = await getClassifier(companyId);
  const categorias = await prisma.categoria.findMany({ where: { companyId }, select: { id: true, grupo: true, nome: true }, orderBy: [{ grupo: "asc" }, { nome: "asc" }] });
  const contas = await prisma.bankAccount.findMany({ where: { companyId, tipo: { not: "cartao" } }, select: { id: true, nome: true, tipo: true }, orderBy: { ordem: "asc" } });

  const round = (n: number) => Math.round(Math.abs(n));
  const out = txs.map((t) => {
    const v = round(t.valor);
    const sugestoes = t.tipo === "debito"
      ? pagar.filter((p) => round(p.valor) === v).slice(0, 5).map((p) => ({ tipo: "pagar", id: p.id, descricao: p.descricao || p.areaName, valor: Math.round(p.valor), status: p.status, vencimento: p.vencimento ? ymd(p.vencimento as Date) : null, contraparte: p.credor?.nome || p.areaName || "", metodo: null }))
      : receber.filter((r) => round(r.valorCents / 100) === v).slice(0, 5).map((r) => ({ tipo: "receber", id: r.id, descricao: r.descricao, valor: Math.round(r.valorCents / 100), status: r.status, vencimento: r.vencimento ? ymd(r.vencimento as Date) : null, contraparte: r.cliente?.nome || "", metodo: r.metodo || null }));
    const cat = t.categoria ? { grupo: t.categoria.grupo, nome: t.categoria.nome } : (classifica(t.tipo, t.descricao) || null);
    return { id: t.id, data: ymd(t.data as Date), descricao: t.descricao, valor: Math.round(t.valor), tipo: t.tipo, conta: t.account?.nome, categoria: cat ? `${cat.grupo} › ${cat.nome}` : null, conciliado: t.conciliado, requestId: t.requestId, sugestoes };
  });
  const totalPend = out.filter((x) => !x.conciliado).length;
  return NextResponse.json({ periodo: { de, ate }, total: out.length, pendentes: totalPend, lancamentos: out, categorias, contas });
}

// Amarra (ou desamarra) um lançamento a um pagamento/recebimento, ou marca conciliado avulso.
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const b = await req.json();

  // Conciliação automática por padrões: marca os lançamentos "auto-conciliáveis"
  // (transferências, CDB/aplicação, fatura, tarifas — pelas regras/descrição) e os que casam por valor único.
  if (b.action === "auto") {
    const companyId = b.companyId || "";
    if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const classifica = await getClassifier(companyId);
    const GRUPOS = new Set(["Transferência entre contas", "Aplicações Financeiras", "Aporte de Sócios", "Financeiras"]);
    const PAT = /RESGATE|APLICA|CDB|GARANTIA|RENDIMENTO|FATURA|IOF|TARIFA/i;
    const txs: any[] = await prisma.bankTransaction.findMany({ where: { companyId, conciliado: false, account: { tipo: { not: "cartao" } } }, include: { categoria: { select: { grupo: true, nome: true } } } });
    const pagar: any[] = await prisma.paymentRequest.findMany({ where: { companyId, status: { notIn: ["cancelada", "recusada"] } }, select: { id: true, valor: true } });
    const receber: any[] = await prisma.receivable.findMany({ where: { companyId, status: { notIn: ["cancelada", "estornada"] } }, select: { id: true, valorCents: true } });
    const r2 = (n: number) => Math.round(Math.abs(n));
    let auto = 0;
    for (const tx of txs) {
      const cat: any = tx.categoria ? { grupo: tx.categoria.grupo, nome: tx.categoria.nome } : classifica(tx.tipo, tx.descricao);
      let conc = false; let reqId: string | null = null;
      if (cat && (GRUPOS.has(cat.grupo) || String(cat.nome || "").includes("Reembolso a sócios"))) conc = true;
      else if (PAT.test(tx.descricao || "")) conc = true;
      else { const v = r2(tx.valor); const cands = tx.tipo === "debito" ? pagar.filter((p) => r2(p.valor) === v) : receber.filter((r) => r2((r.valorCents || 0) / 100) === v); if (cands.length === 1) { conc = true; reqId = cands[0].id; } }
      if (conc) { await prisma.bankTransaction.update({ where: { id: tx.id }, data: { conciliado: true, ...(reqId ? { requestId: reqId } : {}) } }); auto++; }
    }
    await logAudit({ req, user, action: "update", entity: "extrato", companyId, meta: `conciliação automática: ${auto}/${txs.length}` });
    return NextResponse.json({ ok: true, auto, total: txs.length, restantes: txs.length - auto });
  }

  // CASAR MÚLTIPLO: 1 recebimento (Pix) que pagou vários pacientes -> amarra a N recebíveis.
  if (b.action === "casar_multiplo") {
    const ids: string[] = Array.isArray(b.requestIds) ? b.requestIds.filter(Boolean) : [];
    if (!b.transactionId || ids.length === 0) return NextResponse.json({ error: "Informe o recebimento e ao menos um pagamento." }, { status: 400 });
    const tx = await prisma.bankTransaction.findUnique({ where: { id: b.transactionId }, select: { companyId: true } });
    if (!tx || !canAccessCompany(user, tx.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const recs = await prisma.receivable.findMany({ where: { id: { in: ids }, companyId: tx.companyId }, select: { id: true } });
    const okIds = recs.map((r) => r.id);
    if (okIds.length === 0) return NextResponse.json({ error: "Pagamentos não encontrados." }, { status: 400 });
    await prisma.bankTransaction.update({ where: { id: b.transactionId }, data: { conciliado: true, requestId: okIds[0] } });
    await prisma.receivable.updateMany({ where: { id: { in: okIds } }, data: { conciliadoManual: true, conciliadoTxId: b.transactionId } });
    await logAudit({ req, user, action: "update", entity: "extrato", entityId: b.transactionId, companyId: tx.companyId, meta: `casar múltiplo: ${okIds.length} pagamentos` });
    return NextResponse.json({ ok: true, casados: okIds.length });
  }

  // CATEGORIZAR: atribui o recebimento a 1 ou MAIS pacientes (com valor cada) — pagamento que cruza vários clientes.
  // Cria um recebível PAGO por linha (dá lastro + histórico por paciente) e concilia o crédito. Não depende de título prévio.
  if (b.action === "categorizar") {
    const linhas: any[] = Array.isArray(b.linhas) ? b.linhas.filter((l: any) => l && l.clienteId && Number(l.valorCents) > 0) : [];
    if (!b.transactionId || linhas.length === 0) return NextResponse.json({ error: "Informe o recebimento e ao menos um paciente com valor." }, { status: 400 });
    const tx = await prisma.bankTransaction.findUnique({ where: { id: b.transactionId }, select: { companyId: true, data: true, descricao: true } });
    if (!tx || !canAccessCompany(user, tx.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const cliIds = [...new Set(linhas.map((l) => l.clienteId))];
    const clientes = await prisma.cliente.findMany({ where: { id: { in: cliIds }, companyId: tx.companyId }, select: { id: true } });
    const okset = new Set(clientes.map((c) => c.id));
    const validas = linhas.filter((l) => okset.has(l.clienteId));
    if (validas.length === 0) return NextResponse.json({ error: "Pacientes não encontrados nesta empresa." }, { status: 400 });
    for (const l of validas) {
      await prisma.receivable.create({ data: {
        companyId: tx.companyId, clienteId: l.clienteId,
        descricao: (l.descricao || "Recebimento conciliado").slice(0, 140),
        valorCents: Math.round(Number(l.valorCents)), status: "paga",
        pagoEm: tx.data, vencimento: tx.data, metodo: "pix", origem: "conciliacao",
        provider: "manual", conciliadoManual: true, conciliadoTxId: b.transactionId,
      } });
    }
    await prisma.bankTransaction.update({ where: { id: b.transactionId }, data: { conciliado: true, requestId: null, ...(b.categoriaId ? { categoriaId: b.categoriaId } : {}) } });
    await logAudit({ req, user, action: "update", entity: "extrato", entityId: b.transactionId, companyId: tx.companyId, meta: `categorizar: ${validas.length} paciente(s)` });
    return NextResponse.json({ ok: true, criados: validas.length });
  }

  // RECEITA AVULSA: dá lastro num recebimento que NÃO é mensalidade (ex.: sessões perdidas). Sem consumir título.
  if (b.action === "avulsa") {
    const tx = await prisma.bankTransaction.findUnique({ where: { id: b.transactionId }, select: { companyId: true } });
    if (!tx || !canAccessCompany(user, tx.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const data: Record<string, unknown> = { conciliado: true, requestId: null };
    if (b.categoriaId) data.categoriaId = b.categoriaId;
    await prisma.bankTransaction.update({ where: { id: b.transactionId }, data });
    await logAudit({ req, user, action: "update", entity: "extrato", entityId: b.transactionId, companyId: tx.companyId, meta: "receita avulsa (não-mensalidade)" });
    return NextResponse.json({ ok: true });
  }

  const t = await prisma.bankTransaction.findUnique({ where: { id: b.transactionId }, select: { companyId: true } });
  if (!t || !canAccessCompany(user, t.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const data: Record<string, unknown> = {};
  if (b.action === "desconciliar") { data.conciliado = false; data.requestId = null; await prisma.receivable.updateMany({ where: { conciliadoTxId: b.transactionId }, data: { conciliadoManual: false, conciliadoTxId: null } }); }
  else { data.conciliado = true; if (b.requestId) data.requestId = b.requestId; }
  await prisma.bankTransaction.update({ where: { id: b.transactionId }, data });
  await logAudit({ req, user, action: "update", entity: "extrato", entityId: b.transactionId, companyId: t.companyId, meta: b.action || "conciliar" });
  return NextResponse.json({ ok: true });
}
