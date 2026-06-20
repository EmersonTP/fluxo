import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { accessibleCompanyIds } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const ids = accessibleCompanyIds(user);
  const members = await prisma.user.findMany({
    where: { status: "active", ...(ids === null ? {} : { companyId: { in: ids } }) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, color: true, role: true },
  });
  return NextResponse.json({ members });
}
