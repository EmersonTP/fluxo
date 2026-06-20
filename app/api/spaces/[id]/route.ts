import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isResponse } from "@/lib/api";
import { accessibleCompanyIds } from "@/lib/auth";

// Privacidade do espaço: tornar privado e definir quem acessa (admin/owner).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (isResponse(admin)) return admin;

  const ids = accessibleCompanyIds(admin);
  if (ids !== null) {
    const sp = await prisma.space.findUnique({ where: { id: params.id }, select: { workspace: { select: { companyId: true } } } });
    if (!sp || !ids.includes(sp.workspace.companyId ?? "")) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (body.name !== undefined && body.name.trim()) data.name = body.name.trim();
  if (body.private !== undefined) data.private = !!body.private;
  if (body.memberIds !== undefined) data.members = { set: (body.memberIds as string[]).map((id) => ({ id })) };
  const space = await prisma.space.update({
    where: { id: params.id },
    data,
    select: { id: true, private: true, members: { select: { id: true } } },
  });
  return NextResponse.json({ space });
}
