import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessChannel } from "@/lib/chat";

// Alterna (toggle) uma reação emoji na mensagem.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const msg = await prisma.chatMessage.findUnique({ where: { id: params.id }, select: { channelId: true } });
  if (!msg) return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  if (!(await canAccessChannel(user, msg.channelId))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const { emoji } = await req.json();
  if (!emoji) return NextResponse.json({ error: "Emoji obrigatório." }, { status: 400 });

  const existing = await prisma.reaction.findUnique({
    where: { messageId_userId_emoji: { messageId: params.id, userId: user.id, emoji } },
  });
  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.reaction.create({ data: { messageId: params.id, userId: user.id, emoji } });
  }
  const reactions = await prisma.reaction.findMany({
    where: { messageId: params.id },
    select: { id: true, emoji: true, userId: true },
  });
  return NextResponse.json({ reactions });
}
