import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapCobrancaSituacao } from "@/lib/inter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Webhook do Inter (API de Cobrança v3). A URL traz um token secreto por empresa.
// Inter envia eventos quando uma cobrança muda de situação (ex.: RECEBIDO).
// Aceita também o formato de webhook Pix imediato (pix: [...]) por compatibilidade.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const cfg = await prisma.integrationConfig.findFirst({
    where: { provider: "inter", webhookToken: params.token },
    select: { id: true, companyId: true },
  });
  if (!cfg) return NextResponse.json({ ok: true }); // token inválido — ignora

  let body: any = null;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: true }); }

  // --- Formato Cobrança v3: array de cobranças, ou { cobranca } / { cobrancas: [...] } ---
  const cobList: any[] = Array.isArray(body)
    ? body
    : Array.isArray(body?.cobrancas) ? body.cobrancas
    : body?.cobranca ? [body.cobranca]
    : body?.codigoSolicitacao ? [body]
    : [];

  let handled = false;
  for (const c of cobList) {
    const codigo = c.codigoSolicitacao || c.codigo_solicitacao;
    const situacao = c.situacao || c.situacaoCobranca;
    if (!codigo || !situacao) continue;
    handled = true;
    const status = mapCobrancaSituacao(situacao);
    const pago = status === "paga";
    const valorRec = c.valorTotalRecebido ?? c.cobranca?.valorTotalRecebido;
    const valorCents = valorRec != null ? Math.round(Number(valorRec) * 100) : undefined;
    const pagoEm = pago ? (c.dataSituacao ? new Date(c.dataSituacao) : new Date()) : null;
    const e2e = c.txidPix || c.endToEndId || null;

    const existing = await prisma.receivable.findFirst({
      where: { provider: "inter", externalId: codigo, companyId: cfg.companyId },
      select: { id: true },
    });
    if (existing) {
      await prisma.receivable.update({
        where: { id: existing.id },
        data: { status, pagoEm, ...(e2e ? { endToEndId: e2e } : {}), ...(valorCents != null && pago ? { valorCents } : {}) },
      });
    } else {
      await prisma.receivable.create({
        data: {
          companyId: cfg.companyId,
          provider: "inter",
          externalId: codigo,
          descricao: "Cobrança (boleto/Pix)",
          valorCents: valorCents ?? 0,
          status,
          metodo: "boleto_pix",
          pagoEm,
          endToEndId: e2e,
          origem: "avulsa",
        },
      });
    }
  }
  if (handled) {
    await prisma.integrationConfig.update({ where: { id: cfg.id }, data: { lastSyncAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  // --- Compatibilidade: webhook Pix imediato { pix: [ { txid, ... } ] } ---
  const pixList: any[] = Array.isArray(body?.pix) ? body.pix : [];
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
      await prisma.receivable.create({
        data: {
          companyId: cfg.companyId, provider: "inter", externalId: txid,
          descricao: "Recebimento Pix", valorCents: valorCents ?? 0, status: "paga",
          metodo: "pix", pagoEm, endToEndId: e2e, origem: "avulsa",
        },
      });
    }
  }

  await prisma.integrationConfig.update({ where: { id: cfg.id }, data: { lastSyncAt: new Date() } });
  return NextResponse.json({ ok: true });
}
