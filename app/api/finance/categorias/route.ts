import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";

// Lista categorias de uma empresa (filtra por tipo opcional). Usado na cascata do formulário.
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company") || "";
  const tipo = url.searchParams.get("tipo") || undefined; // receita | despesa
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ categorias: [] });
  const categorias = await prisma.categoria.findMany({
    where: { companyId, ativo: true, ...(tipo ? { tipo } : {}) },
    orderBy: [{ grupo: "asc" }, { ordem: "asc" }, { nome: "asc" }],
    select: { id: true, grupo: true, nome: true, tipo: true, dre: true },
  });
  return NextResponse.json({ categorias });
}

// Cria uma categoria avulsa. Admin only.
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin gerencia categorias." }, { status: 403 });
  const { companyId, grupo, nome, tipo, dre } = await req.json();
  if (!companyId || !grupo || !nome) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  if (!canAccessCompany(user, companyId)) return NextResponse.json({ error: "Empresa fora do seu acesso." }, { status: 403 });
  const categoria = await prisma.categoria.upsert({
    where: { companyId_grupo_nome: { companyId, grupo, nome } },
    create: { companyId, grupo, nome, tipo: tipo === "receita" ? "receita" : "despesa", dre: dre || null },
    update: { tipo: tipo === "receita" ? "receita" : "despesa", dre: dre || null, ativo: true },
  });
  return NextResponse.json({ categoria });
}

// Desativa uma categoria. Admin only.
export async function DELETE(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin gerencia categorias." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const cat = await prisma.categoria.findUnique({ where: { id }, select: { companyId: true } });
  if (!cat || !canAccessCompany(user, cat.companyId)) return NextResponse.json({ error: "Não encontrada." }, { status: 404 });
  await prisma.categoria.update({ where: { id }, data: { ativo: false } });
  return NextResponse.json({ ok: true });
}
