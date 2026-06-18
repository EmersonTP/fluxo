import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { companyScope } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const scope = companyScope(user);
  const members = await prisma.user.findMany({
    where: { status: "active", ...(scope ? { companyId: scope } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, color: true, role: true },
  });
  return NextResponse.json({ members });
}
