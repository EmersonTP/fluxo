import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessChannel, MSG_INCLUDE } from "@/lib/chat";

// Editar a própria mensagem.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const msg = await prisma.chatMessage.findUnique({ where: { id: params.id }, select: { userId: true, channelId: true } });
  if (!msg) return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  if (msg.userId !== user.id) return NextResponse.json({ error: "Só dá pra editar a própria mensagem." }, { status: 403 });

  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
  const message = await prisma.chatMessage.update({
    where: { id: params.id },
    data: { text: text.trim(), editedAt: new Date() },
    include: MSG_INCLUDE,
  });
  return NextResponse.json({ message });
}

// Apagar a própria mensagem (admin/owner pode apagar qualquer uma).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const msg = await prisma.chatMessage.findUnique({ where: { id: params.id }, select: { userId: true, channelId: true } });
  if (!msg) return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  const isAdmin = user.role === "owner" || user.role === "admin";
  if (msg.userId !== user.id && !isAdmin) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  if (!(await canAccessChannel(user, msg.channelId))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  await prisma.chatMessage.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
