import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { companyScope } from "@/lib/auth";

const DONE = (t: { type?: string | null }) => t.type === "done" || t.type === "closed";

export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const scope = companyScope(user);
  if (scope === null && user.role === "member") return NextResponse.json({ sprints: [] });

  const sprints = await prisma.sprint.findMany({
    where: scope ? { companyId: scope } : undefined,
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    include: { company: { select: { name: true } } },
  });
  const ids = sprints.map((s: { id: string }) => s.id);
  const tasks = ids.length
    ? await prisma.task.findMany({
        where: { sprintId: { in: ids } },
        select: { sprintId: true, points: true, dateClosed: true, status: { select: { type: true } } },
      })
    : [];

  const agg: Record<string, { total: number; done: number; pts: number; donePts: number }> = {};
  for (const s of sprints) agg[s.id] = { total: 0, done: 0, pts: 0, donePts: 0 };
  for (const t of tasks) {
    const a = agg[t.sprintId!];
    if (!a) continue;
    const done = !!t.dateClosed || DONE(t.status || {});
    a.total++;
    a.pts += t.points || 0;
    if (done) { a.done++; a.donePts += t.points || 0; }
  }

  return NextResponse.json({ sprints: sprints.map((s: { id: string }) => ({ ...s, stats: agg[s.id] })) });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const body = await req.json().catch(() => ({}));
  if (!body.name?.trim()) return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 });

  const scope = companyScope(user);
  let companyId: string | null = scope; // membro = sua empresa
  if (scope === null) companyId = body.companyId || null; // owner/admin escolhe
  if (!companyId) return NextResponse.json({ error: "Escolha a empresa do sprint." }, { status: 400 });

  const sprint = await prisma.sprint.create({
    data: {
      name: body.name.trim(),
      companyId,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      goal: body.goal || null,
    },
  });
  return NextResponse.json({ sprint });
}
