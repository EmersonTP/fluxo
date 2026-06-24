import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptField } from "@/lib/crypto";
import { contratoHtml } from "@/lib/contrato";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const link = await prisma.onboardingLink.findUnique({ where: { token: params.token }, select: { companyId: true } });
  if (!link) return NextResponse.json({ error: "Link inválido." }, { status: 404 });
  const clienteId = new URL(req.url).searchParams.get("cliente") || "";
  const c: any = await prisma.cliente.findUnique({ where: { id: clienteId }, include: { assinaturas: { where: { status: "ativa" }, orderBy: { createdAt: "desc" }, take: 1, include: { plano: true } } } });
  if (!c || c.companyId !== link.companyId) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  const a = c.assinaturas[0];
  const partes = [c.logradouro, c.numero && "nº " + c.numero, c.complemento, c.bairro, c.cidade && c.uf ? `${c.cidade}/${c.uf}` : (c.cidade || c.uf), c.cep && "CEP " + c.cep].filter(Boolean);
  const html = contratoHtml({
    nome: c.nome, cpf: decryptField(c.documentoEnc) ?? c.documento, rg: c.rg, endereco: partes.join(" — "),
    plano: a?.plano?.nome, valorMensal: a ? (a.valorCents ?? a.plano?.valorCents ?? 0) / 100 : null,
    diaCobranca: a?.diaCobranca ?? null, dataInicio: a?.proximaCobranca ? new Date(a.proximaCobranca).toLocaleDateString("pt-BR") : null,
  });
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
