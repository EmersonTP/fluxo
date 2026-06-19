import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";

// Lista a configuração de aprovadores de uma empresa.
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ config: [] });
  const config = await prisma.approverConfig.findMany({ where: { companyId } });
  return NextResponse.json({ config });
}

// Adiciona um aprovador (gestor por área, ou financeiro/pagador da empresa). Admin only.
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin configura." }, { status: 403 });

  const { companyId, role, userId, spaceId } = await req.json();
  if (!companyId || !role || !userId) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  if (!["gestor", "financeiro", "pagador"].includes(role)) return NextResponse.json({ error: "Papel inválido." }, { status: 400 });
  if (role === "gestor" && !spaceId) return NextResponse.json({ error: "Gestor precisa de área." }, { status: 400 });

  const dup = await prisma.approverConfig.findFirst({ where: { companyId, role, userId, spaceId: role === "gestor" ? spaceId : null } });
  if (dup) return NextResponse.json({ config: dup });

  const config = await prisma.approverConfig.create({
    data: { companyId, role, userId, spaceId: role === "gestor" ? spaceId : null },
  });
  return NextResponse.json({ config });
}

// Remove um aprovador. Admin only.
export async function DELETE(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin configura." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  await prisma.approverConfig.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
