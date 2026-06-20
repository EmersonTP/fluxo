import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { accessibleCompanyIds } from "@/lib/auth";

async function companyOfWorkspace(id: string) {
  const w = await prisma.workspace.findUnique({ where: { id }, select: { companyId: true } });
  return w?.companyId ?? null;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role !== "owner" && user.role !== "admin") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const ids = accessibleCompanyIds(user);
  if (ids !== null && !ids.includes((await companyOfWorkspace(params.id)) ?? "")) {
    return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (body.name !== undefined && String(body.name).trim()) data.name = String(body.name).trim();
  const workspace = await prisma.workspace.update({ where: { id: params.id }, data });
  return NextResponse.json({ workspace });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role !== "owner" && user.role !== "admin") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const ids = accessibleCompanyIds(user);
  if (ids !== null && !ids.includes((await companyOfWorkspace(params.id)) ?? "")) {
    return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  }
  await prisma.workspace.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
