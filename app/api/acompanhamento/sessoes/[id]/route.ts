import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessCompany } from "@/lib/finance";

export const runtime = "nodejs";

// Sessão + lista de pacientes (clientes da empresa) com a presença de cada um.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const sessao = await prisma.grupoSessao.findUnique({ where: { id: params.id } });
  if (!sessao || !canAccessCompany(user, sessao.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const clientes = await prisma.cliente.findMany({ where: { companyId: sessao.companyId }, orderBy: { nome: "asc" }, select: { id: true, nome: true } });
  const presencas = await prisma.sessaoPresenca.findMany({ where: { sessaoId: sessao.id } });
  const byCli: Record<string, any> = {};
  for (const p of presencas) byCli[p.clienteId] = p;
  return NextResponse.json({
    sessao: { id: sessao.id, data: sessao.data.toISOString().slice(0, 10), titulo: sessao.titulo },
    pacientes: clientes.map((c: any) => {
      const p = byCli[c.id];
      return { clienteId: c.id, nome: c.nome, marcado: !!p?.marcado, presente: !!p?.presente, motivo: p?.motivo || "", observacao: p?.observacao || "" };
    }),
  });
}
