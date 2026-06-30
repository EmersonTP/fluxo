import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { accessibleCompanyIds } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Report fim do dia — 100% automatico da atividade na Sandra.
// Puxa, por pessoa e por dia: tarefas concluidas, tarefas trabalhadas (status/movida/etc) e comentarios.
// Escopado a empresa ativa (cookie fx_company), como o resto do app.

const ACAO: Record<string, string> = {
  created: "criou",
  renamed: "renomeou",
  status: "mudou status",
  priority: "mudou prioridade",
  assignees: "responsaveis",
  due: "ajustou prazo",
  moved: "moveu",
  comment: "comentou",
};

export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const u = new URL(req.url);
  const dateStr = u.searchParams.get("date") || new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const alvoId = u.searchParams.get("userId") || user.id;

  // Janela do dia em horario de Brasilia (UTC-3).
  const start = new Date(`${dateStr}T00:00:00-03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  // Escopo de empresa (igual ao Inicio): owner/admin ve todas; restringe a empresa ativa.
  const ids = accessibleCompanyIds(user);
  const active = cookies().get("fx_company")?.value || "";
  const allowActive = active && (ids === null || ids.includes(active));
  const ids2 = allowActive ? [active] : ids;
  const effIds = ids2 === null ? null : ids2.length ? ids2 : ["__none__"];
  const listWhere =
    effIds === null
      ? undefined
      : {
          OR: [
            { space: { workspace: { companyId: { in: effIds } } } },
            { folder: { space: { workspace: { companyId: { in: effIds } } } } },
          ],
        };
  const taskScope: any = listWhere ? { list: listWhere } : {};

  const alvo = await prisma.user.findUnique({ where: { id: alvoId }, select: { id: true, name: true } });

  const [concluidas, atividades, comentarios] = await Promise.all([
    prisma.task.findMany({
      where: { dateClosed: { gte: start, lt: end }, assignees: { some: { id: alvoId } }, ...taskScope },
      select: { id: true, name: true, list: { select: { name: true } } },
      orderBy: { dateClosed: "desc" },
    }),
    prisma.activity.findMany({
      where: { userId: alvoId, createdAt: { gte: start, lt: end }, task: taskScope },
      select: { type: true, taskId: true, task: { select: { name: true, list: { select: { name: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.comment.findMany({
      where: { userId: alvoId, createdAt: { gte: start, lt: end }, task: taskScope },
      select: { taskId: true, task: { select: { name: true, list: { select: { name: true } } } } },
    }),
  ]);

  const concluidasIds = new Set(concluidas.map((t) => t.id));

  const porTarefa = new Map<string, { nome: string; lista: string; acoes: Set<string> }>();
  const add = (taskId: string, nome: string, lista: string, acao: string) => {
    if (concluidasIds.has(taskId)) return;
    const e = porTarefa.get(taskId) || { nome, lista, acoes: new Set<string>() };
    e.acoes.add(acao);
    porTarefa.set(taskId, e);
  };
  for (const a of atividades) {
    if (!a.task) continue;
    add(a.taskId, a.task.name, a.task.list?.name || "", ACAO[a.type] || a.type);
  }
  for (const c of comentarios) {
    if (!c.task) continue;
    add(c.taskId, c.task.name, c.task.list?.name || "", "comentou");
  }

  const trabalhadas = Array.from(porTarefa.values()).map((e) => ({
    nome: e.nome,
    lista: e.lista,
    acoes: Array.from(e.acoes),
  }));

  const [y, m, d] = dateStr.split("-");
  const linhas: string[] = [];
  linhas.push(`Report fim do dia — ${d}/${m}/${y}`);
  linhas.push(alvo?.name || "");
  linhas.push("");
  if (concluidas.length) {
    linhas.push(`Conclui (${concluidas.length}):`);
    for (const t of concluidas) linhas.push(`- ${t.name}${t.list?.name ? ` (${t.list.name})` : ""}`);
    linhas.push("");
  }
  if (trabalhadas.length) {
    linhas.push(`Trabalhei em (${trabalhadas.length}):`);
    for (const t of trabalhadas) linhas.push(`- ${t.nome}${t.lista ? ` (${t.lista})` : ""}`);
    linhas.push("");
  }
  if (!concluidas.length && !trabalhadas.length) {
    linhas.push("Sem atividade registrada na Sandra hoje.");
  }
  const texto = linhas.join("\n").trim();

  return NextResponse.json({ pessoa: alvo || { id: alvoId, name: "" }, date: dateStr, concluidas, trabalhadas, texto });
}
