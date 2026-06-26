import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessCompany } from "@/lib/finance";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ sessoes: [] });
  const sessoes = await prisma.grupoSessao.findMany({
    where: { companyId }, orderBy: { data: "desc" }, take: 30,
    include: { presencas: { select: { presente: true, marcado: true } } },
  });
  return NextResponse.json({
    sessoes: sessoes.map((s: any) => ({
      id: s.id, data: s.data.toISOString().slice(0, 10), titulo: s.titulo,
      presentes: s.presencas.filter((p: any) => p.marcado && p.presente).length,
      faltas: s.presencas.filter((p: any) => p.marcado && !p.presente).length,
    })),
  });
}

// Cria a sessão da semana (ou retorna a do dia, se já existir).
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const b = await req.json();
  if (!b.companyId || !canAccessCompany(user, b.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const data = b.data ? new Date(String(b.data).slice(0, 10) + "T12:00:00") : new Date();
  const dia = new Date(data.getFullYear(), data.getMonth(), data.getDate(), 12);
  const existe = await prisma.grupoSessao.findFirst({ where: { companyId: b.companyId, data: { gte: new Date(dia.getFullYear(), dia.getMonth(), dia.getDate()), lt: new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() + 1) } } });
  if (existe) return NextResponse.json({ sessao: { id: existe.id }, jaExistia: true });
  const s = await prisma.grupoSessao.create({ data: { companyId: b.companyId, data: dia, titulo: b.titulo || "Sessão em grupo" } });
  return NextResponse.json({ sessao: { id: s.id } });
}
