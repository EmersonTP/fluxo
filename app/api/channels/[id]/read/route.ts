import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessChannel } from "@/lib/chat";

// Marca o canal como lido (zera o contador de não lidas).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!(await canAccessChannel(user, params.id))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  await prisma.channelRead.upsert({
    where: { channelId_userId: { channelId: params.id, userId: user.id } },
    update: { lastReadAt: new Date() },
    create: { channelId: params.id, userId: user.id },
  });
  return NextResponse.json({ ok: true });
}
