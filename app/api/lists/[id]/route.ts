import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse, canAccessList } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  if (!(await canAccessList(user, params.id))) {
    return NextResponse.json({ error: "Sem acesso a esta lista." }, { status: 403 });
  }

  const list = await prisma.list.findUnique({
    where: { id: params.id },
    include: {
      space: { select: { id: true, name: true, color: true } },
      folder: { select: { id: true, name: true } },
      statuses: { orderBy: { order: "asc" } },
      tasks: {
        where: { parentId: null },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        include: {
          assignees: { select: { id: true, name: true, color: true } },
          tags: { select: { id: true, name: true, color: true } },
          status: true,
          _count: { select: { subtasks: true, comments: true } },
        },
      },
    },
  });

  if (!list) return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });
  return NextResponse.json({ list });
}
