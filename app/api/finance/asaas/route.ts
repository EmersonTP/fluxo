import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";
import { testConnection, createWebhook } from "@/lib/asaas";

function baseUrl(req: Request) {
  const h = new Headers(req.headers);
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  return `${proto}://${host}`;
}

// Status (nunca retorna a chave).
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ connected: false });
  const c = await prisma.integrationConfig.findUnique({
    where: { companyId_provider: { companyId, provider: "asaas" } },
    select: { testMode: true, connectedAt: true, lastSyncAt: true },
  });
  return NextResponse.json({ connected: !!c, testMode: c?.testMode || false, connectedAt: c?.connectedAt || null, lastSyncAt: c?.lastSyncAt || null });
}

// Conectar (admin): testa a chave, salva e registra o webhook.
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin conecta a Asaas." }, { status: 403 });
  const { companyId, apiToken, testMode } = await req.json();
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Empresa fora do seu acesso." }, { status: 403 });
  if (!apiToken || typeof apiToken !== "string" || apiToken.length < 20) return NextResponse.json({ error: "Chave inválida." }, { status: 400 });

  const cfg = { apiToken, testMode: !!testMode };
  const test = await testConnection(cfg);
  if (!test.ok) return NextResponse.json({ error: `A Asaas recusou a chave: ${test.error || "verifique a chave/ambiente"}` }, { status: 400 });

  const existing = await prisma.integrationConfig.findUnique({ where: { companyId_provider: { companyId, provider: "asaas" } }, select: { webhookToken: true } });
  const webhookToken = existing?.webhookToken || randomBytes(24).toString("hex");
  await prisma.integrationConfig.upsert({
    where: { companyId_provider: { companyId, provider: "asaas" } },
    create: { companyId, provider: "asaas", apiToken, webhookToken, testMode: !!testMode },
    update: { apiToken, testMode: !!testMode },
  });

  const url = `${baseUrl(req)}/api/asaas/webhook/${webhookToken}`;
  const hook = await createWebhook(cfg, url, webhookToken, user.email);
  return NextResponse.json({ connected: true, webhookRegistered: hook.ok, webhookError: hook.ok ? undefined : hook.error });
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  await prisma.integrationConfig.deleteMany({ where: { companyId, provider: "asaas" } });
  return NextResponse.json({ ok: true });
}
