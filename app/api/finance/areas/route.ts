import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessCompany } from "@/lib/finance";

// Áreas de uma empresa = os Espaços dos seus workspaces.
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ areas: [] });

  const spaces = await prisma.space.findMany({
    where: { workspace: { companyId } },
    orderBy: { order: "asc" },
    select: { id: true, name: true, color: true },
  });
  return NextResponse.json({ areas: spaces });
}
