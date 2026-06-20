import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Webhook Pix do Inter. A URL traz um token secreto por empresa.
// Inter envia { pix: [ { txid, endToEndId, valor, horario, ... } ] } quando uma cobrança é paga.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const cfg = await prisma.integrationConfig.findFirst({
    where: { provider: "inter", webhookToken: params.token },
    select: { id: true, companyId: true },
  });
  if (!cfg) return NextResponse.json({ ok: true }); // token inválido — ignora

  let body: any = null;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: true }); }

  // Aceita { pix: [...] } ou um array direto.
  const pixList: any[] = Array.isArray(body) ? body : Array.isArray(body?.pix) ? body.pix : [];
  if (!pixList.length) return NextResponse.json({ ok: true }); // healthcheck/validação

  for (const p of pixList) {
    const txid = p.txid || p.txId;
    if (!txid) continue;
    const valorCents = p.valor != null ? Math.round(Number(p.valor) * 100) : undefined;
    const pagoEm = p.horario ? new Date(p.horario) : new Date();
    const e2e = p.endToEndId || p.end_to_end_id || null;

    const existing = await prisma.receivable.findFirst({
      where: { provider: "inter", externalId: txid, companyId: cfg.companyId },
      select: { id: true },
    });
    if (existing) {
      await prisma.receivable.update({
        where: { id: existing.id },
        data: { status: "paga", pagoEm, endToEndId: e2e, ...(valorCents != null ? { valorCents } : {}) },
      });
    } else {
      // Pagamento de uma cobrança que não nasceu na Sandra: registra mesmo assim.
      await prisma.receivable.create({
        data: {
          companyId: cfg.companyId,
          provider: "inter",
          externalId: txid,
          descricao: "Recebimento Pix",
          valorCents: valorCents ?? 0,
          status: "paga",
          metodo: "pix",
          pagoEm,
          endToEndId: e2e,
          origem: "avulsa",
        },
      });
    }
  }

  await prisma.integrationConfig.update({ where: { id: cfg.id }, data: { lastSyncAt: new Date() } });
  return NextResponse.json({ ok: true });
}
