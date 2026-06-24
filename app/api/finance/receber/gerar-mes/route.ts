import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

// Gera os títulos a receber do mês a partir das assinaturas ativas (idempotente por assinatura+mês).
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const companyId = b.companyId as string;
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  // mês alvo (YYYY-MM) — default mês atual
  const alvo = (b.mes as string) || new Date().toISOString().slice(0, 7);
  const [ano, mm] = alvo.split("-").map(Number);
  const fimMes = new Date(ano, mm, 0, 23, 59, 59); // último dia do mês

  const assinaturas = await prisma.assinatura.findMany({
    where: { companyId, status: "ativa" },
    include: { plano: true, cliente: { select: { nome: true } } },
  });
  let criados = 0, pulados = 0;
  for (const a of assinaturas) {
    if (!a.proximaCobranca || a.proximaCobranca > fimMes) { pulados++; continue; }
    // já existe título dessa assinatura nesse mês?
    const ini = new Date(ano, mm - 1, 1);
    const exists = await prisma.receivable.findFirst({ where: { assinaturaId: a.id, vencimento: { gte: ini, lte: fimMes } }, select: { id: true } });
    if (exists) { pulados++; continue; }
    await prisma.receivable.create({
      data: {
        companyId, descricao: `${a.plano.nome} — ${a.cliente?.nome || "cliente"}`,
        valorCents: a.valorCents ?? a.plano.valorCents, status: "pendente", provider: "manual", origem: "assinatura",
        vencimento: a.proximaCobranca, clienteId: a.clienteId, assinaturaId: a.id,
      },
    });
    // avança a próxima cobrança conforme o intervalo do plano
    const p = new Date(a.proximaCobranca);
    if (a.plano.intervaloTipo === "weeks") p.setDate(p.getDate() + 7 * (a.plano.intervalo || 1));
    else p.setMonth(p.getMonth() + (a.plano.intervalo || 1));
    await prisma.assinatura.update({ where: { id: a.id }, data: { proximaCobranca: p } });
    criados++;
  }
  await logAudit({ req, user, action: "create", entity: "recebivel", companyId, meta: `gerar-mes ${alvo}: ${criados} criados` });
  return NextResponse.json({ ok: true, criados, pulados, mes: alvo });
}
