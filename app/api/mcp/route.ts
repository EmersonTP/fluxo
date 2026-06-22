import { NextResponse } from "next/server";

// Endpoint MCP remoto (Streamable HTTP / JSON-RPC) pra conectar a Sandra ao Claude
// como "conector personalizado". Protegido por uma chave na URL (?key=...).
// O Claude faz POST de mensagens JSON-RPC aqui; respondemos com JSON.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOOLS = [
  { name: "fluxo_list_hierarchy", description: "Lista a estrutura completa: workspaces, spaces, folders e listas (com IDs).", inputSchema: { type: "object", properties: {} } },
  { name: "fluxo_list_tasks", description: "Lista as tarefas de uma lista, com status, responsáveis e tags.", inputSchema: { type: "object", properties: { listId: { type: "string", description: "ID da lista" } }, required: ["listId"] } },
  { name: "fluxo_search_tasks", description: "Busca tarefas pelo nome em todas as listas.", inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] } },
  { name: "fluxo_get_task", description: "Detalhe completo de uma tarefa (status, responsáveis, tags, subtarefas, comentários, anexos, histórico).", inputSchema: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"] } },
  { name: "fluxo_create_task", description: "Cria uma tarefa em uma lista. statusId opcional.", inputSchema: { type: "object", properties: { listId: { type: "string" }, name: { type: "string" }, statusId: { type: "string" }, priority: { type: "string", enum: ["urgent", "high", "normal", "low"] }, dueDate: { type: "string", description: "ISO date, ex: 2026-07-01" }, assigneeIds: { type: "array", items: { type: "string" } }, parentId: { type: "string" } }, required: ["listId", "name"] } },
  { name: "fluxo_update_task", description: "Atualiza campos de uma tarefa: nome, status, prioridade, prazo, responsáveis ou tags.", inputSchema: { type: "object", properties: { taskId: { type: "string" }, name: { type: "string" }, statusId: { type: "string" }, priority: { type: "string" }, dueDate: { type: "string" }, assigneeIds: { type: "array", items: { type: "string" } }, tagIds: { type: "array", items: { type: "string" } } }, required: ["taskId"] } },
  { name: "fluxo_move_task", description: "Move uma tarefa para outro status (coluna do Kanban).", inputSchema: { type: "object", properties: { taskId: { type: "string" }, statusId: { type: "string" } }, required: ["taskId", "statusId"] } },
  { name: "fluxo_add_comment", description: "Adiciona um comentário a uma tarefa.", inputSchema: { type: "object", properties: { taskId: { type: "string" }, text: { type: "string" } }, required: ["taskId", "text"] } },
  { name: "fluxo_list_members", description: "Lista os usuários/membros (com IDs) para usar como responsáveis.", inputSchema: { type: "object", properties: {} } },

  // ===== Financeiro / ERP — PORTA ÚNICA E ESTÁVEL =====
  // Uma só ferramenta para todo o módulo financeiro. Novas capacidades entram
  // pelo parâmetro "action" (lado servidor), sem nunca mudar a lista de ferramentas
  // — então o conector não precisa ser reconectado a cada recurso novo.
  {
    name: "fluxo_financeiro",
    description:
      "Porta única do módulo Financeiro/ERP da Sandra (estável). Informe 'action' e 'params'. Ações:\n" +
      "• empresas — lista as empresas (com IDs). Sem params.\n" +
      "• contas_a_pagar — params: {companyId, status?}. Status: solicitada|aprovada_gestor|conferida|paga|recusada|cancelada.\n" +
      "• contas_a_receber — params: {companyId}. Recebíveis (boleto/Pix Inter): valor, vencimento, status.\n" +
      "• extrato — params: {companyId, de?, ate?} (YYYY-MM-DD). Extrato bancário Inter (crédito/débito).\n" +
      "• criar_conta_pagar — params: {companyId, areaName, descricao, valor, vencimento?, formaPagamento?, docTipo?, docNumero?, categoria?, observacao?}. Use ao ler um boleto/NF.\n" +
      "• acao_conta — params: {requestId, action(aprovar_gestor|conferir|pagar|recusar), note?, dataPagamento?}. Avança a conta na esteira.\n" +
      "• listar_canais — lista canais de chat (IDs). Sem params.\n" +
      "• postar_chat — params: {channelId, text}. Posta alerta/resumo no chat.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["empresas", "contas_a_pagar", "contas_a_receber", "extrato", "criar_conta_pagar", "acao_conta", "listar_canais", "postar_chat"] },
        params: { type: "object", description: "Parâmetros da ação (veja a descrição)." },
      },
      required: ["action"],
    },
  },
];

// Bases candidatas pra falar com a própria API.
// Loopback primeiro (sempre alcançável dentro do container do Railway);
// a URL pública entra só como fallback — chamar a si mesmo pela URL pública
// costuma dar "fetch failed" (DNS/proxy/loop) dentro do container.
function apiBases(req: Request): string[] {
  const port = process.env.PORT || "3000";
  const loop = `http://127.0.0.1:${port}`;
  let pub = "";
  try { pub = new URL(req.url).origin; } catch { /* ignore */ }
  const list = [loop];
  if (pub && pub !== loop) list.push(pub);
  return list;
}

