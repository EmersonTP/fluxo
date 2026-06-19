import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse, canAccessList } from "@/lib/api";

// Reordena (e move de status) as tarefas de uma coluna. Recebe a ordem final dos IDs.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!(await canAccessList(user, params.id))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const { statusId, orderedIds } = await req.json().catch(() => ({}));
  if (!Array.isArray(orderedIds)) return NextResponse.json({ error: "orderedIds inválido." }, { status: 400 });

  // Atribui order = índice (espaçado) e garante o statusId da coluna
  await prisma.$transaction(
    orderedIds.map((tid: string, i: number) =>
      prisma.task.update({
        where: { id: tid },
        data: { order: i * 100, ...(statusId ? { statusId } : {}) },
      })
    )
  );
  return NextResponse.json({ ok: true });
}
