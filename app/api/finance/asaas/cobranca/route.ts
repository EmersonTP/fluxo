import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany, approversOf } from "@/lib/finance";
import { getAsaasConfig, createCustomer, createPayment } from "@/lib/asaas";

// Lista os recebíveis Asaas da empresa.
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ recebiveis: [] });
  const recebiveis = await prisma.receivable.findMany({
    where: { companyId, provider: "asaas" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, descricao: true, valorCents: true, status: true, metodo: true, vencimento: true, pagoEm: true, secureUrl: true, externalId: true, createdAt: true },
  });
  return NextResponse.json({ recebiveis });
}

// Emite uma cobrança na Asaas (boleto/PIX/cartão) e registra o recebível.
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const b = await req.json();
  const { companyId, valorReais, descricao, devedorNome, devedorDoc, billingType, vencimento } = b;
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const fin = await approversOf(companyId);
  if (!isAdmin(user) && !fin.financeiros.includes(user.id)) {
    return NextResponse.json({ error: "Só admin ou financeiro pode emitir cobrança." }, { status: 403 });
  }
  const valor = Number(valorReais);
  if (!valor || valor <= 0) return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
  if (!devedorNome) return NextResponse.json({ error: "Informe o nome do pagador." }, { status: 400 });
  if (!vencimento) return NextResponse.json({ error: "Informe o vencimento." }, { status: 400 });

  const cfg = await getAsaasConfig(companyId);
  if (!cfg) return NextResponse.json({ error: "Asaas não conectada nesta empresa." }, { status: 400 });

  // 1) cria/garante o cliente
  const cust = await createCustomer(cfg, { name: devedorNome, cpfCnpj: devedorDoc ? String(devedorDoc).replace(/\D/g, "") : undefined });
  if (!cust.ok || !cust.data?.id) return NextResponse.json({ error: `Asaas recusou o cliente: ${cust.error || "dados do pagador"}` }, { status: 400 });

  // 2) cria a cobrança
  const pay = await createPayment(cfg, {
    customer: cust.data.id,
    billingType: ["BOLETO", "PIX", "CREDIT_CARD"].includes(billingType) ? billingType : "UNDEFINED",
    value: valor,
    dueDate: String(vencimento).slice(0, 10),
    description: descricao || "Cobrança",
  });
  if (!pay.ok || !pay.data?.id) return NextResponse.json({ error: `Asaas recusou a cobrança: ${pay.error}` }, { status: 400 });

  const p = pay.data;
  const receivable = await prisma.receivable.create({
    data: {
      companyId,
      provider: "asaas",
      externalId: p.id,
      descricao: descricao || "Cobrança",
      valorCents: Math.round(valor * 100),
      status: "pendente",
      metodo: (billingType || "").toLowerCase() || null,
      vencimento: vencimento ? new Date(vencimento) : null,
      secureUrl: p.invoiceUrl || p.bankSlipUrl || null,
      origem: "avulsa",
    },
  });

  return NextResponse.json({ receivable, invoiceUrl: p.invoiceUrl || p.bankSlipUrl || null });
}
