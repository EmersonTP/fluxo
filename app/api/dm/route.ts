import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { accessibleCompanyIds } from "@/lib/auth";

type Member = { id: string; name: string; color: string };

// GET: lista as conversas diretas (DMs) do usuário, com o outro participante e não lidas.
export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const dms = await prisma.channel.findMany({
    where: { kind: "dm", members: { some: { id: user.id } } },
    include: { members: { select: { id: true, name: true, color: true } } },
  });

  const reads = await prisma.channelRead.findMany({ where: { userId: user.id } });
  const readMap = new Map<string, Date>(reads.map((r: { channelId: string; lastReadAt: Date }) => [r.channelId, r.lastReadAt]));

  const out = await Promise.all(
    dms.map(async (c: { id: string; members: Member[] }) => {
      const other = c.members.find((m) => m.id !== user.id) || c.members[0];
      const since = readMap.get(c.id);
      const unread = await prisma.chatMessage.count({
        where: { channelId: c.id, userId: { not: user.id }, ...(since ? { createdAt: { gt: since } } : {}) },
      });
      const last = await prisma.chatMessage.findFirst({ where: { channelId: c.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
      return { id: c.id, other, unread, lastAt: last?.createdAt || null };
    })
  );
  out.sort((a, b) => (b.lastAt ? new Date(b.lastAt).getTime() : 0) - (a.lastAt ? new Date(a.lastAt).getTime() : 0));
  return NextResponse.json({ dms: out });
}

// POST { userId }: abre (ou cria) a conversa direta entre o usuário e outra pessoa.
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const { userId } = await req.json();
  if (!userId || userId === user.id) return NextResponse.json({ error: "Selecione uma pessoa válida." }, { status: 400 });

  // Isolamento: membro só fala com gente da própria empresa.
  const ids = accessibleCompanyIds(user);
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, color: true, companyId: true } });
  if (!target) return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
  if (ids !== null && !ids.includes(target.companyId ?? "")) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  let channel = await prisma.channel.findFirst({
    where: { kind: "dm", AND: [{ members: { some: { id: user.id } } }, { members: { some: { id: userId } } }] },
    select: { id: true },
  });
  if (!channel) {
    channel = await prisma.channel.create({
      data: {
        kind: "dm",
        name: "dm",
        companyId: user.companyId || target.companyId || null,
        members: { connect: [{ id: user.id }, { id: userId }] },
      },
      select: { id: true },
    });
  }
  return NextResponse.json({ id: channel.id, other: { id: target.id, name: target.name, color: target.color } });
}
