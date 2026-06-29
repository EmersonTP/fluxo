import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse, canAccessList } from "@/lib/api";

export const runtime = "nodejs";

function hoje() { return new Date().toISOString().slice(0, 10); }
function parseMeta(txt: string): number | null {
  const m = /meta:?\s*(\d+)/i.exec(txt || "");
  return m ? Number(m[1]) : null;
}
// normaliza campo estruturado: {tipo,valor,opcoes} ou string legada
function normCf(v: any): { tipo: string; valor: string } {
  if (v && typeof v === "object") return { tipo: v.tipo || "texto", valor: v.valor ?? "" };
  return { tipo: "texto", valor: v == null ? "" : String(v) };
}

// Métricas da Rotina: lê os campos estruturados das subtarefas de uma lista (a rotina),
// tira um snapshot do dia (on-read) e agrega os últimos 7 dias. "feito × meta".
export async function GET(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const listId = new URL(req.url).searchParams.get("list") || "";
  if (!listId || !(await canAccessList(user, listId))) return NextResponse.json({ hoje: [], semana: [] });

  const tasks: any[] = await prisma.task.findMany({
    where: { listId, customFields: { not: null as any } },
    select: { id: true, name: true, description: true, customFields: true },
  });

  const dia = hoje();
  const hojeMetrics: any[] = [];
  for (const t of tasks) {
    const cf = (t.customFields || {}) as Record<string, any>;
    const meta = parseMeta(`${t.name} ${t.description || ""}`);
    for (const [label, raw] of Object.entries(cf)) {
      const n = normCf(raw);
      if (n.valor === "" || n.valor == null) continue;
      hojeMetrics.push({ itemId: t.id, itemNome: t.name, label, tipo: n.tipo, valor: n.valor, meta: n.tipo === "numero" ? meta : null });
      // snapshot do dia (idempotente por item+label+dia)
      try {
        await prisma.rotinaMetricaLog.upsert({
          where: { itemId_label_data: { itemId: t.id, label, data: dia } },
          update: { valor: String(n.valor), tipo: n.tipo, itemNome: t.name },
          create: { listId, itemId: t.id, itemNome: t.name, label, tipo: n.tipo, valor: String(n.valor), data: dia },
        });
      } catch { /* best-effort */ }
    }
  }

  // semana = últimos 7 dias do log
  const seteDiasAtras = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  const logs: any[] = await prisma.rotinaMetricaLog.findMany({
    where: { listId, data: { gte: seteDiasAtras } },
    orderBy: { data: "asc" },
  });
  const agg: Record<string, any> = {};
  for (const l of logs) {
    const a = (agg[l.label] = agg[l.label] || { label: l.label, tipo: l.tipo, total: 0, dias: 0, serie: [] as any[] });
    if (l.tipo === "numero") { a.total += Number(l.valor || 0); }
    a.dias++;
    a.serie.push({ data: l.data, valor: l.valor });
  }
  const semana = Object.values(agg).sort((a: any, b: any) => b.total - a.total);

  return NextResponse.json({ hoje: hojeMetrics, semana, data: dia });
}
