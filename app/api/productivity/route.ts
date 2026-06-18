import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isResponse } from "@/lib/api";
import { companyScope } from "@/lib/auth";

// Admin-only: productivity per employee, scoped to the admin's company.
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (isResponse(admin)) return admin;

  const period = new URL(req.url).searchParams.get("period") || "week";
  const now = new Date();
  let since: Date | null = new Date();
  if (period === "week") since.setDate(now.getDate() - 7);
  else if (period === "month4") since.setDate(now.getDate() - 28);
  else if (period === "current") since = new Date(now.getFullYear(), now.getMonth(), 1);
  else since = null; // "all"

  const scope = companyScope(admin);
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
    where: { ...listFilter },
    select: {
      id: true,
      dueDate: true,
      dateClosed: true,
      status: { select: { type: true } },
      assignees: { select: { id: true, name: true, color: true } },
    },
  });

  type Row = { id: string; name: string; color: string; concluidas: number; noPrazo: number; comPrazo: number; abertas: number; atrasadas: number };
  const map = new Map<string, Row>();
  const get = (a: { id: string; name: string; color: string }) => {
    let r = map.get(a.id);
    if (!r) {
      r = { id: a.id, name: a.name, color: a.color, concluidas: 0, noPrazo: 0, comPrazo: 0, abertas: 0, atrasadas: 0 };
      map.set(a.id, r);
    }
    return r;
  };

  const isDone = (t: (typeof tasks)[number]) => !!t.dateClosed || t.status?.type === "done" || t.status?.type === "closed";

  for (const t of tasks) {
    const done = isDone(t);
    const closedInPeriod = t.dateClosed && (!since || new Date(t.dateClosed) >= since);
    for (const a of t.assignees) {
      const r = get(a);
      if (done) {
        if (closedInPeriod) {
          r.concluidas++;
          if (t.dueDate) {
            r.comPrazo++;
            if (new Date(t.dateClosed!) <= new Date(t.dueDate)) r.noPrazo++;
          }
        }
      } else {
        r.abertas++;
        if (t.dueDate && new Date(t.dueDate) < now) r.atrasadas++;
      }
    }
  }

  const people = [...map.values()]
    .map((r) => ({
      ...r,
      pctNoPrazo: r.comPrazo > 0 ? Math.round((r.noPrazo / r.comPrazo) * 100) : null,
    }))
    .sort((a, b) => b.concluidas - a.concluidas);

  return NextResponse.json({ period, people });
}
