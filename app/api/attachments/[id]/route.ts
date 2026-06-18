import { NextResponse } from "next/server";
import { readFile, unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { UPLOAD_DIR } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const att = await prisma.attachment.findUnique({ where: { id: params.id } });
  if (!att) return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });

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

  const att = await prisma.attachment.findUnique({ where: { id: params.id } });
  if (!att) return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });

  try {
    await unlink(path.join(UPLOAD_DIR, att.storedName));
  } catch {
    /* file may already be gone */
  }
  await prisma.attachment.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
