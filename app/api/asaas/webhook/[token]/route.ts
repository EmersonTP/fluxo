import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapAsaasStatus } from "@/lib/asaas";

export const dynamic = "force-dynamic";

// Webhook da Asaas. URL traz um token secreto por empresa; a Asaas também manda
// o authToken no header "asaas-access-token" — validamos os dois.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const cfg = await prisma.integrationConfig.findFirst({
    where: { provider: "asaas", webhookToken: params.token },
    select: { id: true, companyId: true, webhookToken: true },
  });
  if (!cfg) return NextResponse.json({ ok: true }); // token inválido — ignora

  // Validação extra do header (quando presente)
  const headerTok = req.headers.get("asaas-access-token");
  if (headerTok && headerTok !== cfg.webhookToken) return NextResponse.json({ ok: true });

  let body: any = null;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: true }); }
  const p = body?.payment;
  if (!p?.id) return NextResponse.json({ ok: true }); // evento sem cobrança (ex.: validação)

  const status = mapAsaasStatus(p.status || "");
  const valorCents = p.value != null ? Math.round(Number(p.value) * 100) : undefined;
  const pago = ["paga"].includes(status);
  const pagoEm = pago ? (p.paymentDate ? new Date(p.paymentDate) : new Date()) : null;
  const venc = p.dueDate ? new Date(p.dueDate) : undefined;

  const existing = await prisma.receivable.findFirst({
    where: { provider: "asaas", externalId: p.id, companyId: cfg.companyId },
    select: { id: true },
  });
  if (existing) {
    await prisma.receivable.update({
      where: { id: existing.id },
      data: { status, ...(valorCents != null ? { valorCents } : {}), ...(venc ? { vencimento: venc } : {}), pagoEm, ...(p.invoiceUrl ? { secureUrl: p.invoiceUrl } : {}) },
    });
  } else {
    await prisma.receivable.create({
      data: {
        companyId: cfg.companyId,
        provider: "asaas",
        externalId: p.id,
        descricao: p.description || "Cobrança Asaas",
        valorCents: valorCents ?? 0,
        status,
        metodo: (p.billingType || "").toLowerCase() || null,
        vencimento: venc || null,
        pagoEm,
        secureUrl: p.invoiceUrl || null,
        origem: p.subscription ? "assinatura" : "avulsa",
      },
    });
  }

  await prisma.integrationConfig.update({ where: { id: cfg.id }, data: { lastSyncAt: new Date() } });
  return NextResponse.json({ ok: true });
}
