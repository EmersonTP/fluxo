import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isResponse } from "@/lib/api";
import { companyScope } from "@/lib/auth";

// Feed de atividade pro admin: quem mexeu em quê (criou, moveu, mudou status, comentou…).
export async function GET(req: Request) {
  const user = await requireAdmin();
  if (isResponse(user)) return user;

  const scope = companyScope(user);
  const url = new URL(req.url);
  const userId = url.searchParams.get("user") || undefined;

  const where: any = {};
  if (userId) where.userId = userId;
  if (scope) {
    where.task = {
      list: {
        OR: [
          { space: { workspace: { companyId: scope } } },
          { folder: { space: { workspace: { companyId: scope } } } },
        ],
      },
    };
  }

  const activities = await prisma.activity.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 120,
    include: {
      user: { select: { id: true, name: true, color: true } },
      task: { select: { id: true, name: true, listId: true, list: { select: { name: true } } } },
    },
  });
  return NextResponse.json({ activities });
}
