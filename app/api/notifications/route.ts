import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";

export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return NextResponse.json({ notifications, unread });
}

// Mark all (or a specific) notification as read.
export async function PATCH(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const body = await req.json().catch(() => ({}));
  await prisma.notification.updateMany({
    where: { userId: user.id, ...(body.id ? { id: body.id } : {}) },
    data: { read: true },
  });
  return NextResponse.json({ ok: true });
}
