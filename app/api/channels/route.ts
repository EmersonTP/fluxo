import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { companyScope } from "@/lib/auth";

// GET: list channels the user can see (their company + global). Owner/admin see all.
export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const scope = companyScope(user);
  const where = scope ? { OR: [{ companyId: scope }, { companyId: null }] } : {};
  const channels = await prisma.channel.findMany({
    where,
    orderBy: { name: "asc" },
    include: { company: { select: { name: true } }, _count: { select: { messages: true } } },
  });
  return NextResponse.json({ channels });
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
