import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { ensureUploadDir, safeStoredName, UPLOAD_DIR } from "@/lib/storage";

export const runtime = "nodejs";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const attachments = await prisma.attachment.findMany({
    where: { taskId: params.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ attachments });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande (máx. 25 MB)." }, { status: 413 });
  }

  await ensureUploadDir();
  const storedName = safeStoredName(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, storedName), buffer);

  const attachment = await prisma.attachment.create({
    data: {
      filename: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
      storedName,
      taskId: params.id,
    },
  });
  return NextResponse.json({ attachment });
}
