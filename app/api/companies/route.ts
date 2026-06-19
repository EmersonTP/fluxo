import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { companyScope } from "@/lib/auth";

// Empresas que o usuário pode "abrir" (switcher). Membro → a sua; owner/admin → todas ativas.
export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const scope = companyScope(user);
  const companies = await prisma.company.findMany({
    where: scope ? { id: scope } : { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, modules: true },
  });
  return NextResponse.json({ companies });
}
