import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";

// Tarefas atribuídas ao usuário logado, escopadas pela empresa ativa (cookie fx_company).
export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const companyId = cookies().get("fx_company")?.value || "";
  const scope = companyId
    ? {
        list: {
          OR: [
            { space: { workspace: { companyId } } },
            { folder: { space: { workspace: { companyId } } } },
          ],
        },
      }
    : {};

  const tasks = await prisma.task.findMany({
    where: { assignees: { some: { id: user.id } }, ...scope },
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
