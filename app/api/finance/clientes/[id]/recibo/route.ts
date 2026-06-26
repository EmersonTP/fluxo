import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessCompany } from "@/lib/finance";
import { decryptField } from "@/lib/crypto";
import { reciboHtml } from "@/lib/recibo";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const c: any = await prisma.cliente.findUnique({ where: { id: params.id }, include: { assinaturas: { where: { status: "ativa" }, take: 1 }, company: { select: { name: true } } } });
  if (!c || !canAccessCompany(user, c.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const url = new URL(req.url);
  const valorParam = url.searchParams.get("valor");
  const assinValor = c.assinaturas?.[0]?.valorCents ? c.assinaturas[0].valorCents / 100 : null;
  const valor = valorParam ? Number(valorParam) : assinValor;
  const cpf = c.documentoEnc ? decryptField(c.documentoEnc) : null;

  const html = reciboHtml({
    paciente: c.nome,
    cpf,
    valor,
    data: url.searchParams.get("data") || null,
    competencia: url.searchParams.get("ref") || null,
    cidade: c.cidade || null,
    profissional: url.searchParams.get("prof") || null,
    crp: url.searchParams.get("crp") || null,
  });
  await logAudit({ req, user, action: "export", entity: "cliente", entityId: c.id, companyId: c.companyId, meta: "recibo reembolso" });
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
