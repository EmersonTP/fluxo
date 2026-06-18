import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { companyScope } from "@/lib/auth";

async function canAccess(user: { role: string; companyId: string | null }, docId: string) {
  const doc = await prisma.document.findUnique({ where: { id: docId } });
  if (!doc) return null;
  const scope = companyScope(user);
  if (scope === null) return doc;
  if (doc.companyId === null || doc.companyId === scope) return doc;
  return false;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const doc = await canAccess(user, params.id);
  if (doc === null) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  if (doc === false) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  return NextResponse.json({ document: doc });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const doc = await canAccess(user, params.id);
  if (doc === null) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  if (doc === false) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (body.title !== undefined) data.title = body.title.toString().slice(0, 200);
  if (body.content !== undefined) data.content = body.content.toString();
  const document = await prisma.document.update({ where: { id: params.id }, data });
  return NextResponse.json({ document });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const doc = await canAccess(user, params.id);
  if (doc === null) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  if (doc === false) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  await prisma.document.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