async function api(bases: string[], key: string, path: string, method = "GET", body?: any) {
  let netErr: any = null;
  for (const base of bases) {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers: { "x-api-key": key, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
    } catch (e: any) {
      // Falha de rede nesta base: tenta a próxima (ex.: loopback -> pública)
      netErr = e;
      continue;
    }
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(`Sandra ${res.status}: ${data.error || text}`);
    return data;
  }
  throw new Error(`não foi possível alcançar o backend (${bases.join(", ")}): ${netErr?.message || "fetch failed"}`);
}

async function callTool(bases: string[], key: string, name: string, a: any = {}) {
  switch (name) {
    case "fluxo_list_hierarchy":
      return api(bases, key, "/api/hierarchy");
    case "fluxo_list_tasks":
      return api(bases, key, `/api/lists/${a.listId}`);
    case "fluxo_search_tasks":
      return api(bases, key, `/api/search?q=${encodeURIComponent(a.query)}&limit=${a.limit || 50}`);
    case "fluxo_get_task":
      return api(bases, key, `/api/tasks/${a.taskId}`);
    case "fluxo_create_task":
      return api(bases, key, "/api/tasks", "POST", a);
    case "fluxo_update_task":
    case "fluxo_move_task": {
      const { taskId, ...body } = a;
      return api(bases, key, `/api/tasks/${taskId}`, "PATCH", body);
    }
    case "fluxo_add_comment":
      return api(bases, key, "/api/comments", "POST", a);
    case "fluxo_list_members":
      return api(bases, key, "/api/members");

    // ===== Financeiro / ERP — porta única =====
    case "fluxo_financeiro": {
      const p = a.params || {};
      const enc = encodeURIComponent;
      switch (a.action) {
        case "empresas":
          return api(bases, key, "/api/finance/companies");
        case "contas_a_pagar":
          return api(bases, key, `/api/finance/requests?company=${enc(p.companyId)}${p.status ? `&status=${enc(p.status)}` : ""}`);
        case "contas_a_receber":
          return api(bases, key, `/api/finance/inter/cobranca?company=${enc(p.companyId)}`);
        case "extrato":
          return api(bases, key, `/api/finance/inter/extrato?company=${enc(p.companyId)}${p.de ? `&de=${p.de}` : ""}${p.ate ? `&ate=${p.ate}` : ""}`);
        case "criar_conta_pagar":
          return api(bases, key, "/api/finance/requests", "POST", p);
        case "acao_conta": {
          const { requestId, ...body } = p;
          return api(bases, key, `/api/finance/requests/${requestId}/action`, "POST", body);
        }
        case "listar_canais":
          return api(bases, key, "/api/channels");
        case "postar_chat":
          return api(bases, key, `/api/channels/${p.channelId}/messages`, "POST", { text: p.text });
        default:
          throw new Error(`Ação financeira desconhecida: ${a.action}`);
      }
    }

    default:
      throw new Error(`Ferramenta desconhecida: ${name}`);
  }
}

const SERVER_INFO = { name: "sandra", version: "1.0.0" };

async function handle(msg: any, bases: string[], key: string) {
  const { id, method, params } = msg || {};
  // Notificações (sem id) não exigem resposta
  if (id === undefined || id === null) return null;

  try {
    if (method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: params?.protocolVersion || "2025-03-26",
          capabilities: { tools: { listChanged: true } },
          serverInfo: SERVER_INFO,
        },
      };
    }
    if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
    if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
    if (method === "tools/call") {
      // A chave só é exigida pra EXECUTAR ferramentas (acessar dados), não pra conectar
      if (!key) {
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "Erro: token ausente na URL do conector (?key=...)." }], isError: true } };
      }
      try {
        const result = await callTool(bases, key, params?.name, params?.arguments || {});
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } };
      } catch (e: any) {
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `Erro: ${e.message}` }], isError: true } };
      }
    }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Método não suportado: ${method}` } };
  } catch (e: any) {
    return { jsonrpc: "2.0", id, error: { code: -32603, message: e.message } };
  }
}

function reqKey(req: Request) {
  const url = new URL(req.url);
  return url.searchParams.get("key") || req.headers.get("x-api-key") || (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
}

export async function POST(req: Request) {
  // NUNCA devolvemos 401 aqui: um 401 faz o Claude achar que é um servidor OAuth e tentar "fazer login".
  // A conexão (initialize/tools/list) é sempre aberta; a chave (mestra OU token pessoal) vale na execução.
  const key = reqKey(req);
  const bases = apiBases(req);
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ jsonrpc: "2.0", error: { code: -32700, message: "JSON inválido." } }, { status: 400 });

  // Suporta uma mensagem ou um lote (array)
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handle(m, bases, key)))).filter(Boolean);
    return out.length ? NextResponse.json(out) : new NextResponse(null, { status: 202 });
  }
  const res = await handle(body, bases, key);
  return res ? NextResponse.json(res) : new NextResponse(null, { status: 202 });
}

// Health check (sem 401, pra não acionar fluxo de login no cliente)
export async function GET(req: Request) {
  return NextResponse.json({ ok: true, server: SERVER_INFO, hasKey: !!reqKey(req), tools: TOOLS.map((t) => t.name) });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, Mcp-Session-Id, Mcp-Protocol-Version",
    },
  });
}
