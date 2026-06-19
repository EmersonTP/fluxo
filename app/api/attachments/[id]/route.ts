import { NextResponse } from "next/server";
import { readFile, unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse, canAccessList } from "@/lib/api";
import { canAccessChannel } from "@/lib/chat";
import { canAccessCompany } from "@/lib/finance";
import { UPLOAD_DIR } from "@/lib/storage";

export const runtime = "nodejs";

type U = { id: string; role: string; companyId: string | null };

function attWithRefs(id: string) {
  return prisma.attachment.findUnique({
    where: { id },
    include: {
      task: { select: { listId: true } },
      message: { select: { channelId: true } },
      request: { select: { companyId: true } },
    },
  });
}

// Acesso a um anexo: tarefa (lista) | mensagem (canal) | solicitação financeira (empresa).
async function canAccessAttachment(user: U, att: { task: { listId: string } | null; message: { channelId: string } | null; request: { companyId: string } | null }) {
  if (att.task) return canAccessList(user, att.task.listId);
  if (att.message) return canAccessChannel(user, att.message.channelId);
  if (att.request) return canAccessCompany(user, att.request.companyId);
  return false;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const att = await attWithRefs(params.id);
  if (!att) return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  if (!(await canAccessAttachment(user, att))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  try {
    const data = await readFile(path.join(UPLOAD_DIR, att.storedName));
    return new NextResponse(data, {
      headers: {
        "Content-Type": att.mime,
        "Content-Disposition": `inline; filename="${encodeURIComponent(att.filename)}"`,
        "Content-Length": String(att.size),
      },
    });
  } catch {
    return NextResponse.json({ error: "Arquivo indisponível." }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const att = await attWithRefs(params.id);
  if (!att) return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  if (!(await canAccessAttachment(user, att))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  try {
    await unlink(path.join(UPLOAD_DIR, att.storedName));
  } catch {
    /* file may already be gone */
  }
  await prisma.attachment.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
