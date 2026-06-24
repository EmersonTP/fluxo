import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";

export const runtime = "nodejs";

function slug(s: string) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "plano"; }

export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ planos: [] });
  const rows = await prisma.plano.findMany({ where: { companyId }, orderBy: { nome: "asc" }, include: { _count: { select: { assinaturas: true } } } });
  return NextResponse.json({ planos: rows.map((p: any) => ({ id: p.id, nome: p.nome, valor: p.valorCents / 100, intervalo: p.intervalo, intervaloTipo: p.intervaloTipo, ativo: p.ativo, assinaturas: p._count.assinaturas })) });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const b = await req.json();
  if (!b.companyId || !canAccessCompany(user, b.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const valor = Number(b.valor);
  if (!b.nome?.trim() || !valor || valor <= 0) return NextResponse.json({ error: "Nome e valor obrigatórios." }, { status: 400 });
  let identifier = slug(b.nome);
  if (await prisma.plano.findUnique({ where: { companyId_identifier: { companyId: b.companyId, identifier } } }).catch(() => null)) identifier += "-" + Date.now().toString(36).slice(-4);
  const p = await prisma.plano.create({
    data: { companyId: b.companyId, nome: b.nome.trim(), identifier, valorCents: Math.round(valor * 100), intervalo: Number(b.intervalo) || 1, intervaloTipo: b.intervaloTipo === "weeks" ? "weeks" : "months" },
  });
  return NextResponse.json({ ok: true, id: p.id });
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") || "";
  const p = await prisma.plano.findUnique({ where: { id }, select: { companyId: true } });
  if (!p || !canAccessCompany(user, p.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  await prisma.plano.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
