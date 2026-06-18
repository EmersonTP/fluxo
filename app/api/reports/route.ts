import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { companyScope } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const scope = companyScope(user);
  const listFilter =
    scope === null
      ? {}
      : {
          list: {
            OR: [
              { space: { workspace: { companyId: scope } } },
              { folder: { space: { workspace: { companyId: scope } } } },
            ],
          },
        };

  const tasks = await prisma.task.findMany({
    where: { parentId: null, ...listFilter },
    select: {
      id: true,
      priority: true,
      dueDate: true,
      dateClosed: true,
      status: { select: { type: true, name: true, color: true } },
      assignees: { select: { id: true, name: true, color: true } },
    },
  });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const isDone = (t: (typeof tasks)[number]) => !!t.dateClosed || t.status?.type === "done" || t.status?.type === "closed";

  const total = tasks.length;
  let concluidas = 0;
  let atrasadas = 0;
  let concluidas7d = 0;
  const porPrioridade: Record<string, number> = { urgent: 0, high: 0, normal: 0, low: 0, none: 0 };
  const porStatus: Record<string, { count: number; color: string }> = {};
  const porResponsavel: Record<string, { name: string; color: string; abertas: number }> = {};

  for (const t of tasks) {
    const done = isDone(t);
    if (done) {
      concluidas++;
      if (t.dateClosed && new Date(t.dateClosed) >= weekAgo) concluidas7d++;
    } else {
      if (t.dueDate && new Date(t.dueDate) < now) atrasadas++;
    }
    porPrioridade[t.priority || "none"] = (porPrioridade[t.priority || "none"] || 0) + 1;
    const sName = t.status?.name || "Sem status";
    porStatus[sName] = { count: (porStatus[sName]?.count || 0) + 1, color: t.status?.color || "#a3a3a3" };
    if (!done) {
      for (const a of t.assignees) {
        porResponsavel[a.id] = { name: a.name, color: a.color, abertas: (porResponsavel[a.id]?.abertas || 0) + 1 };
      }
    }
  }

  const responsaveis = Object.values(porResponsavel).sort((a, b) => b.abertas - a.abertas).slice(0, 10);
  const statusList = Object.entries(porStatus)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    total,
    concluidas,
    abertas: total - concluidas,
    atrasadas,
    concluidas7d,
    porPrioridade,
    porStatus: statusList,
    porResponsavel: responsaveis,
  });
}
