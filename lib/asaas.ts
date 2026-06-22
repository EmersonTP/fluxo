import { prisma } from "./prisma";

// Asaas API v3. Auth por header access_token. Sandbox e produção têm hosts e chaves distintos.
const HOST_PROD = "https://api.asaas.com/v3";
const HOST_SANDBOX = "https://api-sandbox.asaas.com/v3";

export type AsaasCfg = { apiToken: string; testMode?: boolean };

function host(cfg: AsaasCfg) {
  return cfg.testMode ? HOST_SANDBOX : HOST_PROD;
}

export async function asaasFetch<T = any>(
  cfg: AsaasCfg,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  let res: Response;
  try {
    res = await fetch(`${host(cfg)}${path}`, {
      method,
      headers: {
        access_token: cfg.apiToken,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, data: null, error: "Falha de rede ao falar com a Asaas." };
  }
  let data: any = null;
  try { data = await res.json(); } catch { /* sem corpo */ }
  if (!res.ok) {
    const msg = data?.errors?.[0]?.description || data?.message || `HTTP ${res.status}`;
    return { ok: false, status: res.status, data, error: typeof msg === "string" ? msg : JSON.stringify(msg) };
  }
  return { ok: true, status: res.status, data };
}

// Testa credencial: lista 1 cliente (chamada barata e autenticada).
export function testConnection(cfg: AsaasCfg) {
  return asaasFetch(cfg, "GET", "/customers?limit=1");
}

// ---- Recursos ----
export function createCustomer(cfg: AsaasCfg, c: { name: string; cpfCnpj?: string; email?: string; phone?: string }) {
  return asaasFetch(cfg, "POST", "/customers", c);
}

// Cobrança avulsa. billingType: BOLETO | PIX | CREDIT_CARD | UNDEFINED (cliente escolhe).
export function createPayment(cfg: AsaasCfg, p: { customer: string; billingType: string; value: number; dueDate: string; description?: string }) {
  return asaasFetch(cfg, "POST", "/payments", p);
}

export function getPayment(cfg: AsaasCfg, id: string) {
  return asaasFetch(cfg, "GET", `/payments/${id}`);
}

// Assinatura recorrente. cycle: MONTHLY | WEEKLY | YEARLY...
export function createSubscription(cfg: AsaasCfg, s: { customer: string; billingType: string; value: number; nextDueDate: string; cycle: string; description?: string }) {
  return asaasFetch(cfg, "POST", "/subscriptions", s);
}

// Registra um webhook na conta Asaas (authToken volta no header asaas-access-token).
export function createWebhook(cfg: AsaasCfg, url: string, authToken: string, email: string) {
  return asaasFetch(cfg, "POST", "/webhooks", {
    name: "Sandra",
    url,
    email,
    enabled: true,
    interrupted: false,
    authToken,
    sendType: "SEQUENTIALLY",
    apiVersion: 3,
    events: ["PAYMENT_CREATED", "PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_OVERDUE", "PAYMENT_REFUNDED", "PAYMENT_DELETED"],
  });
}

export async function getAsaasConfig(companyId: string): Promise<(AsaasCfg & { webhookToken: string }) | null> {
  const c = await prisma.integrationConfig.findUnique({
    where: { companyId_provider: { companyId, provider: "asaas" } },
    select: { apiToken: true, testMode: true, webhookToken: true },
  });
  if (!c || !c.apiToken) return null;
  return { apiToken: c.apiToken, testMode: c.testMode, webhookToken: c.webhookToken };
}

// Mapeia status/evento da Asaas pro nosso.
export function mapAsaasStatus(status: string): string {
  switch (status) {
    case "RECEIVED": case "CONFIRMED": case "RECEIVED_IN_CASH": return "paga";
    case "PENDING": case "AWAITING_RISK_ANALYSIS": return "pendente";
    case "OVERDUE": return "vencida";
    case "REFUNDED": case "REFUND_REQUESTED": case "CHARGEBACK_REQUESTED": case "CHARGEBACK_DISPUTE": return "estornada";
    case "DELETED": return "cancelada";
    default: return "pendente";
  }
}
