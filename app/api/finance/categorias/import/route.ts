import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";
import { importCategorias } from "@/lib/finance-categorias";

// Importa o plano de contas (Omie) de uma empresa a partir do JSON embutido. Admin only.
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin importa." }, { status: 403 });
  const { companyId } = await req.json();
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Empresa inválida." }, { status: 400 });
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
  if (!company) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  const res = await importCategorias(companyId, company.name);
  if (!res.ok) return NextResponse.json({ error: `Sem plano de contas pré-definido para "${company.name}".` }, { status: 404 });
  return NextResponse.json(res);
}
