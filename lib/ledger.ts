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

export type CatRef = { grupo: string; nome: string; bloco: string; tipo: string } | null;
export type LancBanco = { id: string; data: string; tipo: string; valor: number; descricao: string; conta: string; override: CatRef };

// Lê TODOS os lançamentos das contas bancárias (Inter sincronizado + cartão + sócio + C6…) no período.
// `override` = categoria fixada manualmente no lançamento (tem prioridade sobre as regras).
export async function getLancamentos(companyId: string, de: string, ate: string, opts: { apenasCaixa?: boolean } = {}): Promise<LancBanco[]> {
  const ini = new Date(de + "T00:00:00"); const fim = new Date(ate + "T23:59:59");
  const txs: any[] = await prisma.bankTransaction.findMany({
    where: { companyId, data: { gte: ini, lte: fim }, ...(opts.apenasCaixa ? { account: { tipo: { notIn: ["cartao", "socio"] } } } : {}) },
    include: { account: { select: { nome: true } }, categoria: { select: { grupo: true, nome: true, bloco: true, tipo: true } } },
    orderBy: { data: "asc" },
  });
  return txs.map((t) => ({
    id: t.id,
    data: (t.data as Date).toISOString().slice(0, 10),
    tipo: t.tipo || (Number(t.valor) >= 0 ? "credito" : "debito"),
    valor: Math.abs(Number(t.valor || 0)),
    descricao: t.descricao || "",
    conta: t.account?.nome || "",
    override: t.categoria ? { grupo: t.categoria.grupo, nome: t.categoria.nome, bloco: t.categoria.bloco, tipo: t.categoria.tipo } : null,
  }));
}
