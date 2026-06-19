import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { companyScope } from "@/lib/auth";

async function canAccess(user: { role: string; companyId: string | null }, id: string) {
  const sp = await prisma.sprint.findUnique({ where: { id }, select: { companyId: true } });
  if (!sp) return null;
  const scope = companyScope(user);
  if (scope === null) return sp;
  return sp.companyId === scope ? sp : false;
}

// Detalhe do sprint com as tarefas
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const ok = await canAccess(user, params.id);
  if (ok === null) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  if (ok === false) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const sprint = await prisma.sprint.findUnique({
    where: { id: params.id },
    include: {
      tasks: {
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        include: {
          status: true,
          assignees: { select: { id: true, name: true, color: true } },
          list: { select: { id: true, name: true } },
        },
      },
    },
  });
  return NextResponse.json({ sprint });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const ok = await canAccess(user, params.id);
  if (ok === null) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  if (ok === false) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (body.name !== undefined && body.name.trim()) data.name = body.name.trim();
  if (body.goal !== undefined) data.goal = body.goal || null;
  if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
  if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
  const sprint = await prisma.sprint.update({ where: { id: params.id }, data });
  return NextResponse.json({ sprint });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const ok = await canAccess(user, params.id);
  if (ok === null) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  if (ok === false) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  await prisma.sprint.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
