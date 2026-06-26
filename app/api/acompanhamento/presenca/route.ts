import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessCompany } from "@/lib/finance";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

// Marca presença/falta de um paciente numa sessão (+ motivo e observação).
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const b = await req.json();
  const sessao = await prisma.grupoSessao.findUnique({ where: { id: String(b.sessaoId || "") }, select: { id: true, companyId: true } });
  if (!sessao || !canAccessCompany(user, sessao.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (!b.clienteId) return NextResponse.json({ error: "Paciente obrigatório." }, { status: 400 });
  const presente = !!b.presente;
  await prisma.sessaoPresenca.upsert({
    where: { sessaoId_clienteId: { sessaoId: sessao.id, clienteId: String(b.clienteId) } },
    create: { sessaoId: sessao.id, clienteId: String(b.clienteId), presente, marcado: true, motivo: presente ? null : (b.motivo || null), observacao: b.observacao || null },
    update: { presente, marcado: true, motivo: presente ? null : (b.motivo || null), observacao: b.observacao || null },
  });
  await logAudit({ req, user, action: "update", entity: "cliente", companyId: sessao.companyId, meta: `presença sessão: ${presente ? "presente" : "faltou"}` });
  return NextResponse.json({ ok: true });
}
