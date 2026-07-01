import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canActOn, notifyFinance, logStep } from "@/lib/finance";
import { logAudit } from "@/lib/audit";
import { verifyPin } from "@/lib/pin";
import { getInterConfig, pagarPix, pixFoiEfetivado } from "@/lib/inter";

const COTACAO_LIMITE = 400;

// Avança a solicitação na esteira: aprovar_gestor → conferir → pagar. Ou recusar.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const r = await prisma.paymentRequest.findUnique({ where: { id: params.id }, include: { attachments: { select: { tag: true } } } });
  if (!r) return NextResponse.json({ error: "Não encontrada." }, { status: 404 });

  const b = await req.json();
  const action = b.action as string;
  const note = (b.note as string) || null;

  // RECUSAR (em qualquer etapa pendente)
  if (action === "recusar") {
    const stageAction = r.status === "solicitada" ? "aprovar_gestor" : r.status === "aprovada_gestor" ? "conferir" : r.status === "conferida" ? "pagar" : "";
    if (!stageAction) return NextResponse.json({ error: "Solicitação não está pendente." }, { status: 400 });
    if (!(await canActOn(user, r, stageAction))) return NextResponse.json({ error: "Você não é o responsável por esta etapa." }, { status: 403 });
    await prisma.paymentRequest.update({ where: { id: r.id }, data: { status: "recusada", recusaMotivo: note } });
    await logStep(r.id, "recusada", r.status, "recusada", { id: user.id, name: user.name }, note || "Recusada");
    if (r.solicitanteId) await notifyFinance([r.solicitanteId], `Sua solicitação foi recusada por ${user.name}${note ? `: ${note}` : ""}`, user.id);
    return NextResponse.json({ ok: true });
  }

  if (!(await canActOn(user, r, action))) return NextResponse.json({ error: "Você não é o responsável por esta etapa." }, { status: 403 });

  // APROVAR GESTOR
  if (action === "aprovar_gestor") {
    if (r.status !== "solicitada") return NextResponse.json({ error: "Etapa inválida." }, { status: 400 });
    // Cotação obrigatória acima do limite (fluxo padrão), salvo dispensa.
    if (r.kind === "padrao" && r.valor > COTACAO_LIMITE && !r.cotacaoDispensa) {
      const temCotacao = r.attachments.some((a: { tag: string | null }) => a.tag === "cotacao");
      if (!temCotacao) return NextResponse.json({ error: `Acima de R$ ${COTACAO_LIMITE}: anexe as cotações ou marque dispensa (contrato vigente).` }, { status: 400 });
    }
    const data: any = { status: "aprovada_gestor", gestorId: user.id };
    for (const k of ["categoria", "centroCusto", "classeGerencial"]) if (b[k] !== undefined) data[k] = b[k];
    // Classificação obrigatória na aprovação do gestor.
    const cat = b.categoria ?? r.categoria, cc = b.centroCusto ?? r.centroCusto, cg = b.classeGerencial ?? r.classeGerencial;
    if (!cat || !cc || !cg) return NextResponse.json({ error: "Classifique Categoria + Centro de Custo + Classe Gerencial antes de aprovar." }, { status: 400 });
    await prisma.paymentRequest.update({ where: { id: r.id }, data });
    await logStep(r.id, "aprovada_gestor", r.status, "aprovada_gestor", { id: user.id, name: user.name }, note);
    const a = await import("@/lib/finance").then((m) => m.approversOf(r.companyId));
    await notifyFinance(a.financeiros, `Solicitação aprovada pelo gestor (${user.name}) aguarda conferência do financeiro — R$ ${r.valor.toLocaleString("pt-BR")}`, user.id);
    if (r.solicitanteId) await notifyFinance([r.solicitanteId], `Sua solicitação foi aprovada pelo gestor (${user.name}) e seguiu para o financeiro`, user.id);
    return NextResponse.json({ ok: true });
  }

  // CONFERIR (financeiro)
  if (action === "conferir") {
    if (r.status !== "aprovada_gestor") return NextResponse.json({ error: "Etapa inválida." }, { status: 400 });
    const data: any = { status: "conferida", financeiroId: user.id };
    if (b.contaOrigem !== undefined) data.contaOrigem = b.contaOrigem;
    await prisma.paymentRequest.update({ where: { id: r.id }, data });
    await logStep(r.id, "conferida", r.status, "conferida", { id: user.id, name: user.name }, note);
    const a = await import("@/lib/finance").then((m) => m.approversOf(r.companyId));
    await notifyFinance(a.pagadores, `Solicitação conferida pelo financeiro (${user.name}) aguarda pagamento — R$ ${r.valor.toLocaleString("pt-BR")}`, user.id);
    if (r.solicitanteId) await notifyFinance([r.solicitanteId], `Sua solicitação foi conferida pelo financeiro (${user.name}) e aguarda pagamento`, user.id);
    return NextResponse.json({ ok: true });
  }

  // PAGAR (pagador/sócio). Dois modos:
  //  - executar=true: a Sandra dispara o Pix de verdade no Inter (exige PIN + teto + chave do credor).
  //  - executar=false (padrão): só registra a baixa (pagamento feito por fora).
  if (action === "pagar") {
    if (r.status !== "conferida") return NextResponse.json({ error: "Etapa inválida." }, { status: 400 });
    let metaExtra = "";
    if (b.executar) {
      // 1) PIN do pagador
      const u = await prisma.user.findUnique({ where: { id: user.id }, select: { paymentPinHash: true } });
      if (!u?.paymentPinHash) return NextResponse.json({ error: "Defina seu PIN de pagamento em Config antes de pagar pela Sandra." }, { status: 400 });
      if (!verifyPin(String(b.pin || ""), u.paymentPinHash)) return NextResponse.json({ error: "PIN incorreto." }, { status: 403 });
      // 2) Teto da empresa
      const integ = await prisma.integrationConfig.findFirst({ where: { companyId: r.companyId, provider: "inter" }, select: { tetoPagamentoCents: true } });
      const teto = (integ?.tetoPagamentoCents ?? 500000) / 100;
      if (r.valor > teto) return NextResponse.json({ error: `Acima do teto de pagamento automático (R$ ${teto.toLocaleString("pt-BR")}). Pague no app do Inter e marque como pago manualmente.` }, { status: 400 });
      // 3) Chave Pix do credor
      const credor = r.credorId ? await prisma.credor.findUnique({ where: { id: r.credorId }, select: { nome: true, pixKey: true, documento: true } }) : null;
      const chave = (credor?.pixKey || "").trim();
      if (!chave) return NextResponse.json({ error: "O credor não tem chave Pix cadastrada (aba Credores). Cadastre a chave ou pague manualmente." }, { status: 400 });
      // 4) Inter conectado
      const cfg = await getInterConfig(r.companyId);
      if (!cfg) return NextResponse.json({ error: "Inter não conectado nesta empresa." }, { status: 400 });
      // 5) Dispara o Pix
      let resp: any;
      try {
        resp = await pagarPix(cfg, { valor: r.valor, chave, descricao: `${r.code ? "#" + r.code + " " : ""}${r.descricao || ""}`.trim() });
      } catch (e: any) {
        return NextResponse.json({ error: `Falha ao enviar o Pix no Inter: ${e?.message || e}. Verifique se a aplicação do Inter tem o escopo de pagamento habilitado.` }, { status: 502 });
      }
      const cod = resp?.codigoSolicitacao || resp?.endToEndId || "";
      const tipoRetorno = resp?.tipoRetorno || "";
      metaExtra = ` · Pix Inter${cod ? " " + cod : ""}${tipoRetorno ? " (" + tipoRetorno + ")" : ""}`;
      // Se o Inter ainda exige aprovação no app (Gestão de Aprovações), o Pix NÃO saiu:
      // não marcamos como paga — deixamos em "conferida" e registramos o envio pendente.
      if (!pixFoiEfetivado(resp)) {
        await logStep(r.id, "conferida", r.status, "conferida", { id: user.id, name: user.name }, (note || "") + " [Pix enviado ao Inter — aguardando aprovação no banco]" + metaExtra);
        await logAudit({ req, user, action: "pay", entity: "solicitacao", entityId: r.id, companyId: r.companyId, meta: `#${r.code} R$ ${r.valor.toLocaleString("pt-BR")} via Inter (aguardando aprovação no banco)${metaExtra}` });
        return NextResponse.json({ ok: true, viaInter: true, pendenteAprovacaoBanco: true, meta: metaExtra, aviso: "O Pix foi enviado, mas o Inter exige aprovação no app do banco. A solicitação continua como 'conferida' até o débito cair no extrato — não foi marcada como paga." });
      }
    }
    await prisma.paymentRequest.update({
      where: { id: r.id },
      data: { status: "paga", pagadorId: user.id, dataPagamento: b.dataPagamento ? new Date(b.dataPagamento) : new Date() },
    });
    await logStep(r.id, "paga", r.status, "paga", { id: user.id, name: user.name }, (note || "") + (b.executar ? " [pago via Inter]" + metaExtra : " [baixa manual]"));
    await logAudit({ req, user, action: "pay", entity: "solicitacao", entityId: r.id, companyId: r.companyId, meta: `#${r.code} R$ ${r.valor.toLocaleString("pt-BR")}${b.executar ? " via Inter" : " (manual)"}${metaExtra}` });
    if (r.solicitanteId) await notifyFinance([r.solicitanteId], `Sua solicitação foi paga por ${user.name} — R$ ${r.valor.toLocaleString("pt-BR")}`, user.id);
    return NextResponse.json({ ok: true, viaInter: !!b.executar, meta: metaExtra });
  }

  // REABRIR PAGAMENTO (Paga → Conferida) — correção de baixa indevida. Não mexe em dinheiro.
  if (action === "reabrir_pagamento") {
    if (r.status !== "paga") return NextResponse.json({ error: "Só dá pra reabrir uma solicitação que está Paga." }, { status: 400 });
    if (!(await canActOn(user, r, "pagar"))) return NextResponse.json({ error: "Só o pagador/admin pode reabrir." }, { status: 403 });
    await prisma.paymentRequest.update({ where: { id: r.id }, data: { status: "conferida", dataPagamento: null } });
    await logStep(r.id, "reaberta", r.status, "conferida", { id: user.id, name: user.name }, note || "Pagamento reaberto (baixa revertida)");
    await logAudit({ req, user, action: "update", entity: "solicitacao", entityId: r.id, companyId: r.companyId, meta: `#${r.code} reaberto (paga→conferida)` });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
