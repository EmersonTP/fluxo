import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessCompany } from "@/lib/finance";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const c = await prisma.credor.findUnique({ where: { id: params.id } });
  if (!c) return NextResponse.json({ error: "Credor não encontrado." }, { status: 404 });
  if (!canAccessCompany(user, c.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const body = await req.json();
  const data: any = {};
  for (const k of ["nome", "tipo", "pixKey", "bankInfo", "categoriaPadrao"]) if (body[k] !== undefined) data[k] = body[k];
  if (body.documento !== undefined) {
    const d = String(body.documento).replace(/\D/g, "");
    if (d.length !== 11 && d.length !== 14) return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
    data.documento = d;
  }
  const credor = await prisma.credor.update({ where: { id: params.id }, data });
  return NextResponse.json({ credor });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const c = await prisma.credor.findUnique({ where: { id: params.id } });
  if (!c) return NextResponse.json({ error: "Credor não encontrado." }, { status: 404 });
  if (!canAccessCompany(user, c.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  await prisma.credor.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
