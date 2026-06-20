import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { accessibleCompanyIds } from "@/lib/auth";

// GET: list channels the user can see (their company + global) + unread counts. Owner/admin see all.
export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const ids = accessibleCompanyIds(user);
  const where: any = { kind: "channel" };
  if (ids !== null) where.OR = [{ companyId: { in: ids } }, { companyId: null }];
  const channels = await prisma.channel.findMany({
    where,
    orderBy: { name: "asc" },
    include: { company: { select: { name: true } }, _count: { select: { messages: true } } },
  });

  const reads = await prisma.channelRead.findMany({ where: { userId: user.id } });
  const readMap = new Map<string, Date>(reads.map((r: { channelId: string; lastReadAt: Date }) => [r.channelId, r.lastReadAt]));

  const withUnread = await Promise.all(
    channels.map(async (c: { id: string }) => {
      const since = readMap.get(c.id);
      const unread = await prisma.chatMessage.count({
        where: { channelId: c.id, parentId: null, userId: { not: user.id }, ...(since ? { createdAt: { gt: since } } : {}) },
      });
      return { ...c, unread };
    })
  );
  return NextResponse.json({ channels: withUnread });
}

// POST: create a channel (scoped to the user's company; owner/admin -> global by default).
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 });

  const channel = await prisma.channel.create({
    data: { name: name.trim().replace(/^#/, ""), companyId: user.companyId || null },
  });
  return NextResponse.json({ channel });
}
