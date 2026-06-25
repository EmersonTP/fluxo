import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany, periodoFechado } from "@/lib/finance";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

// Lança UMA transação manual numa conta (ex.: gasto de sócio pago na PF).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const conta = await prisma.bankAccount.findUnique({ where: { id: params.id }, select: { id: true, companyId: true } });
  if (!conta || !canAccessCompany(user, conta.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const b = await req.json();
  const data = b.data ? new Date(String(b.data) + "T12:00:00") : null;
  const valor = Math.abs(Number(b.valor) || 0);
  const tipo = b.tipo === "credito" ? "credito" : "debito";
  const descricao = String(b.descricao || "").slice(0, 200);
  if (!data || isNaN(data.getTime())) return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  if (!valor) return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
  if (!descricao.trim()) return NextResponse.json({ error: "Descreva o lançamento." }, { status: 400 });
  if (await periodoFechado(conta.companyId, data)) return NextResponse.json({ error: "Período fechado: este mês já foi fechado e não aceita novos lançamentos." }, { status: 409 });

  // valor com sinal: débito negativo, crédito positivo (consistente com o import)
  const signed = tipo === "debito" ? -valor : valor;
  const fitId = "man_" + crypto.createHash("md5").update(`${conta.id}|${b.data}|${signed}|${descricao}`).digest("hex").slice(0, 20);
  try {
    await prisma.bankTransaction.create({
      data: { accountId: conta.id, companyId: conta.companyId, data, valor: signed, tipo, descricao, origem: "manual", fitId },
    });
  } catch { return NextResponse.json({ error: "Lançamento idêntico já existe." }, { status: 409 }); }
  await logAudit({ req, user, action: "create", entity: "extrato", companyId: conta.companyId, meta: `lançamento manual: ${descricao} ${signed}` });
  return NextResponse.json({ ok: true });
}
