import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";

// Tasks assigned to the logged-in user, across every list they can see.
export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const tasks = await prisma.task.findMany({
    where: { assignees: { some: { id: user.id } } },
    orderBy: [{ dateClosed: "asc" }, { dueDate: "asc" }],
    include: {
      status: true,
      assignees: { select: { id: true, name: true, color: true } },
      tags: { select: { id: true, name: true, color: true } },
      list: { select: { id: true, name: true } },
      _count: { select: { subtasks: true, comments: true } },
    },
  });
  return NextResponse.json({ tasks });
}
