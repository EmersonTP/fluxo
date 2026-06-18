import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";

const DEFAULT_STATUSES = [
  { name: "A fazer", color: "#a3a3a3", type: "open" },
  { name: "Fazendo", color: "#3b82f6", type: "custom" },
  { name: "Concluído", color: "#22c55e", type: "done" },
];

export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const { name, spaceId, folderId } = await req.json();
  if (!name?.trim() || (!spaceId && !folderId)) {
    return NextResponse.json({ error: "Nome e space/folder obrigatórios." }, { status: 400 });
  }

  const list = await prisma.list.create({
    data: {
      name: name.trim(),
      spaceId: spaceId || null,
      folderId: folderId || null,
      statuses: {
        create: DEFAULT_STATUSES.map((s, i) => ({ ...s, order: i })),
      },
    },
    include: { statuses: true },
  });

  return NextResponse.json({ list });
}
