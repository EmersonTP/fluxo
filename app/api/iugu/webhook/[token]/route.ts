import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInvoice, mapInvoiceStatus } from "@/lib/iugu";

export const dynamic = "force-dynamic";

// Recebe os gatilhos (webhooks) da Iugu. A URL contém um token secreto por empresa.
// Responde 200 sempre (pra Iugu não ficar reenviando), mas só processa se o token for válido.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const cfg = await prisma.integrationConfig.findFirst({
    where: { provider: "iugu", webhookToken: params.token },
    select: { id: true, companyId: true, apiToken: true, accountId: true },
  });
  if (!cfg) return NextResponse.json({ ok: true }); // token inválido — ignora silenciosamente

  // Parse: Iugu manda form-urlencoded (event, data[id], data[status]...) ou JSON.
  let event = "";
  let invoiceId = "";
  let statusHint = "";
  try {
    const raw = await req.text();
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = JSON.parse(raw);
      event = j.event || "";
      invoiceId = j.data?.id || j.data_id || "";
      statusHint = j.data?.status || "";
    } else {
      const p = new URLSearchParams(raw);
      event = p.get("event") || "";
      invoiceId = p.get("data[id]") || p.get("data_id") || "";
      statusHint = p.get("data[status]") || "";
    }
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (!event.startsWith("invoice") || !invoiceId) return NextResponse.json({ ok: true });

  // Busca a fatura completa na Iugu (fonte da verdade).
  const inv = await getInvoice({ apiToken: cfg.apiToken, accountId: cfg.accountId }, invoiceId);
  const d = inv.ok ? inv.data : null;
  const status = mapInvoiceStatus(d?.status || statusHint || "pending");
  const valorCents = typeof d?.total_cents === "number" ? d.total_cents : 0;
  const due = d?.due_date ? new Date(d.due_date) : null;
  const paidAt = status === "paga" ? (d?.paid_at ? new Date(d.paid_at) : new Date()) : null;
  const metodo = d?.payment_method || null;
  const secureUrl = d?.secure_url || null;
  const subId = d?.subscription_id || null;
  const customerId = d?.customer_id || null;
  const descricao = d?.items?.[0]?.description || d?.email || "Fatura Iugu";

  // Liga ao cliente local (se existir pelo iuguCustomerId) e à assinatura local.
  const cliente = customerId ? await prisma.cliente.findFirst({ where: { companyId: cfg.companyId, iuguCustomerId: customerId }, select: { id: true } }) : null;
  const assinatura = subId ? await prisma.assinatura.findFirst({ where: { companyId: cfg.companyId, iuguSubscriptionId: subId }, select: { id: true } }) : null;

  await prisma.receivable.upsert({
    where: { iuguInvoiceId: invoiceId },
    create: {
      companyId: cfg.companyId,
      iuguInvoiceId: invoiceId,
      descricao,
      valorCents,
      status,
      metodo,
      vencimento: due,
      pagoEm: paidAt,
      secureUrl,
      origem: subId ? "assinatura" : "avulsa",
      clienteId: cliente?.id || null,
      assinaturaId: assinatura?.id || null,
    },
    update: {
      status,
      valorCents,
      metodo,
      vencimento: due,
      pagoEm: paidAt,
      secureUrl,
      ...(cliente ? { clienteId: cliente.id } : {}),
      ...(assinatura ? { assinaturaId: assinatura.id } : {}),
    },
  });

  await prisma.integrationConfig.update({ where: { id: cfg.id }, data: { lastSyncAt: new Date() } });
  return NextResponse.json({ ok: true });
}
