import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { isAdmin, canAccessCompany } from "@/lib/finance";
import { getInterConfig, registerCobrancaWebhook, registerPixWebhook } from "@/lib/inter";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

function baseUrl(req: Request) {
  const h = new Headers(req.headers);
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  return `${proto}://${host}`;
}

// (Re)registra os webhooks do Inter (Pix cobrança + Cobrança V3) e reporta o status de cada um.
// Usado pra garantir que o recebimento identificado avisa a Sandra pra dar baixa automática.
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!isAdmin(user)) return NextResponse.json({ error: "Só admin." }, { status: 403 });
  const companyId = new URL(req.url).searchParams.get("company") || "";
  if (!companyId || !canAccessCompany(user, companyId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const cfg = await getInterConfig(companyId);
  if (!cfg) return NextResponse.json({ error: "Inter não conectado." }, { status: 400 });
  const c = await prisma.integrationConfig.findUnique({ where: { companyId_provider: { companyId, provider: "inter" } }, select: { webhookToken: true, pixKey: true } });
  if (!c?.webhookToken) return NextResponse.json({ error: "Sem webhookToken (reconecte o Inter)." }, { status: 400 });

  const url = `${baseUrl(req)}/api/inter/webhook/${c.webhookToken}`;
  const out: any = { url };

  try { await registerCobrancaWebhook(cfg, url); out.cobranca = "ok"; } catch (e: any) { out.cobranca = "erro: " + (e?.message || e); }
  const chave = (c.pixKey || cfg.pixKey || "").trim();
  if (chave) { try { await registerPixWebhook(cfg, chave, url); out.pix = "ok"; } catch (e: any) { out.pix = "erro: " + (e?.message || e); } }
  else out.pix = "sem chave Pix cadastrada";

  await prisma.integrationConfig.update({ where: { companyId_provider: { companyId, provider: "inter" } }, data: { lastSyncAt: new Date() } }).catch(() => {});
  await logAudit({ req, user, action: "update", entity: "config", companyId, meta: `re-registro webhooks Inter: cob=${out.cobranca} pix=${out.pix}` });
  return NextResponse.json({ ok: true, ...out });
}
