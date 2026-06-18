import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse, canAccessList } from "@/lib/api";

const PALETTE = ["#9250ac", "#ff7e59", "#1d9e75", "#534ab7", "#d85a30", "#3b82f6", "#ef4444", "#f59e0b"];

// Create a new status (group) on a list.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!(await canAccessList(user, params.id))) {
    return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  }

  const { name, color } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 });

  const count = await prisma.status.count({ where: { listId: params.id } });
  const status = await prisma.status.create({
    data: {
      name: name.trim(),
      color: color || PALETTE[count % PALETTE.length],
      order: count,
      type: "custom",
      listId: params.id,
    },
  });
  return NextResponse.json({ status });
}
