import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessChannel, MSG_INCLUDE } from "@/lib/chat";

// Lista as respostas (thread) de uma mensagem.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const parent = await prisma.chatMessage.findUnique({ where: { id: params.id }, select: { channelId: true } });
  if (!parent) return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  if (!(await canAccessChannel(user, parent.channelId))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const replies = await prisma.chatMessage.findMany({
    where: { parentId: params.id },
    orderBy: { createdAt: "asc" },
    include: MSG_INCLUDE,
  });
  return NextResponse.json({ replies });
}
