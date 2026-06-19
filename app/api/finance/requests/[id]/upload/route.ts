import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessCompany } from "@/lib/finance";
import { ensureUploadDir, safeStoredName, UPLOAD_DIR } from "@/lib/storage";

export const runtime = "nodejs";
const MAX_BYTES = 25 * 1024 * 1024;

// Anexa documento à solicitação (tag: nf | comprovante | cotacao | boleto | outro).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const r = await prisma.paymentRequest.findUnique({ where: { id: params.id }, select: { companyId: true } });
  if (!r) return NextResponse.json({ error: "Não encontrada." }, { status: 404 });
  if (!canAccessCompany(user, r.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  const tag = (form.get("tag") as string) || "outro";
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Arquivo muito grande (máx. 25 MB)." }, { status: 413 });

  await ensureUploadDir();
  const storedName = safeStoredName(file.name);
  await writeFile(path.join(UPLOAD_DIR, storedName), Buffer.from(await file.arrayBuffer()));

  const attachment = await prisma.attachment.create({
    data: { filename: file.name, mime: file.type || "application/octet-stream", size: file.size, storedName, requestId: params.id, tag },
  });
  return NextResponse.json({ attachment });
}
