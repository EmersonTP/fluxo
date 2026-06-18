import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";

// GET /api/search?q=...&limit=50  -> tasks matching name across all lists
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  if (!q) return NextResponse.json({ tasks: [] });

  const tasks = await prisma.task.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    take: limit,
    orderBy: { updatedAt: "desc" },
    include: {
      status: { select: { name: true, color: true } },
      assignees: { select: { id: true, name: true } },
      list: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ tasks });
}
