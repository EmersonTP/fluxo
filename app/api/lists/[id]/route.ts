import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin, isResponse, canAccessList, companyIdForList } from "@/lib/api";
import { companyScope } from "@/lib/auth";

// Privacidade da lista: tornar privada e definir quem acessa (admin/owner).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (isResponse(admin)) return admin;
  const scope = companyScope(admin);
  if (scope !== null && (await companyIdForList(params.id)) !== scope) {
    return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (body.private !== undefined) data.private = !!body.private;
  if (body.memberIds !== undefined) data.members = { set: (body.memberIds as string[]).map((id) => ({ id })) };
  const list = await prisma.list.update({
    where: { id: params.id },
    data,
    select: { id: true, private: true, members: { select: { id: true } } },
  });
  return NextResponse.json({ list });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  if (!(await canAccessList(user, params.id))) {
    return NextResponse.json({ error: "Sem acesso a esta lista." }, { status: 403 });
  }

  const list = await prisma.list.findUnique({
    where: { id: params.id },
    include: {
      space: { select: { id: true, name: true, color: true } },
      folder: { select: { id: true, name: true } },
      statuses: { orderBy: { order: "asc" } },
      tasks: {
        where: { parentId: null },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        include: {
          assignees: { select: { id: true, name: true, color: true } },
          tags: { select: { id: true, name: true, color: true } },
          status: true,
          _count: { select: { subtasks: true, comments: true } },
        },
      },
    },
  });

  if (!list) return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });
  return NextResponse.json({ list });
}
