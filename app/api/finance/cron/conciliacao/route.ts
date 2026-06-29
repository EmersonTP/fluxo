import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { getClassifier, getLancamentos } from "@/lib/ledger";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
function ymd(d: Date) { return d.toISOString().slice(0, 10); }
const brl = (v: number) => "R$ " + (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Roda a conciliação de cada empresa (financeiro) e posta o resumo no canal #financeiro do chat.
// Pensado p/ rodar no agendamento diário (chamado via MCP `conciliacao_chat`).
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user; // aceita x-api-key (mesmo do MCP)

  const companies = await prisma.company.findMany({ where: { modules: { contains: "financeiro" } }, select: { id: true, name: true } });
  const hoje = new Date();
  const de = ymd(new Date(hoje.getTime() - 90 * 864e5));
  const out: any[] = [];

  for (const co of companies) {
    const classifica = await getClassifier(co.id);
    const lanc = await getLancamentos(co.id, de, ymd(hoje), {});
    let semCat = 0, semCatValor = 0;
    for (const l of lanc) { if (!l.override && !classifica(l.tipo, l.descricao)) { semCat++; semCatValor += l.valor; } }

    const apagar = await prisma.paymentRequest.findMany({ where: { companyId: co.id, status: { notIn: ["paga", "recusada", "cancelada"] } }, select: { valor: true, vencimento: true } });
    let apVenc = 0, apVencV = 0; for (const r of apagar) if (r.vencimento && r.vencimento < hoje) { apVenc++; apVencV += r.valor || 0; }

    const arec = await prisma.receivable.findMany({ where: { companyId: co.id, status: { in: ["pendente", "vencida"] } }, select: { valorCents: true, vencimento: true, status: true } });
    let arVenc = 0, arVencV = 0; for (const r of arec) { const v = (r.valorCents || 0) / 100; if (r.status === "vencida" || (r.vencimento && r.vencimento < hoje)) { arVenc++; arVencV += v; } }

    const naoConc = await prisma.bankTransaction.count({ where: { companyId: co.id, conciliado: false, account: { tipo: { not: "cartao" } } } });

    const linhas: string[] = [];
    if (semCat) linhas.push(`🟠 ${semCat} lançamento(s) sem categoria (${brl(semCatValor)}) — identifique na Conciliação.`);
    if (apVenc) linhas.push(`🔴 ${apVenc} conta(s) a pagar vencida(s) (${brl(apVencV)}).`);
    if (arVenc) linhas.push(`🟡 ${arVenc} recebível(is) vencido(s) (${brl(arVencV)}).`);
    if (naoConc) linhas.push(`🔵 ${naoConc} lançamento(s) do extrato não conciliado(s) — amarrar na Conciliação.`);
    const corpo = linhas.length ? linhas.join("\n") : "✅ Tudo conciliado: sem pendências.";
    const texto = `*Conciliação Sandra — ${hoje.toLocaleDateString("pt-BR")}*\n${corpo}`;

    // canal #financeiro (ou cria)
    let canal = await prisma.channel.findFirst({ where: { companyId: co.id, kind: "channel", name: { contains: "financ", mode: "insensitive" } }, select: { id: true } });
    if (!canal) {
      const aprov = await prisma.approverConfig.findMany({ where: { companyId: co.id }, select: { userId: true } });
      const ids = [...new Set(aprov.map((a: any) => a.userId).filter(Boolean))];
      canal = await prisma.channel.create({ data: { companyId: co.id, name: "financeiro", kind: "channel", members: ids.length ? { connect: ids.map((id) => ({ id })) } : undefined }, select: { id: true } });
    }
    await prisma.chatMessage.create({ data: { channelId: canal.id, text: texto, userId: null } });
    out.push({ company: co.name, semCat, apVenc, arVenc, postado: true });
  }

  await logAudit({ req, user, action: "create", entity: "config", meta: `conciliação agendada postada em ${out.length} empresa(s)` });
  return NextResponse.json({ ok: true, empresas: out });
}
