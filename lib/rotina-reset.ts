import { prisma } from "@/lib/prisma";

// Fuso BRT (UTC-3, sem horário de verão).
function brtNow(): Date { return new Date(Date.now() - 3 * 3600e3); }
function ymd(d: Date): string { return d.toISOString().slice(0, 10); }

// Ciclo diário: reseta às 5h BRT. Antes das 5h ainda conta como o dia anterior.
function cicloDiaria(b: Date): string {
  const d = new Date(b);
  if (d.getUTCHours() < 5) d.setUTCDate(d.getUTCDate() - 1);
  return ymd(d);
}
// Ciclo semanal: vira domingo 20h BRT. Id = data do domingo de início.
function cicloSemanal(b: Date): string {
  const d = new Date(b);
  const dow = d.getUTCDay(); // 0 = domingo
  // boundary mais recente: domingo 20h
  // recua até o último domingo
  const dom = new Date(d); dom.setUTCDate(d.getUTCDate() - dow); dom.setUTCHours(20, 0, 0, 0);
  if (d < dom) dom.setUTCDate(dom.getUTCDate() - 7); // ainda não passou das 20h do domingo
  return ymd(dom);
}

function normVal(v: any): { tipo: string; valor: string } {
  if (v && typeof v === "object") return { tipo: v.tipo || "texto", valor: v.valor ?? "" };
  return { tipo: "texto", valor: v == null ? "" : String(v) };
}

// Reseta a rotina de uma lista: snapshota as métricas do ciclo que fechou, desmarca os itens
// [DIÁRIA]/[SEMANAL] e zera os campos. Idempotente — só age quando o ciclo virou.
export async function resetRotina(listId: string): Promise<void> {
  const items: any[] = await prisma.task.findMany({
    where: { listId, parentId: { not: null } },
    select: { id: true, name: true, customFields: true, description: true },
  });
  const temRotina = items.some((i) => /^\[(DIÁRIA|SEMANAL)/i.test(i.name || ""));
  if (!temRotina) return;

  const b = brtNow();
  const curD = cicloDiaria(b);
  const curS = cicloSemanal(b);

  const ciclo = await prisma.rotinaCiclo.findUnique({ where: { listId } });
  if (!ciclo) { await prisma.rotinaCiclo.create({ data: { listId, lastDiaria: curD, lastSemanal: curS } }); return; }

  const list: any = await prisma.list.findUnique({ where: { id: listId }, include: { statuses: { orderBy: { order: "asc" }, take: 1 } } });
  const firstStatus = list?.statuses?.[0]?.id || null;

  async function doReset(prefixRe: RegExp, closingDate: string) {
    for (const it of items) {
      if (!prefixRe.test(it.name || "")) continue;
      const cf = (it.customFields || {}) as Record<string, any>;
      const cleared: Record<string, any> = {};
      for (const [label, raw] of Object.entries(cf)) {
        const n = normVal(raw);
        if (n.valor !== "" && n.valor != null) {
          try {
            await prisma.rotinaMetricaLog.upsert({
              where: { itemId_label_data: { itemId: it.id, label, data: closingDate } },
              update: { valor: String(n.valor), tipo: n.tipo, itemNome: it.name },
              create: { listId, itemId: it.id, itemNome: it.name, label, tipo: n.tipo, valor: String(n.valor), data: closingDate },
            });
          } catch { /* best-effort */ }
        }
        cleared[label] = typeof raw === "object" && raw ? { ...raw, valor: "" } : "";
      }
      await prisma.task.update({ where: { id: it.id }, data: { customFields: cleared, statusId: firstStatus, dateClosed: null } });
    }
  }

  const upd: any = {};
  if (ciclo.lastDiaria !== curD) { await doReset(/^\[DIÁRIA/i, ciclo.lastDiaria || curD); upd.lastDiaria = curD; }
  if (ciclo.lastSemanal !== curS) { await doReset(/^\[SEMANAL/i, ciclo.lastSemanal || curS); upd.lastSemanal = curS; }
  if (Object.keys(upd).length) await prisma.rotinaCiclo.update({ where: { listId }, data: upd });
}
