import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { canAccessCompany, isAdmin } from "@/lib/finance";

// Lista credores de uma empresa (busca opcional por nome/documento).
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company") || "";
  const q = (url.searchParams.get("q") || "").trim();
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ credores: [] });

  const credores = await prisma.credor.findMany({
    where: {
      companyId,
      ...(q ? { OR: [{ nome: { contains: q, mode: "insensitive" } }, { documento: { contains: q } }] } : {}),
    },
    orderBy: { nome: "asc" },
  });
  return NextResponse.json({ credores });
}

// Cria credor (CPF/CNPJ obrigatório; único por empresa).
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const body = await req.json();
  const companyId = body.companyId;
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (!body.nome?.trim()) return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 });
  const documento = String(body.documento || "").replace(/\D/g, "");
  if (documento.length !== 11 && documento.length !== 14) return NextResponse.json({ error: "CPF (11) ou CNPJ (14) válido é obrigatório." }, { status: 400 });

  const dup = await prisma.credor.findFirst({ where: { companyId, documento } });
  if (dup) return NextResponse.json({ error: `Já existe credor com esse documento: ${dup.nome}.`, credor: dup }, { status: 409 });

  const credor = await prisma.credor.create({
    data: {
      companyId,
      nome: body.nome.trim(),
      documento,
      tipo: body.tipo || "fornecedor",
      pixKey: body.pixKey || null,
      bankInfo: body.bankInfo || null,
      categoriaPadrao: body.categoriaPadrao || null,
    },
  });
  return NextResponse.json({ credor });
}

// Edita um credor (admin).
export async function PATCH(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const b = await req.json();
  const c = await prisma.credor.findUnique({ where: { id: b.id }, select: { companyId: true } });
  if (!c || !canAccessCompany(user, c.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const data: Record<string, unknown> = {};
  if (typeof b.nome === "string" && b.nome.trim()) data.nome = b.nome.trim();
  if (typeof b.tipo === "string" && b.tipo) data.tipo = b.tipo;
  if (typeof b.pixKey === "string") data.pixKey = b.pixKey || null;
  if (typeof b.categoriaPadrao === "string") data.categoriaPadrao = b.categoriaPadrao || null;
  if (typeof b.documento === "string" && b.documento) {
    const documento = b.documento.replace(/\D/g, "");
    if (documento.length !== 11 && documento.length !== 14) return NextResponse.json({ error: "CPF (11) ou CNPJ (14) válido." }, { status: 400 });
    const dup = await prisma.credor.findFirst({ where: { companyId: c.companyId, documento, id: { not: b.id } } });
    if (dup) return NextResponse.json({ error: `Já existe credor com esse documento: ${dup.nome}.` }, { status: 409 });
    data.documento = documento;
  }
  const credor = await prisma.credor.update({ where: { id: b.id }, data });
  return NextResponse.json({ credor });
}

// Exclui um credor (admin). Bloqueia se houver solicitações vinculadas.
export async function DELETE(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") || "";
  const c = await prisma.credor.findUnique({ where: { id }, select: { companyId: true } });
  if (!c || !canAccessCompany(user, c.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  try {
    await prisma.credor.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Credor tem lançamentos/solicitações vinculados — não pode ser excluído." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
