import https from "https";
import { prisma } from "./prisma";

// API Banking do Banco Inter (padrão BACEN Pix). Toda chamada usa mTLS (cert+key).
// Produção: cdpj.partners.bancointer.com.br. (Homologação usa o mesmo host com credenciais de teste.)
const INTER_HOST = process.env.INTER_HOST || "https://cdpj.partners.bancointer.com.br";

// Escopos SÓ de recebimento — nunca pagamento/transferência.
export const INTER_SCOPES = "cob.write cob.read pix.read webhook.write webhook.read extrato.read";

export type InterCfg = {
  clientId: string;
  clientSecret: string;
  certPem?: string | null;  // opcional: só se a integração exigir mTLS de cliente
  keyPem?: string | null;
  contaCorrente?: string | null;
  pixKey?: string | null;
};

// Requisição HTTPS (com mTLS de cliente se houver cert+key; senão TLS normal).
function mtls(
  cfg: InterCfg,
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: string
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(`${INTER_HOST}${path}`);
    const opts: import("https").RequestOptions = {
      host: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: { ...headers, ...(body ? { "Content-Length": Buffer.byteLength(body).toString() } : {}) },
    };
    if (cfg.certPem && cfg.keyPem) { opts.cert = cfg.certPem; opts.key = cfg.keyPem; }
    const req = https.request(
      opts,
      (res) => {
        let buf = "";
        res.on("data", (d) => (buf += d));
        res.on("end", () => resolve({ status: res.statusCode || 0, text: buf }));
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// Cache de token por clientId (token vale ~1h).
const tokenCache = new Map<string, { token: string; exp: number }>();

export async function getInterToken(cfg: InterCfg, scope = ""): Promise<string> {
  const cached = tokenCache.get(cfg.clientId);
  if (cached && cached.exp > Date.now() + 30_000) return cached.token;
  // Sem 'scope' o Inter devolve o token com os escopos que a integração tem (evita invalid_scope).
  const fields: Record<string, string> = {
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "client_credentials",
  };
  if (scope) fields.scope = scope;
  const form = new URLSearchParams(fields).toString();
  const r = await mtls(cfg, "POST", "/oauth/v2/token", { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, form);
  if (r.status < 200 || r.status >= 300) throw new Error(`Inter OAuth ${r.status}: ${r.text || "(sem corpo — provável escopo ou client_secret incorreto)"}`);
  const j = JSON.parse(r.text);
  tokenCache.set(cfg.clientId, { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 });
  return j.access_token;
}

async function api<T = any>(cfg: InterCfg, method: string, path: string, body?: Record<string, unknown>): Promise<T> {
  const token = await getInterToken(cfg);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  if (cfg.contaCorrente) headers["x-conta-corrente"] = cfg.contaCorrente;
  const payload = body ? JSON.stringify(body) : undefined;
  if (payload) headers["Content-Type"] = "application/json";
  const r = await mtls(cfg, method, path, headers, payload);
  let data: any;
  try { data = JSON.parse(r.text); } catch { data = { raw: r.text }; }
  if (r.status < 200 || r.status >= 300) throw new Error(`Inter ${r.status}: ${data.detail || data.title || r.text}`);
  return data;
}

// Testa a credencial: só pega um token (não move nada).
export async function testInter(cfg: InterCfg) {
  await getInterToken(cfg);
  return true;
}

// Cria/atualiza uma cobrança Pix imediata (recebimento). Payload no padrão BACEN.
export function createPixCob(cfg: InterCfg, txid: string, payload: Record<string, unknown>) {
  return api(cfg, "PUT", `/pix/v2/cob/${txid}`, payload);
}
export function getPixCob(cfg: InterCfg, txid: string) {
  return api(cfg, "GET", `/pix/v2/cob/${txid}`);
}
// Registra o webhook Pix para a chave de recebimento.
export function registerPixWebhook(cfg: InterCfg, chave: string, webhookUrl: string) {
  return api(cfg, "PUT", `/pix/v2/webhook/${encodeURIComponent(chave)}`, { webhookUrl });
}
// ===== API Cobrança v3 (boleto + Pix / "bolepix") — escopo "Cobranças" =====
// Emite uma cobrança (boleto com Pix). Retorna { codigoSolicitacao }.
export function createCobranca(cfg: InterCfg, body: Record<string, unknown>) {
  return api(cfg, "POST", "/cobranca/v3/cobrancas", body);
}
// Detalhe da cobrança (status, boleto/linha digitável, pixCopiaECola).
export function getCobranca(cfg: InterCfg, codigoSolicitacao: string) {
  return api(cfg, "GET", `/cobranca/v3/cobrancas/${codigoSolicitacao}`);
}
// Registra o webhook de Cobrança (avisa quando a cobrança muda de situação).
export function registerCobrancaWebhook(cfg: InterCfg, webhookUrl: string) {
  return api(cfg, "PUT", "/cobranca/v3/webhook", { webhookUrl });
}

// Extrato (Fase 2 — conciliação).
export function getExtrato(cfg: InterCfg, dataInicio: string, dataFim: string) {
  return api(cfg, "GET", `/banking/v2/extrato?dataInicio=${dataInicio}&dataFim=${dataFim}`);
}

// Mapeia a situação da cobrança Inter pro nosso status.
export function mapCobrancaSituacao(s: string): string {
  switch ((s || "").toUpperCase()) {
    case "RECEBIDO": case "MARCADO_RECEBIDO": case "PAGO": return "paga";
    case "A_RECEBER": case "EM_PROCESSAMENTO": return "pendente";
    case "ATRASADO": case "EXPIRADO": return "vencida";
    case "CANCELADO": return "cancelada";
    case "PROTESTO": return "em_protesto";
    default: return "pendente";
  }
}

export async function getInterConfig(companyId: string): Promise<InterCfg | null> {
  const c = await prisma.integrationConfig.findUnique({ where: { companyId_provider: { companyId, provider: "inter" } } });
  if (!c || !c.clientId || !c.clientSecret) return null;
  return { clientId: c.clientId, clientSecret: c.clientSecret, certPem: c.certPem, keyPem: c.keyPem, contaCorrente: c.contaCorrente, pixKey: c.pixKey };
}

// txid Pix: 26–35 caracteres alfanuméricos.
export function genTxid() {
  const s = ("sandra" + Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9]/g, "");
  return s.slice(0, 32).padEnd(26, "0");
}
