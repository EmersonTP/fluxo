import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessChannel, MSG_INCLUDE } from "@/lib/chat";
import { ensureUploadDir, safeStoredName, UPLOAD_DIR } from "@/lib/storage";

export const runtime = "nodejs";
const MAX_BYTES = 25 * 1024 * 1024;

// Envia um arquivo/imagem como nova mensagem no canal.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!(await canAccessChannel(user, params.id))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  const parentId = (form.get("parentId") as string) || null;
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Arquivo muito grande (máx. 25 MB)." }, { status: 413 });

  await ensureUploadDir();
  const storedName = safeStoredName(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, storedName), buffer);

  const message = await prisma.chatMessage.create({
    data: {
      channelId: params.id,
      userId: user.id,
      parentId,
      text: "",
      attachments: {
        create: {
          filename: file.name,
          mime: file.type || "application/octet-stream",
          size: file.size,
          storedName,
        },
      },
    },
    include: MSG_INCLUDE,
  });
  return NextResponse.json({ message });
}
