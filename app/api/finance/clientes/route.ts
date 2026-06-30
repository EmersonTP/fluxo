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

// Exclui um cliente (bloqueado se tiver recebíveis; cancela assinaturas antes via UI).
export async function DELETE(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") || "";
  const c = await prisma.cliente.findUnique({ where: { id }, select: { companyId: true, _count: { select: { recebiveis: true, assinaturas: true } } } });
  if (!c || !canAccessCompany(user, c.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (c._count.recebiveis > 0) return NextResponse.json({ error: "Cliente tem títulos a receber — não pode ser excluído." }, { status: 400 });
  await prisma.assinatura.deleteMany({ where: { clienteId: id } });
  await prisma.cliente.delete({ where: { id } });
  await logAudit({ req, user, action: "delete", entity: "cliente", entityId: id, companyId: c.companyId });
  return NextResponse.json({ ok: true });
}

// Edita campos do cliente (admin). Hoje: nome, email, telefone, RG, endereço, documento.
export async function PATCH(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const b = await req.json();
  const c = await prisma.cliente.findUnique({ where: { id: String(b.id || "") }, select: { companyId: true } });
  if (!c || !canAccessCompany(user, c.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const data: Record<string, unknown> = {};
  if (typeof b.nome === "string" && b.nome.trim()) data.nome = b.nome.trim();
  for (const k of ["email", "telefone", "rg", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf"]) {
    if (typeof b[k] === "string") data[k] = b[k] || null;
  }
  if (typeof b.documento === "string" && b.documento.trim()) data.documentoEnc = encryptField(b.documento.trim());
  await prisma.cliente.update({ where: { id: b.id }, data });
  await logAudit({ req, user, action: "update", entity: "cliente", entityId: b.id, companyId: c.companyId });
  return NextResponse.json({ ok: true });
}
