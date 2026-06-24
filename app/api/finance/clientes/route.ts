import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";
import { encryptField, decryptField, maskDoc } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

// Lista clientes da empresa (CPF/CNPJ mascarado).
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ clientes: [] });
  const rows = await prisma.cliente.findMany({ where: { companyId }, orderBy: { nome: "asc" } });
  const clientes = rows.map((c: any) => ({
    id: c.id, nome: c.nome, email: c.email, telefone: c.telefone, ativo: c.ativo,
    documento: maskDoc(decryptField(c.documentoEnc) ?? c.documento),
    consentimentoLGPD: c.consentimentoLGPD,
  }));
  return NextResponse.json({ clientes });
}

// Cria cliente (CPF/CNPJ cifrado em repouso).
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const b = await req.json();
  if (!b.companyId || !canAccessCompany(user, b.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (!b.nome?.trim()) return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 });
  const c = await prisma.cliente.create({
    data: {
      companyId: b.companyId, nome: b.nome.trim(), email: (b.email || "").trim(),
      telefone: b.telefone || null,
      rg: b.rg || null, cep: b.cep || null, logradouro: b.logradouro || null, numero: b.numero || null,
      complemento: b.complemento || null, bairro: b.bairro || null, cidade: b.cidade || null, uf: b.uf || null,
      documentoEnc: b.documento ? encryptField(String(b.documento)) : null,
      consentimentoLGPD: !!b.consentimentoLGPD,
      consentimentoEm: b.consentimentoLGPD ? new Date() : null,
      consentimentoBase: b.consentimentoLGPD ? "execução de contrato" : null,
    },
  });
  await logAudit({ req, user, action: "create", entity: "cliente", entityId: c.id, companyId: b.companyId });
  return NextResponse.json({ cliente: { id: c.id, nome: c.nome } });
}
