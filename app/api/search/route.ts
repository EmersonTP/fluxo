import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse, accessibleListIds } from "@/lib/api";
import { accessibleCompanyIds } from "@/lib/auth";

// GET /api/search?q=...&limit=50  -> tasks matching name, scoped to the user's company
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  if (q.length < 2) return NextResponse.json({ tasks: [] });

  const ids = accessibleCompanyIds(user);
  const listFilter =
    ids === null
      ? {}
      : {
          list: {
            OR: [
              { space: { workspace: { companyId: { in: ids } } } },
              { folder: { space: { workspace: { companyId: { in: ids } } } } },
            ],
          },
        };

  // Privacidade: membro só busca em listas a que tem acesso
  const allowed = await accessibleListIds(user);
  const privacyFilter = allowed === null ? {} : { listId: { in: allowed } };

  const tasks = await prisma.task.findMany({
    where: { name: { contains: q, mode: "insensitive" }, ...listFilter, ...privacyFilter },
    take: limit,
    orderBy: { updatedAt: "desc" },
    include: {
      status: { select: { name: true, color: true } },
      assignees: { select: { id: true, name: true, color: true } },
      list: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ tasks });
}
