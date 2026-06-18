import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isResponse } from "@/lib/api";

// Rename / activate / deactivate a company.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (isResponse(admin)) return admin;

  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (body.name !== undefined) {
    if (!body.name.trim()) return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 });
    data.name = body.name.trim();
  }
  if (body.active !== undefined) data.active = !!body.active;

  const company = await prisma.company.update({
    where: { id: params.id },
    data,
    include: { _count: { select: { workspaces: true, users: true } } },
  });
  return NextResponse.json({ company });
}

// Delete a company (cascades workspaces/spaces/lists/tasks; users keep account, lose company).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (isResponse(admin)) return admin;
  if (admin.role !== "owner") {
    return NextResponse.json({ error: "Apenas o admin master pode excluir empresas." }, { status: 403 });
  }
  await prisma.company.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
