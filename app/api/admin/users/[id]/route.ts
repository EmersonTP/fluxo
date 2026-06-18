import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isResponse } from "@/lib/api";

// Approve / change role / assign company / disable a user.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (isResponse(admin)) return admin;

  const body = await req.json();
  const data: any = {};
  if (body.status !== undefined) data.status = body.status; // pending | active | disabled
  if (body.role !== undefined) data.role = body.role; // owner | admin | member
  if (body.companyId !== undefined) data.companyId = body.companyId || null;
  if (body.name !== undefined) data.name = body.name;

  // Guard: don't allow removing the last owner
  if (body.role && body.role !== "owner") {
    const target = await prisma.user.findUnique({ where: { id: params.id } });
    if (target?.role === "owner") {
      const owners = await prisma.user.count({ where: { role: "owner" } });
      if (owners <= 1) {
        return NextResponse.json({ error: "Não é possível rebaixar o único owner." }, { status: 400 });
      }
    }
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      companyId: true,
      company: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ user });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (isResponse(admin)) return admin;

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (target?.role === "owner") {
    const owners = await prisma.user.count({ where: { role: "owner" } });
    if (owners <= 1) return NextResponse.json({ error: "Não é possível excluir o único owner." }, { status: 400 });
  }
  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
