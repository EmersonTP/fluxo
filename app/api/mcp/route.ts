import { NextResponse } from "next/server";

// Endpoint MCP remoto (Streamable HTTP / JSON-RPC) pra conectar a Sandra ao Claude
// como "conector personalizado". Protegido por uma chave na URL (?key=...).
// O Claude faz POST de mensagens JSON-RPC aqui; respondemos com JSON.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = process.env.FLUXO_API_KEY || "";

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
];

async function api(origin: string, path: string, method = "GET", body?: any) {
  const res = await fetch(`${origin}${path}`, {
    method,
    headers: { "x-api-key": KEY, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(`Sandra ${res.status}: ${data.error || text}`);
  return data;
}

async function callTool(origin: string, name: string, a: any = {}) {
  switch (name) {
    case "fluxo_list_hierarchy":
      return api(origin, "/api/hierarchy");
    case "fluxo_list_tasks":
      return api(origin, `/api/lists/${a.listId}`);
    case "fluxo_search_tasks":
      return api(origin, `/api/search?q=${encodeURIComponent(a.query)}&limit=${a.limit || 50}`);
    case "fluxo_get_task":
      return api(origin, `/api/tasks/${a.taskId}`);
    case "fluxo_create_task":
      return api(origin, "/api/tasks", "POST", a);
    case "fluxo_update_task":
    case "fluxo_move_task": {
      const { taskId, ...body } = a;
      return api(origin, `/api/tasks/${taskId}`, "PATCH", body);
    }
    case "fluxo_add_comment":
      return api(origin, "/api/comments", "POST", a);
    case "fluxo_list_members":
      return api(origin, "/api/members");
    default:
      throw new Error(`Ferramenta desconhecida: ${name}`);
  }
}

const SERVER_INFO = { name: "sandra", version: "1.0.0" };

async function handle(msg: any, origin: string, authorized: boolean) {
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
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
        },
      };
    }
    if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
    if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
    if (method === "tools/call") {
      // A chave só é exigida pra EXECUTAR ferramentas (acessar dados), não pra conectar
      if (!authorized) {
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "Erro: chave de acesso inválida ou ausente na URL do conector (?key=...)." }], isError: true } };
      }
      try {
        const result = await callTool(origin, params?.name, params?.arguments || {});
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

function authed(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || req.headers.get("x-api-key") || (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return !!KEY && key === KEY;
}

export async function POST(req: Request) {
  // NUNCA devolvemos 401 aqui: um 401 faz o Claude achar que é um servidor OAuth e tentar "fazer login".
  // A conexão (initialize/tools/list) é sempre aberta; a chave só vale na execução de ferramentas.
  const authorized = authed(req);
  const origin = new URL(req.url).origin;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ jsonrpc: "2.0", error: { code: -32700, message: "JSON inválido." } }, { status: 400 });

  // Suporta uma mensagem ou um lote (array)
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handle(m, origin, authorized)))).filter(Boolean);
    return out.length ? NextResponse.json(out) : new NextResponse(null, { status: 202 });
  }
  const res = await handle(body, origin, authorized);
  return res ? NextResponse.json(res) : new NextResponse(null, { status: 202 });
}

// Health check (sem 401, pra não acionar fluxo de login no cliente)
export async function GET(req: Request) {
  return NextResponse.json({ ok: true, server: SERVER_INFO, authorized: authed(req), tools: TOOLS.map((t) => t.name) });
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
