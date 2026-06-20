import { prisma } from "./prisma";

const IUGU_BASE = "https://api.iugu.com/v1";

export type IuguCfg = { apiToken: string; accountId?: string | null };

// Chamada autenticada à Iugu. O token vai no header Basic (nunca na URL).
export async function iuguFetch<T = any>(
  cfg: IuguCfg,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const auth = Buffer.from(`${cfg.apiToken}:`).toString("base64");
  let res: Response;
  try {
    res = await fetch(`${IUGU_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 0, data: null, error: "Falha de rede ao falar com a Iugu." };
  }
  let data: any = null;
  try { data = await res.json(); } catch { /* sem corpo */ }
  if (!res.ok) {
    const msg = data?.errors ? JSON.stringify(data.errors) : data?.message || `HTTP ${res.status}`;
    return { ok: false, status: res.status, data, error: typeof msg === "string" ? msg : JSON.stringify(msg) };
  }
  return { ok: true, status: res.status, data };
}

// Pega a config Iugu da empresa (com o token). Só use no servidor.
export async function getIuguConfig(companyId: string): Promise<IuguCfg | null> {
  const c = await prisma.integrationConfig.findUnique({
    where: { companyId_provider: { companyId, provider: "iugu" } },
    select: { apiToken: true, accountId: true },
  });
  return c ? { apiToken: c.apiToken, accountId: c.accountId } : null;
}

// Testa a credencial: lista 1 cliente (chamada barata e autenticada).
export async function testConnection(cfg: IuguCfg) {
  return iuguFetch(cfg, "GET", "/customers?limit=1");
}

// ---- Recursos ----
export function createCustomer(cfg: IuguCfg, c: { name: string; email: string; cpf_cnpj?: string; phone?: string }) {
  return iuguFetch(cfg, "POST", "/customers", c);
}

export function createPlan(cfg: IuguCfg, p: { name: string; identifier: string; interval: number; interval_type: string; value_cents: number; payable_with: string[] }) {
  return iuguFetch(cfg, "POST", "/plans", p);
}

export function createSubscription(cfg: IuguCfg, s: { customer_id: string; plan_identifier: string; payable_with?: string; only_on_charge_success?: boolean }) {
  return iuguFetch(cfg, "POST", "/subscriptions", s);
}

export function suspendSubscription(cfg: IuguCfg, id: string) {
  return iuguFetch(cfg, "POST", `/subscriptions/${id}/suspend`);
}
export function activateSubscription(cfg: IuguCfg, id: string) {
  return iuguFetch(cfg, "POST", `/subscriptions/${id}/activate`);
}

export function getInvoice(cfg: IuguCfg, id: string) {
  return iuguFetch(cfg, "GET", `/invoices/${id}`);
}

// Cobrança avulsa (fatura direta sem assinatura).
export function createInvoice(cfg: IuguCfg, inv: Record<string, unknown>) {
  return iuguFetch(cfg, "POST", "/invoices", inv);
}

// Registra o webhook (gatilho) na Iugu para um evento.
export function createWebHook(cfg: IuguCfg, event: string, url: string) {
  return iuguFetch(cfg, "POST", "/web_hooks", { event, url });
}

// Mapeia o status de fatura da Iugu para o nosso.
export function mapInvoiceStatus(iuguStatus: string): string {
  switch (iuguStatus) {
    case "paid": return "paga";
    case "pending": return "pendente";
    case "expired": return "vencida";
    case "canceled": return "cancelada";
    case "refunded": case "partially_refunded": case "chargeback": return "estornada";
    case "in_protest": return "em_protesto";
    default: return "pendente";
  }
}
