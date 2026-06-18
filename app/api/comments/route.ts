import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";

export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const { taskId, text } = await req.json();
  if (!taskId || !text?.trim()) {
    return NextResponse.json({ error: "Texto obrigatório." }, { status: 400 });
  }
  const comment = await prisma.comment.create({
    data: { taskId, text: text.trim(), userId: user.id },
    include: { user: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json({ comment });
}
