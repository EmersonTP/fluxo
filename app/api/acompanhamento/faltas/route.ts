import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessCompany } from "@/lib/finance";

export const runtime = "nodejs";

// Quem está faltando: por paciente, nº de faltas nas últimas sessões + última presença.
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ pacientes: [] });
  const sessoes = await prisma.grupoSessao.findMany({ where: { companyId }, orderBy: { data: "desc" }, take: 8, select: { id: true, data: true } });
  const ids = sessoes.map((s: any) => s.id);
  if (ids.length === 0) return NextResponse.json({ pacientes: [], sessoes: 0 });
  const presencas = await prisma.sessaoPresenca.findMany({ where: { sessaoId: { in: ids }, marcado: true }, include: { cliente: { select: { nome: true } }, sessao: { select: { data: true } } } });
  const agg: Record<string, any> = {};
  for (const p of presencas as any[]) {
    const a = (agg[p.clienteId] = agg[p.clienteId] || { clienteId: p.clienteId, nome: p.cliente?.nome || "—", faltas: 0, presencas: 0, ultimaPresenca: null, ultimaFalta: null });
    if (p.presente) { a.presencas++; const d = p.sessao.data.toISOString().slice(0, 10); if (!a.ultimaPresenca || d > a.ultimaPresenca) a.ultimaPresenca = d; }
    else { a.faltas++; const d = p.sessao.data.toISOString().slice(0, 10); if (!a.ultimaFalta || d > a.ultimaFalta) a.ultimaFalta = d; }
  }
  const pacientes = Object.values(agg).filter((a: any) => a.faltas > 0).sort((a: any, b: any) => b.faltas - a.faltas);
  return NextResponse.json({ pacientes, sessoes: ids.length });
}
