import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canActOn, notifyFinance, logStep } from "@/lib/finance";

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

  // PAGAR (pagador/sócio)
  if (action === "pagar") {
    if (r.status !== "conferida") return NextResponse.json({ error: "Etapa inválida." }, { status: 400 });
    await prisma.paymentRequest.update({
      where: { id: r.id },
      data: { status: "paga", pagadorId: user.id, dataPagamento: b.dataPagamento ? new Date(b.dataPagamento) : new Date() },
    });
    await logStep(r.id, "paga", r.status, "paga", { id: user.id, name: user.name }, note);
    if (r.solicitanteId) await notifyFinance([r.solicitanteId], `Sua solicitação foi paga por ${user.name} — R$ ${r.valor.toLocaleString("pt-BR")}`, user.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
