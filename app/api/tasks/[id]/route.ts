import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse, canAccessList } from "@/lib/api";
import { createNotifications } from "@/lib/notify";

// Carrega o listId da tarefa e valida acesso da empresa. Retorna 404/403 ou null se ok.
async function guardTask(user: { role: string; companyId: string | null }, taskId: string) {
  const t = await prisma.task.findUnique({ where: { id: taskId }, select: { listId: true } });
  if (!t) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  if (!(await canAccessList(user, t.listId))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  return null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const blocked = await guardTask(user, params.id);
  if (blocked) return blocked;

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
      blockedBy: { select: { id: true, name: true, status: { select: { name: true, color: true, type: true } } } },
      blocking: { select: { id: true, name: true, status: { select: { name: true, color: true, type: true } } } },
    },
  });
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  return NextResponse.json({ task });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const blocked = await guardTask(user, params.id);
  if (blocked) return blocked;

  const body = await req.json();
  // Se for mover de lista, validar acesso à lista de destino também
  if (body.listId && !(await canAccessList(user, body.listId))) {
    return NextResponse.json({ error: "Sem acesso à lista de destino." }, { status: 403 });
  }
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
  if (body.customFields !== undefined) {
    data.customFields = body.customFields;
  }
  // Dependências: conectar/desconectar tarefas que travam esta (blockedBy)
  if (body.addDependsOn) {
    data.blockedBy = { connect: { id: body.addDependsOn } };
  }
  if (body.removeDependsOn) {
    data.blockedBy = { disconnect: { id: body.removeDependsOn } };
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
  const blocked = await guardTask(user, params.id);
  if (blocked) return blocked;

  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
