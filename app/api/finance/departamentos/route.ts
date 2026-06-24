import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessCompany } from "@/lib/finance";

// Lista os departamentos (centros de custo) da empresa — pro seletor de lançamento.
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ departamentos: [] });
  const departamentos = await prisma.departamento.findMany({
    where: { companyId, ativo: true },
    orderBy: { ordem: "asc" },
    select: { id: true, nome: true },
  });
  return NextResponse.json({ departamentos });
}
