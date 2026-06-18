import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isResponse } from "@/lib/api";
import { companyScope } from "@/lib/auth";

// Privacidade do espaço: tornar privado e definir quem acessa (admin/owner).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (isResponse(admin)) return admin;

  const scope = companyScope(admin);
  if (scope !== null) {
    const sp = await prisma.space.findUnique({ where: { id: params.id }, select: { workspace: { select: { companyId: true } } } });
    if (!sp || sp.workspace.companyId !== scope) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (body.private !== undefined) data.private = !!body.private;
  if (body.memberIds !== undefined) data.members = { set: (body.memberIds as string[]).map((id) => ({ id })) };
  const space = await prisma.space.update({
    where: { id: params.id },
    data,
    select: { id: true, private: true, members: { select: { id: true } } },
  });
  return NextResponse.json({ space });
}
