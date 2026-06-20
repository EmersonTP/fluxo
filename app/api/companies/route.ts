import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { accessibleCompanyIds } from "@/lib/auth";

// Empresas que o usuário pode "abrir" (switcher). Membro → as que tem acesso; owner/admin → todas ativas.
export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const ids = accessibleCompanyIds(user);
  const companies = await prisma.company.findMany({
    where: ids === null ? { active: true } : { id: { in: ids } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, modules: true },
  });
  return NextResponse.json({ companies });
}
