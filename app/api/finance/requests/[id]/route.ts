import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessCompany, isAdmin, userNames, logStep, approversOf, seesAllRequests, isInvolved } from "@/lib/finance";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const r = await prisma.paymentRequest.findUnique({
    where: { id: params.id },
    include: {
      credor: true,
      attachments: { select: { id: true, filename: true, mime: true, size: true, tag: true } },
      steps: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!r) return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  if (!canAccessCompany(user, r.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  // Visibilidade: só envolvidos (e financeiro/admin) veem o detalhe.
  const a = await approversOf(r.companyId);
  if (!seesAllRequests(user, a) && !isInvolved(user, r, a)) return NextResponse.json({ error: "Sem acesso a esta solicitação." }, { status: 403 });
  const names = await userNames([r.solicitanteId, r.gestorId, r.financeiroId, r.pagadorId]);
  return NextResponse.json({ request: r, names });
}

// Edita campos enquanto ainda não foi paga (solicitante/admin). Útil pra corrigir antes de aprovar.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const r = await prisma.paymentRequest.findUnique({ where: { id: params.id } });
  if (!r) return NextResponse.json({ error: "Não encontrada." }, { status: 404 });
  if (!canAccessCompany(user, r.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (r.status === "paga" || r.status === "cancelada") return NextResponse.json({ error: "Não dá pra editar uma solicitação finalizada." }, { status: 400 });

  const b = await req.json();
  const data: any = {};
  for (const k of ["descricao", "formaPagamento", "categoria", "centroCusto", "classeGerencial", "docTipo", "docNumero", "cotacaoJustificativa", "contaOrigem", "prazoPagamento", "prioridade", "observacao"]) if (b[k] !== undefined) data[k] = b[k];
  if (b.valor !== undefined) data.valor = Number(b.valor);
  if (b.vencimento !== undefined) data.vencimento = b.vencimento ? new Date(b.vencimento) : null;
  if (b.credorId !== undefined) data.credorId = b.credorId || null;
  if (b.cotacaoDispensa !== undefined) data.cotacaoDispensa = !!b.cotacaoDispensa;
  if (b.recorrencia !== undefined) data.recorrencia = b.recorrencia;

  const updated = await prisma.paymentRequest.update({ where: { id: params.id }, data });
  await logStep(params.id, "editada", r.status, r.status, { id: user.id, name: user.name });
  return NextResponse.json({ request: updated });
}

// Cancela (solicitante ou admin), se ainda não paga.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const r = await prisma.paymentRequest.findUnique({ where: { id: params.id } });
  if (!r) return NextResponse.json({ error: "Não encontrada." }, { status: 404 });
  if (!canAccessCompany(user, r.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (r.solicitanteId !== user.id && !isAdmin(user)) return NextResponse.json({ error: "Só quem solicitou (ou admin) cancela." }, { status: 403 });
  if (r.status === "paga") return NextResponse.json({ error: "Solicitação já paga." }, { status: 400 });

  await prisma.paymentRequest.update({ where: { id: params.id }, data: { status: "cancelada" } });
  await logStep(params.id, "recusada", r.status, "cancelada", { id: user.id, name: user.name }, "Cancelada");
  return NextResponse.json({ ok: true });
}
