import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessCompany } from "@/lib/finance";

// Membros de uma empresa (para escolher aprovadores e solicitante).
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ members: [] });

  // Inclui membros da empresa + owners/admins (sócios pagadores podem não ter empresa fixa).
  const members = await prisma.user.findMany({
    where: { status: "active", OR: [{ companyId }, { role: { in: ["owner", "admin"] } }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, color: true, role: true },
  });
  return NextResponse.json({ members });
}
