import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

// Baixa o documento (decodifica o base64).
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const d = await prisma.documento.findUnique({ where: { id: params.id } });
  if (!d || !canAccessCompany(user, d.companyId) || !isAdmin(user)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  await logAudit({ req, user, action: "view", entity: "documento", entityId: d.id, companyId: d.companyId });
  const buf = Buffer.from(d.conteudo, "base64");
  return new NextResponse(buf, { headers: { "Content-Type": d.mime, "Content-Disposition": `inline; filename="${encodeURIComponent(d.filename)}"` } });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const d = await prisma.documento.findUnique({ where: { id: params.id }, select: { companyId: true } });
  if (!d || !canAccessCompany(user, d.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  await prisma.documento.delete({ where: { id: params.id } });
  await logAudit({ req, user, action: "delete", entity: "documento", entityId: params.id, companyId: d.companyId });
  return NextResponse.json({ ok: true });
}
