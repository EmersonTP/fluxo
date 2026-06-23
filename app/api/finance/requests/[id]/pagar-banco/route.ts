import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, approversOf, logStep, notifyFinance } from "@/lib/finance";
import { verifyPin } from "@/lib/pin";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

// Aprovar e pagar pelo banco — SOMENTE o pagador, com PIN.
// A execução real no Inter só roda se PAYMENTS_LIVE="true" (habilitada após teste).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const { pin, pagDestinoTipo, pagDestino } = await req.json();

  const r = await prisma.paymentRequest.findUnique({ where: { id: params.id } });
  if (!r) return NextResponse.json({ error: "Não encontrada." }, { status: 404 });

  // 1) Só o pagador (ou admin) aprova pagamento.
  const a = await approversOf(r.companyId);
  if (!isAdmin(user) && !a.pagadores.includes(user.id)) {
    return NextResponse.json({ error: "Só o responsável por pagamentos pode aprovar." }, { status: 403 });
  }
  // 2) Tem que estar conferida pelo financeiro.
  if (r.status !== "conferida") return NextResponse.json({ error: "A solicitação precisa estar conferida antes do pagamento." }, { status: 400 });
  // 3) Idempotência: não reprocessa o que já foi autorizado/pago.
  if (["autorizado", "aguardando_app", "enviado", "pago"].includes(r.pagBankStatus)) {
    return NextResponse.json({ error: `Pagamento já está em "${r.pagBankStatus}".` }, { status: 409 });
  }
  // 4) PIN (2º fator).
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { paymentPinHash: true } });
  if (!u?.paymentPinHash) return NextResponse.json({ error: "Defina seu PIN de pagamento antes (Configuração).", needPin: true }, { status: 400 });
  if (!verifyPin(String(pin || ""), u.paymentPinHash)) {
    await logAudit({ req, user, action: "update", entity: "solicitacao", entityId: r.id, companyId: r.companyId, meta: "PIN de pagamento incorreto" });
    return NextResponse.json({ error: "PIN incorreto." }, { status: 403 });
  }
  // 5) Destino do pagamento.
  const destinoTipo = pagDestinoTipo || r.pagDestinoTipo;
  const destino = pagDestino || r.pagDestino;
  if (!destino) return NextResponse.json({ error: "Informe a chave Pix ou o código de barras do credor." }, { status: 400 });

  // 6) Teto: acima dele, exige confirmação no app do Inter.
  const cfg = await prisma.integrationConfig.findUnique({ where: { companyId_provider: { companyId: r.companyId, provider: "inter" } }, select: { tetoPagamentoCents: true } });
  const teto = cfg?.tetoPagamentoCents ?? 500000;
  const valorCents = Math.round(r.valor * 100);
  const requerApp = valorCents > teto;

  const live = process.env.PAYMENTS_LIVE === "true";

  // Estado resultante (a execução real entra na F2).
  let bankStatus = requerApp ? "aguardando_app" : "autorizado";
  let info = requerApp
    ? "Acima do teto: aprovado na Sandra — finalize a liberação no app do Inter."
    : (live ? "enviado" : "Aprovado. Execução automática ainda em teste (F2) — será habilitada após validação.");
  if (!requerApp && live) bankStatus = "enviado"; // F2 fará a chamada real ao Inter aqui.

  await prisma.paymentRequest.update({
    where: { id: r.id },
    data: {
      pagDestinoTipo: destinoTipo, pagDestino: destino,
      pagBankStatus: bankStatus, pagRequerApp: requerApp,
      pagAprovadoPor: user.id, pagAprovadoEm: new Date(),
    },
  });
  await logStep(r.id, "comentario", r.status, r.status, { id: user.id, name: user.name }, `Pagamento aprovado (${destinoTipo || "pix"}) — ${requerApp ? "aguardando app Inter" : bankStatus}`);
  await logAudit({ req, user, action: "pay", entity: "solicitacao", entityId: r.id, companyId: r.companyId, meta: `aprovou pagamento #${r.code} R$ ${r.valor.toLocaleString("pt-BR")} — ${bankStatus}` });
  if (r.solicitanteId) await notifyFinance([r.solicitanteId], `Seu pagamento #${r.code} foi aprovado por ${user.name}${requerApp ? " (aguardando liberação no app do Inter)" : ""}.`, user.id);

  return NextResponse.json({ ok: true, bankStatus, requerApp, live, info });
}
