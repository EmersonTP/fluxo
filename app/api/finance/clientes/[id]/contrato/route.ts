import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessCompany } from "@/lib/finance";
import { decryptField } from "@/lib/crypto";
import { contratoHtml } from "@/lib/contrato";
import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const c: any = await prisma.cliente.findUnique({
    where: { id: params.id },
    include: { assinaturas: { where: { status: "ativa" }, orderBy: { createdAt: "desc" }, take: 1, include: { plano: true } } },
  });
  if (!c || !canAccessCompany(user, c.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const a = c.assinaturas[0];
  const partes = [c.logradouro, c.numero && "nº " + c.numero, c.complemento, c.bairro, c.cidade && c.uf ? `${c.cidade}/${c.uf}` : (c.cidade || c.uf), c.cep && "CEP " + c.cep].filter(Boolean);
  const html = contratoHtml({
    nome: c.nome,
    cpf: decryptField(c.documentoEnc) ?? c.documento,
    rg: c.rg,
    endereco: partes.join(" — "),
    plano: a?.plano?.nome,
    valorMensal: a ? (a.valorCents ?? a.plano?.valorCents ?? 0) / 100 : null,
    diaCobranca: a?.diaCobranca ?? (a?.proximaCobranca ? new Date(a.proximaCobranca).getDate() : null),
    dataInicio: a?.proximaCobranca ? new Date(a.proximaCobranca).toLocaleDateString("pt-BR") : null,
  });
  await logAudit({ req, user, action: "view", entity: "cliente", entityId: c.id, companyId: c.companyId, meta: "gerar contrato" });
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
