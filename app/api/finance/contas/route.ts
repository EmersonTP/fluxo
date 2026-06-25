import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";

export const runtime = "nodejs";

// Lista as contas bancárias da empresa, com saldo de movimento (soma dos lançamentos importados).
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ contas: [] });
  const contas = await prisma.bankAccount.findMany({
    where: { companyId },
    orderBy: { ordem: "asc" },
    include: { _count: { select: { transacoes: true } } },
  });
  return NextResponse.json({ contas });
}

// Cria uma conta bancária (admin).
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const b = await req.json();
  if (!b.companyId || !canAccessCompany(user, b.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (!b.nome?.trim()) return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 });
  const n = await prisma.bankAccount.count({ where: { companyId: b.companyId } });
  const conta = await prisma.bankAccount.create({
    data: { companyId: b.companyId, nome: b.nome.trim(), banco: b.banco || "outro", conexao: b.conexao === "inter" ? "inter" : "manual", tipo: ["caixa", "cartao", "socio"].includes(b.tipo) ? b.tipo : "caixa", ordem: n },
  });
  return NextResponse.json({ conta });
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") || "";
  const c = await prisma.bankAccount.findUnique({ where: { id }, select: { companyId: true } });
  if (!c || !canAccessCompany(user, c.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  await prisma.bankAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const b = await req.json();
  const c = await prisma.bankAccount.findUnique({ where: { id: b.id }, select: { companyId: true } });
  if (!c || !canAccessCompany(user, c.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const data: Record<string, unknown> = {};
  if (b.tipo) data.tipo = ["caixa", "cartao", "socio"].includes(b.tipo) ? b.tipo : "caixa";
  if (b.nome?.trim()) data.nome = b.nome.trim();
  await prisma.bankAccount.update({ where: { id: b.id }, data });
  return NextResponse.json({ ok: true });
}
