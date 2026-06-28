import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse, canAccessList } from "@/lib/api";

// Duplica uma tarefa (mesma lista) + suas subtarefas diretas. Mantém status, prioridade,
// prazo, descrição, pontos, responsáveis e tags. A cópia recebe " (cópia)" no nome.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const orig = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      assignees: { select: { id: true } },
      tags: { select: { id: true } },
      subtasks: {
        orderBy: { createdAt: "asc" },
        include: { assignees: { select: { id: true } }, tags: { select: { id: true } } },
      },
    },
  });
  if (!orig) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  if (!(await canAccessList(user, orig.listId))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const novo = await prisma.task.create({
    data: {
      name: `${orig.name} (cópia)`,
      listId: orig.listId,
      statusId: orig.statusId,
      priority: orig.priority,
      dueDate: orig.dueDate,
      description: orig.description,
      points: orig.points,
      sprintId: orig.sprintId,
      order: Date.now(),
      assignees: orig.assignees.length ? { connect: orig.assignees.map((a) => ({ id: a.id })) } : undefined,
      tags: orig.tags.length ? { connect: orig.tags.map((t) => ({ id: t.id })) } : undefined,
    },
  });

  // subtarefas diretas
  for (const s of orig.subtasks) {
    await prisma.task.create({
      data: {
        name: s.name,
        listId: s.listId,
        parentId: novo.id,
        statusId: s.statusId,
        priority: s.priority,
        dueDate: s.dueDate,
        description: s.description,
        points: s.points,
        order: s.order,
        assignees: s.assignees.length ? { connect: s.assignees.map((a) => ({ id: a.id })) } : undefined,
        tags: s.tags.length ? { connect: s.tags.map((t) => ({ id: t.id })) } : undefined,
      },
    });
  }

  try {
    await prisma.activity.create({ data: { taskId: novo.id, userId: user.id, type: "created", text: "duplicou a tarefa" } });
  } catch { /* best-effort */ }

  return NextResponse.json({ ok: true, id: novo.id });
}
