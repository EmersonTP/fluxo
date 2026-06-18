import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse, canAccessList } from "@/lib/api";

async function guard(user: any, statusId: string) {
  const st = await prisma.status.findUnique({ where: { id: statusId } });
  if (!st) return null;
  const ok = await canAccessList(user, st.listId);
  return ok ? st : null;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const st = await guard(user, params.id);
  if (!st) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const { name, color } = await req.json();
  const status = await prisma.status.update({
    where: { id: params.id },
    data: { name: name?.trim() || undefined, color: color || undefined },
  });
  return NextResponse.json({ status });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const st = await guard(user, params.id);
  if (!st) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  // Move tasks of this status to another status of the same list (the first one).
  const fallback = await prisma.status.findFirst({
    where: { listId: st.listId, id: { not: st.id } },
    orderBy: { order: "asc" },
  });
  await prisma.task.updateMany({ where: { statusId: st.id }, data: { statusId: fallback?.id || null } });
  await prisma.status.delete({ where: { id: st.id } });
  return NextResponse.json({ ok: true });
}
