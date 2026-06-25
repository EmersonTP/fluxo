import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";
import { logAudit } from "@/lib/audit";
import { uploadToDrive } from "@/lib/gdrive";
import { encryptField } from "@/lib/crypto";

export const runtime = "nodejs";

// Lista documentos (metadados, sem conteúdo) por empresa/cliente.
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const u = new URL(req.url);
  const companyId = u.searchParams.get("company") || "";
  const clienteId = u.searchParams.get("cliente") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ documentos: [] });
  if (!isAdmin(user)) return NextResponse.json({ documentos: [] });
  const rows = await prisma.documento.findMany({
    where: { companyId, ...(clienteId ? { clienteId } : {}) },
    orderBy: { createdAt: "desc" },
    select: { id: true, tipo: true, filename: true, mime: true, size: true, clienteId: true, driveFileId: true, createdAt: true },
  });
  return NextResponse.json({ documentos: rows });
}

// Sobe um documento (conteúdo em base64) — guardado no banco (durável).
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const b = await req.json();
  if (!b.companyId || !canAccessCompany(user, b.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (!b.filename || !b.base64) return NextResponse.json({ error: "Arquivo obrigatório." }, { status: 400 });
  const conteudo = String(b.base64).split(",").pop() || "";
  const size = Math.floor(conteudo.length * 0.75);
  if (size > 8 * 1024 * 1024) return NextResponse.json({ error: "Máximo 8 MB por arquivo." }, { status: 400 });
  const d = await prisma.documento.create({
    data: {
      companyId: b.companyId, clienteId: b.clienteId || null, credorId: b.credorId || null,
      tipo: ["contrato", "nf", "comprovante", "outro"].includes(b.tipo) ? b.tipo : "outro",
      filename: String(b.filename).slice(0, 160), mime: b.mime || "application/octet-stream", size,
      conteudo: encryptField(conteudo) ?? conteudo, uploadedBy: user.id,
    },
  });
  // replica no Google Drive, se a empresa estiver conectada (best-effort)
  try {
    const fileId = await uploadToDrive(b.companyId, d.filename, d.mime, Buffer.from(conteudo, "base64"), b.clienteNome || undefined);
    if (fileId) await prisma.documento.update({ where: { id: d.id }, data: { driveFileId: fileId } });
  } catch { /* Drive opcional */ }
  await logAudit({ req, user, action: "create", entity: "documento", entityId: d.id, companyId: b.companyId, meta: `${b.tipo} ${b.filename}` });
  return NextResponse.json({ ok: true, id: d.id });
}
