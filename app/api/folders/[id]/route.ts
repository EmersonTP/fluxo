import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { companyScope } from "@/lib/auth";

async function companyOfFolder(id: string) {
  const f = await prisma.folder.findUnique({
    where: { id },
    select: { space: { select: { workspace: { select: { companyId: true } } } } },
  });
  return f?.space.workspace.companyId ?? null;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const scope = companyScope(user);
  if (scope !== null && (await companyOfFolder(params.id)) !== scope) {
    return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (body.name !== undefined && body.name.trim()) data.name = body.name.trim();
  const folder = await prisma.folder.update({ where: { id: params.id }, data });
  return NextResponse.json({ folder });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const scope = companyScope(user);
  if (scope !== null && (await companyOfFolder(params.id)) !== scope) {
    return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  }
  await prisma.folder.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
