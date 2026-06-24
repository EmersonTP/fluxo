import { prisma } from "./prisma";

// Classificador a partir das regras da empresa (substring → categoria).
export async function getClassifier(companyId: string) {
  const regras: any[] = await prisma.categoriaRegra.findMany({
    where: { companyId }, orderBy: { prioridade: "desc" },
    include: { categoria: { select: { grupo: true, nome: true, bloco: true, tipo: true } } },
  });
  return (tipo: string, txt: string) => {
    const up = (txt || "").toUpperCase();
    for (const r of regras) { if (r.aplicaA !== "ambos" && r.aplicaA !== tipo) continue; if (up.includes(r.padrao)) return r.categoria; }
    return null;
  };
}

export type LancBanco = { data: string; tipo: string; valor: number; descricao: string; conta: string };

// Lê TODOS os lançamentos das contas bancárias (Inter sincronizado + cartão + C6…) no período.
export async function getLancamentos(companyId: string, de: string, ate: string, opts: { apenasCaixa?: boolean } = {}): Promise<LancBanco[]> {
  const ini = new Date(de + "T00:00:00"); const fim = new Date(ate + "T23:59:59");
  const txs: any[] = await prisma.bankTransaction.findMany({
    where: { companyId, data: { gte: ini, lte: fim }, ...(opts.apenasCaixa ? { account: { tipo: { not: "cartao" } } } : {}) },
    include: { account: { select: { nome: true } } },
    orderBy: { data: "asc" },
  });
  return txs.map((t) => ({
    data: (t.data as Date).toISOString().slice(0, 10),
    tipo: t.tipo || (Number(t.valor) >= 0 ? "credito" : "debito"),
    valor: Math.abs(Number(t.valor || 0)),
    descricao: t.descricao || "",
    conta: t.account?.nome || "",
  }));
}
