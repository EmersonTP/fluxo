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
      sprint: { select: { id: true, name: true } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 60,
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
  const blocked = await guardTask(user, params.id);
  if (blocked) return blocked;

  const body = await req.json();
  // Se for mover de lista, validar acesso à lista de destino também
  if (body.listId && !(await canAccessList(user, body.listId))) {
    return NextResponse.json({ error: "Sem acesso à lista de destino." }, { status: 403 });
  }

  // Estado anterior, para registrar o histórico de alterações
  const prev = await prisma.task.findUnique({
    where: { id: params.id },
    select: {
      name: true,
      listId: true,
      priority: true,
      dueDate: true,
      statusId: true,
      assignees: { select: { id: true, name: true } },
    },
  });

  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.statusId !== undefined) data.statusId = body.statusId;
  if (body.priority !== undefined) data.priority = body.priority || null;
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.order !== undefined) data.order = body.order;
  if (body.listId !== undefined) data.listId = body.listId;

  // markDone: arrastar entre baldes "Em aberto" / "Concluídas" (Minhas Tarefas) sem saber o statusId da lista.
  if (body.markDone !== undefined) {
    const tk = await prisma.task.findUnique({ where: { id: params.id }, select: { listId: true } });
    if (tk) {
      const tipos = body.markDone ? ["done", "closed"] : ["open"];
      const st = await prisma.status.findFirst({ where: { listId: tk.listId, type: { in: tipos } }, orderBy: { order: "asc" } });
      if (st) data.statusId = st.id;
      data.dateClosed = body.markDone ? new Date() : null;
    }
  }
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
    const prevIds = new Set((prev?.assignees || []).map((a: { id: string }) => a.id));
    newlyAssigned = (body.assigneeIds as string[]).filter((id) => !prevIds.has(id) && id !== user.id);
    if (newlyAssigned.length && prev) {
      await createNotifications(
        newlyAssigned,
        "assigned",
        `${user.name} atribuiu você a "${prev.name}"`,
        `/list/${prev.listId}`,
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
  if (body.points !== undefined) data.points = body.points === null || body.points === "" ? null : Number(body.points);
  if (body.sprintId !== undefined) data.sprintId = body.sprintId || null;
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

  // Registrar histórico de alterações (sem quebrar a request se falhar)
  try {
    const PRIO: Record<string, string> = { urgent: "Urgente", high: "Alta", normal: "Normal", low: "Baixa" };
    const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : null);
    const logs: { type: string; text: string }[] = [];

    if (prev) {
      if (body.name !== undefined && body.name !== prev.name) {
        logs.push({ type: "renamed", text: `renomeou para "${body.name}"` });
      }
      if (body.statusId !== undefined && body.statusId !== prev.statusId) {
        logs.push({ type: "status", text: `moveu para "${task.status?.name || "—"}"` });
      }
      if (body.priority !== undefined && (body.priority || null) !== (prev.priority || null)) {
        logs.push({ type: "priority", text: body.priority ? `definiu prioridade: ${PRIO[body.priority] || body.priority}` : "removeu a prioridade" });
      }
      if (body.dueDate !== undefined) {
        const oldD = fmt(prev.dueDate);
        const newD = body.dueDate ? fmt(new Date(body.dueDate)) : null;
        if (oldD !== newD) logs.push({ type: "due", text: newD ? `definiu o prazo para ${newD}` : "removeu o prazo" });
      }
      if (body.assigneeIds !== undefined) {
        const prevIds = new Set(prev.assignees.map((a: { id: string }) => a.id));
        const newIds = new Set(task.assignees.map((a: { id: string }) => a.id));
        for (const a of task.assignees) if (!prevIds.has(a.id)) logs.push({ type: "assignees", text: `atribuiu ${a.name}` });
        for (const a of prev.assignees) if (!newIds.has(a.id)) logs.push({ type: "assignees", text: `removeu ${a.name}` });
      }
      if (body.listId !== undefined && body.listId !== prev.listId) {
        logs.push({ type: "moved", text: "moveu para outra lista" });
      }
    }

    if (logs.length) {
      await prisma.activity.createMany({
        data: logs.map((l) => ({ taskId: params.id, userId: user.id, type: l.type, text: l.text })),
      });
    }
  } catch {
    /* histórico é best-effort */
  }

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
