import { prisma } from "./prisma";
import categoriasData from "../prisma/data/categorias.json";

export type CatSeed = { grupo: string; nome: string; tipo: string; dre: string | null; ordem: number };
const DATA = categoriasData as Record<string, CatSeed[]>;

// Acha a lista do plano de contas pelo nome da empresa (tolerante a acento/caixa).
export function seedListFor(companyName: string): CatSeed[] | null {
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  const key = Object.keys(DATA).find((k) => norm(k) === norm(companyName));
  return key ? DATA[key] : null;
}

// Importa/atualiza as categorias de uma empresa a partir do JSON. Idempotente (companyId+grupo+nome).
export async function importCategorias(companyId: string, companyName: string) {
  const list = seedListFor(companyName);
  if (!list) return { ok: false, reason: "sem_plano", criadas: 0, total: 0 };
  let criadas = 0;
  for (const c of list) {
    const r = await prisma.categoria.upsert({
      where: { companyId_grupo_nome: { companyId, grupo: c.grupo, nome: c.nome } },
      create: { companyId, grupo: c.grupo, nome: c.nome, tipo: c.tipo, dre: c.dre, ordem: c.ordem, ativo: true },
      update: { tipo: c.tipo, dre: c.dre, ordem: c.ordem },
    });
    if (r) criadas++;
  }
  return { ok: true, criadas, total: list.length };
}

export function planosDisponiveis() {
  return Object.keys(DATA);
}
