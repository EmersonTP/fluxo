import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { companyScope } from "@/lib/auth";

async function canAccessChannel(user: { role: string; companyId: string | null }, channelId: string) {
  const ch = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!ch) return false;
  const scope = companyScope(user);
  if (scope === null) return true; // owner/admin
  return ch.companyId === scope || ch.companyId === null;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!(await canAccessChannel(user, params.id))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const messages = await prisma.chatMessage.findMany({
    where: { channelId: params.id },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { user: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json({ messages });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!(await canAccessChannel(user, params.id))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });

  const message = await prisma.chatMessage.create({
    data: { channelId: params.id, text: text.trim(), userId: user.id },
    include: { user: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json({ message });
}
