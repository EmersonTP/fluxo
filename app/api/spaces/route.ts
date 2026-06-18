import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";

export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const { name, workspaceId, color } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 });

  // Isolamento por empresa: membro só cria espaço na própria empresa
  if (workspaceId && user.role !== "owner" && user.role !== "admin") {
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { companyId: true } });
    if (!user.companyId || ws?.companyId !== user.companyId) {
      return NextResponse.json({ error: "Sem acesso a esta empresa." }, { status: 403 });
    }
  }

  let wsId = workspaceId;
  if (!wsId) {
    const ws = await prisma.workspace.findFirst();
    if (!ws) {
      const created = await prisma.workspace.create({ data: { name: "Meu Workspace" } });
      wsId = created.id;
    } else {
      wsId = ws.id;
    }
  }

  const space = await prisma.space.create({
    data: { name: name.trim(), workspaceId: wsId, color: color || "#6366f1" },
  });
  return NextResponse.json({ space });
}
