import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

// Marca como vencidos os títulos pendentes cujo vencimento já passou (cálculo na leitura).
function withVencidos<T extends { status: string; vencimento: Date | null }>(r: T): T {
  if (r.status === "pendente" && r.vencimento && r.vencimento < new Date()) return { ...r, status: "vencida" };
  return r;
}

// Lista títulos a receber (livro), com filtro opcional por status.
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const u = new URL(req.url);
  const companyId = u.searchParams.get("company") || "";
  const status = u.searchParams.get("status") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ recebiveis: [] });
  const rows = await prisma.receivable.findMany({
    where: { companyId },
    orderBy: [{ vencimento: "asc" }, { createdAt: "desc" }],
    include: { cliente: { select: { nome: true } }, assinatura: { select: { id: true } } },
  });
  let recebiveis = rows.map((r: any) => withVencidos(r)).map((r: any) => ({
    id: r.id, descricao: r.descricao, valor: r.valorCents / 100, status: r.status,
    metodo: r.metodo, vencimento: r.vencimento, pagoEm: r.pagoEm, origem: r.origem,
    provider: r.provider, secureUrl: r.secureUrl, cliente: r.cliente?.nome || null,
    recorrente: !!r.assinatura,
  }));
  if (status) recebiveis = recebiveis.filter((r: any) => r.status === status);
  // resumo
  const soma = (f: (x: typeof recebiveis[number]) => boolean) => recebiveis.filter(f).reduce((s: number, x: typeof recebiveis[number]) => s + x.valor, 0);
  const mes = new Date().toISOString().slice(0, 7);
  const resumo = {
    aReceber: soma((r) => r.status === "pendente"),
    vencido: soma((r) => r.status === "vencida"),
    recebidoMes: soma((r) => r.status === "paga" && (r.pagoEm ? new Date(r.pagoEm).toISOString().slice(0, 7) === mes : false)),
  };
  return NextResponse.json({ recebiveis, resumo });
}

// Lança um título avulso (a receber).
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const b = await req.json();
  if (!b.companyId || !canAccessCompany(user, b.companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const valor = Number(b.valor);
  if (!b.descricao?.trim() || !valor || valor <= 0) return NextResponse.json({ error: "Descrição e valor obrigatórios." }, { status: 400 });
  const r = await prisma.receivable.create({
    data: {
      companyId: b.companyId, descricao: b.descricao.trim(), valorCents: Math.round(valor * 100),
      status: "pendente", metodo: b.metodo || null, provider: "manual", origem: "avulsa",
      vencimento: b.vencimento ? new Date(b.vencimento) : null,
      clienteId: b.clienteId || null,
    },
  });
  await logAudit({ req, user, action: "create", entity: "recebivel", entityId: r.id, companyId: b.companyId, meta: `R$ ${valor}` });
  return NextResponse.json({ ok: true, id: r.id });
}
