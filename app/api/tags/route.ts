import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";

async function workspaceIdForList(listId: string): Promise<string | null> {
  const list = await prisma.list.findUnique({
    where: { id: listId },
    include: { space: true, folder: { include: { space: true } } },
  });
  return list?.space?.workspaceId || list?.folder?.space.workspaceId || null;
}

// GET /api/tags?listId=... -> tags available in that list's workspace
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const { searchParams } = new URL(req.url);
  const listId = searchParams.get("listId");
  let workspaceId = searchParams.get("workspaceId");

  if (!workspaceId && listId) workspaceId = await workspaceIdForList(listId);
  if (!workspaceId) {
    const ws = await prisma.workspace.findFirst();
    workspaceId = ws?.id || null;
  }
  if (!workspaceId) return NextResponse.json({ tags: [] });

  const tags = await prisma.tag.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ tags });
}

// POST /api/tags { name, color, listId | workspaceId }
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const { name, color, listId, workspaceId: wsBody } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 });

  let workspaceId = wsBody as string | null;
  if (!workspaceId && listId) workspaceId = await workspaceIdForList(listId);
  if (!workspaceId) {
    const ws = await prisma.workspace.findFirst();
    workspaceId = ws?.id || null;
  }
  if (!workspaceId) return NextResponse.json({ error: "Workspace não encontrado." }, { status: 400 });

  const tag = await prisma.tag.upsert({
    where: { workspaceId_name: { workspaceId, name: name.trim() } },
    update: { color: color || undefined },
    create: { name: name.trim(), color: color || "#a3a3a3", workspaceId },
  });
  return NextResponse.json({ tag });
}
