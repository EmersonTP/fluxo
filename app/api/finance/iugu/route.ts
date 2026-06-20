import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";
import { testConnection, createWebHook } from "@/lib/iugu";

function baseUrl(req: Request) {
  const h = new Headers(req.headers);
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  return `${proto}://${host}`;
}

// Status da conexão (NUNCA retorna o token).
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ connected: false });
  const c = await prisma.integrationConfig.findUnique({
    where: { companyId_provider: { companyId, provider: "iugu" } },
    select: { accountId: true, testMode: true, connectedAt: true, lastSyncAt: true },
  });
  return NextResponse.json({ connected: !!c, accountId: c?.accountId || null, testMode: c?.testMode || false, connectedAt: c?.connectedAt || null, lastSyncAt: c?.lastSyncAt || null });
}

// Conectar/atualizar a credencial Iugu (admin). Testa, salva e registra os webhooks.
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin conecta a Iugu." }, { status: 403 });
  const { companyId, apiToken, accountId, testMode } = await req.json();
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Empresa fora do seu acesso." }, { status: 403 });
  if (!apiToken || typeof apiToken !== "string" || apiToken.length < 10) return NextResponse.json({ error: "Token inválido." }, { status: 400 });

  // 1) Testa a credencial antes de salvar
  const test = await testConnection({ apiToken, accountId });
  if (!test.ok) return NextResponse.json({ error: `A Iugu recusou a credencial: ${test.error || "verifique o token"}` }, { status: 400 });

  // 2) Salva (gera webhookToken se ainda não houver)
  const existing = await prisma.integrationConfig.findUnique({ where: { companyId_provider: { companyId, provider: "iugu" } }, select: { webhookToken: true } });
  const webhookToken = existing?.webhookToken || randomBytes(24).toString("hex");
  await prisma.integrationConfig.upsert({
    where: { companyId_provider: { companyId, provider: "iugu" } },
    create: { companyId, provider: "iugu", apiToken, accountId: accountId || null, webhookToken, testMode: !!testMode },
    update: { apiToken, accountId: accountId || null, testMode: !!testMode },
  });

  // 3) Registra os webhooks na Iugu (idempotente do nosso lado; a Iugu pode duplicar, mas ok)
  const url = `${baseUrl(req)}/api/iugu/webhook/${webhookToken}`;
  const events = ["invoice.status_changed", "invoice.created", "invoice.payment_failed"];
  const hookResults: Record<string, boolean> = {};
  for (const ev of events) {
    const r = await createWebHook({ apiToken, accountId }, ev, url);
    hookResults[ev] = r.ok;
  }

  return NextResponse.json({ connected: true, webhookRegistered: Object.values(hookResults).some(Boolean) });
}

// Desconectar (admin).
export async function DELETE(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  await prisma.integrationConfig.deleteMany({ where: { companyId, provider: "iugu" } });
  return NextResponse.json({ ok: true });
}
