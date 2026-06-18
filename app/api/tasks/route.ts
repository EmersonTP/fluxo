import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse, canAccessList } from "@/lib/api";

export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const body = await req.json();
  const { listId, name, statusId, priority, dueDate, description, assigneeIds, parentId } = body;

  if (!listId || !name?.trim()) {
    return NextResponse.json({ error: "Lista e nome são obrigatórios." }, { status: 400 });
  }
  if (!(await canAccessList(user, listId))) {
    return NextResponse.json({ error: "Sem acesso a esta lista." }, { status: 403 });
  }

  const list = await prisma.list.findUnique({
    where: { id: listId },
    include: { statuses: { orderBy: { order: "asc" }, take: 1 } },
  });
  if (!list) return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });

  const resolvedStatusId = statusId || list.statuses[0]?.id || null;

  const task = await prisma.task.create({
    data: {
      name: name.trim(),
      listId,
      statusId: resolvedStatusId,
      priority: priority || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      description: description || null,
      order: Date.now(),
      parentId: parentId || null,
      assignees: assigneeIds?.length ? { connect: assigneeIds.map((id: string) => ({ id })) } : undefined,
    },
    include: {
      assignees: { select: { id: true, name: true, color: true } },
      tags: { select: { id: true, name: true, color: true } },
      status: true,
      _count: { select: { subtasks: true, comments: true } },
    },
  });

  return NextResponse.json({ task });
}
