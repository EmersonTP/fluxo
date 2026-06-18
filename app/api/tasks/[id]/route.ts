import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { createNotifications } from "@/lib/notify";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      assignees: { select: { id: true, name: true, color: true } },
      tags: { select: { id: true, name: true, color: true } },
      status: true,
      list: { include: { statuses: { orderBy: { order: "asc" } } } },
      subtasks: {
        orderBy: { createdAt: "asc" },
        include: {
          status: true,
          assignees: { select: { id: true, name: true, color: true } },
          _count: { select: { subtasks: true } },
        },
      },
      attachments: { orderBy: { createdAt: "desc" } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, color: true } } },
      },
    },
  });
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  return NextResponse.json({ task });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const body = await req.json();
  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.statusId !== undefined) data.statusId = body.statusId;
  if (body.priority !== undefined) data.priority = body.priority || null;
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.order !== undefined) data.order = body.order;
  if (body.listId !== undefined) data.listId = body.listId;

  // Mark closed date when moved to a done/closed status
  if (body.statusId) {
    const status = await prisma.status.findUnique({ where: { id: body.statusId } });
    if (status && (status.type === "done" || status.type === "closed")) {
      data.dateClosed = new Date();
    } else if (status) {
      data.dateClosed = null;
    }
  }

  let newlyAssigned: string[] = [];
  if (body.assigneeIds !== undefined) {
    data.assignees = { set: body.assigneeIds.map((id: string) => ({ id })) };
    const before = await prisma.task.findUnique({
      where: { id: params.id },
      select: { name: true, listId: true, assignees: { select: { id: true } } },
    });
    const prevIds = new Set((before?.assignees || []).map((a: { id: string }) => a.id));
    newlyAssigned = (body.assigneeIds as string[]).filter((id) => !prevIds.has(id) && id !== user.id);
    if (newlyAssigned.length && before) {
      await createNotifications(
        newlyAssigned,
        "assigned",
        `${user.name} atribuiu você a "${before.name}"`,
        `/list/${before.listId}`,
        user.id
      );
    }
  }
  if (body.tagIds !== undefined) {
    data.tags = { set: body.tagIds.map((id: string) => ({ id })) };
  }

  const task = await prisma.task.update({
    where: { id: params.id },
    data,
    include: {
      assignees: { select: { id: true, name: true, color: true } },
      tags: { select: { id: true, name: true, color: true } },
      status: true,
      _count: { select: { subtasks: true, comments: true } },
    },
  });

  return NextResponse.json({ task });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
