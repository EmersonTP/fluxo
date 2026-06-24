import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessCompany, approversOf, notifyFinance, logStep, userNames, seesAllRequests, isInvolved } from "@/lib/finance";

// Lista solicitações de uma empresa (filtro por status opcional).
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company") || "";
  const status = url.searchParams.get("status") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ requests: [] });

  const all = await prisma.paymentRequest.findMany({
    where: { companyId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { credor: { select: { nome: true, documento: true } }, _count: { select: { attachments: true } } },
  });
  // Visibilidade: financeiro/admin veem tudo; os demais só as solicitações em que estão envolvidos.
  const a = await approversOf(companyId);
  const requests = seesAllRequests(user, a) ? all : all.filter((r: any) => isInvolved(user, r, a));
  const names = await userNames(requests.flatMap((r: any) => [r.solicitanteId, r.gestorId, r.financeiroId, r.pagadorId]));
  return NextResponse.json({ requests, names });
}

// Cria uma solicitação de pagamento (entra como "solicitada").
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const b = await req.json();
  const companyId = b.companyId;
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (!b.descricao?.trim()) return NextResponse.json({ error: "Descrição obrigatória." }, { status: 400 });
  const valor = Number(b.valor);
  if (!valor || valor <= 0) return NextResponse.json({ error: "Valor deve ser maior que zero." }, { status: 400 });
  if (!b.areaName) return NextResponse.json({ error: "Área obrigatória." }, { status: 400 });

  // Categoria precisa pertencer à empresa (isolamento).
  let categoriaId: string | null = null;
  if (b.categoriaId) {
    const cat = await prisma.categoria.findUnique({ where: { id: b.categoriaId }, select: { companyId: true } });
    if (cat && cat.companyId === companyId) categoriaId = b.categoriaId;
  }

  const created = await prisma.paymentRequest.create({
    data: {
      companyId,
      kind: b.kind === "reembolso" ? "reembolso" : "padrao",
      status: "solicitada",
      spaceId: b.spaceId || null,
      areaName: b.areaName,
      departamentoId: b.departamentoId || null,
      credorId: b.credorId || null,
      descricao: b.descricao.trim(),
      valor,
      vencimento: b.vencimento ? new Date(b.vencimento) : null,
      formaPagamento: b.formaPagamento || null,
      categoriaId,
      categoria: b.categoria || null,
      docTipo: b.docTipo || null,
      docNumero: b.docNumero || null,
      recorrencia: b.recorrencia === "mensal" ? "mensal" : "unica",
      prazoPagamento: b.prazoPagamento || null,
      prioridade: b.prioridade || null,
      observacao: b.observacao || null,
      centroCusto: b.centroCusto || null,
      cotacaoDispensa: !!b.cotacaoDispensa,
      cotacaoJustificativa: b.cotacaoJustificativa || null,
      solicitanteId: user.id,
    },
  });

  await logStep(created.id, "criada", null, "solicitada", { id: user.id, name: user.name }, b.descricao?.slice(0, 120));

  // Notifica os gestores da área.
  const a = await approversOf(companyId);
  const gestores = (b.spaceId && a.gestoresPorArea[b.spaceId]) || [];
  await notifyFinance(gestores, `Nova solicitação de ${user.name} em ${b.areaName} — R$ ${valor.toLocaleString("pt-BR")}`, user.id);

  // Confirma pro próprio solicitante que o pedido foi enviado.
  await notifyFinance([user.id], `Sua solicitação #${created.code} (${b.areaName} — R$ ${valor.toLocaleString("pt-BR")}) foi enviada e está aguardando o gestor.`);

  return NextResponse.json({ request: created });
}
