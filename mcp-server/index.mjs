#!/usr/bin/env node
/**
 * Servidor MCP do Fluxo — deixa o Claude operar a sua ferramenta de tarefas.
 *
 * Variáveis de ambiente:
 *   FLUXO_BASE_URL  ex: https://fluxo.up.railway.app
 *   FLUXO_API_KEY   a mesma chave configurada no app (variável FLUXO_API_KEY)
 *
 * Roda via stdio (configurado no Claude Desktop / Cowork).
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const BASE = (process.env.FLUXO_BASE_URL || "").replace(/\/$/, "");
const KEY = process.env.FLUXO_API_KEY || "";

if (!BASE || !KEY) {
  console.error("Defina FLUXO_BASE_URL e FLUXO_API_KEY no ambiente do MCP.");
  process.exit(1);
}

async function api(path, method = "GET", body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "x-api-key": KEY, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(`Fluxo ${res.status}: ${data.error || text}`);
  return data;
}

const TOOLS = [
  {
    name: "fluxo_list_hierarchy",
    description: "Lista a estrutura completa: workspaces, spaces, folders e listas (com IDs).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "fluxo_list_tasks",
    description: "Lista as tarefas de uma lista, com status, responsáveis e tags.",
    inputSchema: {
      type: "object",
      properties: { listId: { type: "string", description: "ID da lista" } },
      required: ["listId"],
    },
  },
  {
    name: "fluxo_search_tasks",
    description: "Busca tarefas pelo nome em todas as listas.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number", description: "máx. de resultados (padrão 50)" },
      },
      required: ["query"],
    },
  },
  {
    name: "fluxo_get_task",
    description: "Detalhe completo de uma tarefa (status, responsáveis, tags, subtarefas, comentários, anexos).",
    inputSchema: {
      type: "object",
      properties: { taskId: { type: "string" } },
      required: ["taskId"],
    },
  },
  {
    name: "fluxo_create_task",
    description: "Cria uma tarefa em uma lista. statusId opcional (usa o primeiro status se omitido).",
    inputSchema: {
      type: "object",
      properties: {
        listId: { type: "string" },
        name: { type: "string" },
        statusId: { type: "string" },
        priority: { type: "string", enum: ["urgent", "high", "normal", "low"] },
        dueDate: { type: "string", description: "ISO date, ex: 2026-07-01" },
        assigneeIds: { type: "array", items: { type: "string" } },
        parentId: { type: "string", description: "ID da tarefa pai (para subtarefa)" },
      },
      required: ["listId", "name"],
    },
  },
  {
    name: "fluxo_update_task",
    description: "Atualiza campos de uma tarefa: nome, status, prioridade, prazo, responsáveis ou tags.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        name: { type: "string" },
        statusId: { type: "string" },
        priority: { type: "string" },
        dueDate: { type: "string" },
        assigneeIds: { type: "array", items: { type: "string" } },
        tagIds: { type: "array", items: { type: "string" } },
      },
      required: ["taskId"],
    },
  },
  {
    name: "fluxo_move_task",
    description: "Move uma tarefa para outro status (coluna do Kanban).",
    inputSchema: {
      type: "object",
      properties: { taskId: { type: "string" }, statusId: { type: "string" } },
      required: ["taskId", "statusId"],
    },
  },
  {
    name: "fluxo_add_comment",
    description: "Adiciona um comentário a uma tarefa.",
    inputSchema: {
      type: "object",
      properties: { taskId: { type: "string" }, text: { type: "string" } },
      required: ["taskId", "text"],
    },
  },
  {
    name: "fluxo_list_members",
    description: "Lista os usuários/membros (com IDs) para usar como responsáveis.",
    inputSchema: { type: "object", properties: {} },
  },
];

const server = new Server({ name: "fluxo", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a = {} } = req.params;
  try {
    let result;
    switch (name) {
      case "fluxo_list_hierarchy":
        result = await api("/api/hierarchy");
        break;
      case "fluxo_list_tasks":
        result = await api(`/api/lists/${a.listId}`);
        break;
      case "fluxo_search_tasks":
        result = await api(`/api/search?q=${encodeURIComponent(a.query)}&limit=${a.limit || 50}`);
        break;
      case "fluxo_get_task":
        result = await api(`/api/tasks/${a.taskId}`);
        break;
      case "fluxo_create_task":
        result = await api("/api/tasks", "POST", a);
        break;
      case "fluxo_update_task":
      case "fluxo_move_task": {
        const { taskId, ...body } = a;
        result = await api(`/api/tasks/${taskId}`, "PATCH", body);
        break;
      }
      case "fluxo_add_comment":
        result = await api("/api/comments", "POST", a);
        break;
      case "fluxo_list_members":
        result = await api("/api/members");
        break;
      default:
        throw new Error(`Ferramenta desconhecida: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    return { content: [{ type: "text", text: `Erro: ${e.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Fluxo MCP server rodando (stdio).");
