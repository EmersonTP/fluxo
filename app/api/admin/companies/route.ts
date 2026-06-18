import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isResponse } from "@/lib/api";

export async function GET() {
  const user = await requireAdmin();
  if (isResponse(user)) return user;

  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { workspaces: true, users: true } } },
  });
  return NextResponse.json({ companies });
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (isResponse(user)) return user;

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 });

  const company = await prisma.company.create({
    data: {
      name: name.trim(),
      workspaces: { create: { name: name.trim() } }, // empresa já nasce com 1 workspace
    },
    include: { _count: { select: { workspaces: true, users: true } } },
  });
  return NextResponse.json({ company });
}
