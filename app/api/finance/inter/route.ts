import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";
import { testInter, registerPixWebhook, InterCfg } from "@/lib/inter";

export const runtime = "nodejs";

function baseUrl(req: Request) {
  const h = new Headers(req.headers);
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  return `${proto}://${host}`;
}

// Status da conexão Inter (NUNCA retorna credenciais).
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ connected: false });
  const c = await prisma.integrationConfig.findUnique({
    where: { companyId_provider: { companyId, provider: "inter" } },
    select: { contaCorrente: true, pixKey: true, testMode: true, connectedAt: true, lastSyncAt: true },
  });
  return NextResponse.json({ connected: !!c, contaCorrente: c?.contaCorrente || null, pixKey: c?.pixKey || null, testMode: c?.testMode || false, connectedAt: c?.connectedAt || null, lastSyncAt: c?.lastSyncAt || null });
}

// Conectar Inter (admin): testa o token via mTLS, salva e registra o webhook Pix.
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin conecta o banco." }, { status: 403 });
  const b = await req.json();
  const { companyId, clientId, clientSecret, certPem, keyPem, contaCorrente, pixKey, testMode } = b;
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Empresa fora do seu acesso." }, { status: 403 });
  if (!clientId || !clientSecret || !certPem || !keyPem || !pixKey) {
    return NextResponse.json({ error: "Preencha client_id, client_secret, certificado, chave (key) e a chave Pix de recebimento." }, { status: 400 });
  }

  const cfg: InterCfg = { clientId, clientSecret, certPem, keyPem, contaCorrente: contaCorrente || null, pixKey };

  // 1) Testa a credencial (só pega token — não move dinheiro)
  try {
    await testInter(cfg);
  } catch (e: any) {
    return NextResponse.json({ error: `O Inter recusou a credencial: ${e.message || "verifique client_id/secret e o certificado"}` }, { status: 400 });
  }

  // 2) Salva (gera webhookToken se ainda não houver)
  const existing = await prisma.integrationConfig.findUnique({ where: { companyId_provider: { companyId, provider: "inter" } }, select: { webhookToken: true } });
  const webhookToken = existing?.webhookToken || randomBytes(24).toString("hex");
  await prisma.integrationConfig.upsert({
    where: { companyId_provider: { companyId, provider: "inter" } },
    create: { companyId, provider: "inter", apiToken: "", webhookToken, testMode: !!testMode, clientId, clientSecret, certPem, keyPem, contaCorrente: contaCorrente || null, pixKey },
    update: { clientId, clientSecret, certPem, keyPem, contaCorrente: contaCorrente || null, pixKey, testMode: !!testMode },
  });

  // 3) Registra o webhook Pix na chave de recebimento
  const url = `${baseUrl(req)}/api/inter/webhook/${webhookToken}`;
  let webhookOk = false;
  let webhookErr = "";
  try {
    await registerPixWebhook(cfg, pixKey, url);
    webhookOk = true;
  } catch (e: any) {
    webhookErr = e.message || "falha ao registrar webhook";
  }

  return NextResponse.json({ connected: true, webhookRegistered: webhookOk, webhookError: webhookErr || undefined });
}

// Desconectar (admin).
export async function DELETE(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  await prisma.integrationConfig.deleteMany({ where: { companyId, provider: "inter" } });
  return NextResponse.json({ ok: true });
}
