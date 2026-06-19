import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessChannel, MSG_INCLUDE } from "@/lib/chat";
import { createNotifications, mentionedUserIds } from "@/lib/notify";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!(await canAccessChannel(user, params.id))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const messages = await prisma.chatMessage.findMany({
    where: { channelId: params.id, parentId: null },
    orderBy: { createdAt: "asc" },
    take: 300,
    include: MSG_INCLUDE,
  });

  // Marca o canal como lido até agora.
  await prisma.channelRead.upsert({
    where: { channelId_userId: { channelId: params.id, userId: user.id } },
    update: { lastReadAt: new Date() },
    create: { channelId: params.id, userId: user.id },
  });

  return NextResponse.json({ messages });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!(await canAccessChannel(user, params.id))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const { text, parentId } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });

  const message = await prisma.chatMessage.create({
    data: { channelId: params.id, text: text.trim(), userId: user.id, parentId: parentId || null },
    include: MSG_INCLUDE,
  });

  // Notifica mencionados (@) e, em DM, o outro participante.
  const ch = await prisma.channel.findUnique({
    where: { id: params.id },
    select: { companyId: true, name: true, kind: true, members: { select: { id: true } } },
  });
  if (ch?.kind === "dm") {
    const others = ch.members.map((m: { id: string }) => m.id).filter((id: string) => id !== user.id);
    await createNotifications(others, "mention", `${user.name} te enviou uma mensagem`, "/chat", user.id);
  } else {
    const mentioned = await mentionedUserIds(text, ch?.companyId ?? null);
    await createNotifications(mentioned, "mention", `${user.name} mencionou você em #${ch?.name ?? "chat"}`, "/chat", user.id);
  }

  return NextResponse.json({ message });
}
