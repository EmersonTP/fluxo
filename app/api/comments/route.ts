import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { createNotifications, mentionedUserIds } from "@/lib/notify";

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

  // Notify assignees + mentioned users about the new comment.
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { name: true, listId: true, assignees: { select: { id: true } } },
  });
  if (task) {
    const mentioned = await mentionedUserIds(text, null);
    const recipients = [...mentioned, ...task.assignees.map((a: { id: string }) => a.id)];
    await createNotifications(
      recipients,
      mentioned.length ? "mention" : "comment",
      `${user.name} comentou em "${task.name}"`,
      `/list/${task.listId}`,
      user.id
    );
  }

  return NextResponse.json({ comment });
}
