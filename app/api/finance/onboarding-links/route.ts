import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ links: [] });
  const rows = await prisma.onboardingLink.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, include: { plano: { select: { nome: true, valorCents: true } } } });
  return NextResponse.json({ links: rows.map((l: any) => ({ id: l.id, token: l.token, label: l.label, ativo: l.ativo, usos: l.usos, plano: l.plano?.nome, valor: ((l.valorCents ?? l.plano?.valorCents) || 0) / 100 })) });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const b = await req.json();
  if (!b.companyId || !canAccessCompany(user, b.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  if (!b.planoId) return NextResponse.json({ error: "Escolha um plano." }, { status: 400 });
  const token = crypto.randomBytes(18).toString("base64url");
  const l = await prisma.onboardingLink.create({
    data: { companyId: b.companyId, planoId: b.planoId, token, label: b.label || null, valorCents: b.valor ? Math.round(Number(b.valor) * 100) : null, diaCobranca: b.diaCobranca ? Number(b.diaCobranca) : null },
  });
  return NextResponse.json({ ok: true, token: l.token });
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") || "";
  const l = await prisma.onboardingLink.findUnique({ where: { id }, select: { companyId: true } });
  if (!l || !canAccessCompany(user, l.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  await prisma.onboardingLink.update({ where: { id }, data: { ativo: false } });
  return NextResponse.json({ ok: true });
}
