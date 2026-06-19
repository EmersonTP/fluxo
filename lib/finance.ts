import { prisma } from "./prisma";
import { createNotifications } from "./notify";
import { sendEmail, emailLayout, emailEnabled } from "./email";

type U = { id: string; role: string; companyId: string | null };

export function isAdmin(u: U) {
  return u.role === "owner" || u.role === "admin";
}

// Empresa que o usuário pode operar no financeiro.
export function canAccessCompany(u: U, companyId: string) {
  if (isAdmin(u)) return true;
  return u.companyId === companyId;
}

// Empresas que o usuário pode escolher no seletor do módulo.
export async function financeCompanies(u: U) {
  if (isAdmin(u)) return prisma.company.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, modules: true } });
  if (!u.companyId) return [];
  return prisma.company.findMany({ where: { id: u.companyId }, select: { id: true, name: true, modules: true } });
}

export const STATUS_LABEL: Record<string, string> = {
  solicitada: "Solicitada",
  aprovada_gestor: "Aprovada pelo gestor",
  conferida: "Conferida (financeiro)",
  paga: "Paga",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

// Resolve os aprovadores configurados de uma empresa.
export async function approversOf(companyId: string) {
  const cfg = await prisma.approverConfig.findMany({ where: { companyId } });
  const gestoresPorArea: Record<string, string[]> = {};
  const financeiros: string[] = [];
  const pagadores: string[] = [];
  for (const c of cfg as { role: string; spaceId: string | null; userId: string }[]) {
    if (c.role === "gestor" && c.spaceId) (gestoresPorArea[c.spaceId] ||= []).push(c.userId);
    else if (c.role === "financeiro") financeiros.push(c.userId);
    else if (c.role === "pagador") pagadores.push(c.userId);
  }
  return { gestoresPorArea, financeiros, pagadores };
}

// Pode o usuário executar a ação na etapa atual?
export async function canActOn(u: U, req: { companyId: string; spaceId: string | null }, action: string) {
  if (isAdmin(u)) return true;
  if (!canAccessCompany(u, req.companyId)) return false;
  const a = await approversOf(req.companyId);
  if (action === "aprovar_gestor") return !!(req.spaceId && a.gestoresPorArea[req.spaceId]?.includes(u.id));
  if (action === "conferir") return a.financeiros.includes(u.id);
  if (action === "pagar") return a.pagadores.includes(u.id);
  return false;
}

// Nomes de usuários por id (para exibir solicitante/gestor/etc.).
export async function userNames(ids: (string | null | undefined)[]) {
  const real = [...new Set(ids.filter(Boolean) as string[])];
  if (!real.length) return {} as Record<string, { id: string; name: string; color: string }>;
  const users = await prisma.user.findMany({ where: { id: { in: real } }, select: { id: true, name: true, color: true } });
  return Object.fromEntries(users.map((x: { id: string; name: string; color: string }) => [x.id, x]));
}

// Notifica (sino + e-mail) um conjunto de usuários sobre a solicitação.
export async function notifyFinance(userIds: string[], text: string, actorId?: string) {
  await createNotifications(userIds, "finance", text, "/financeiro", actorId);
  if (!emailEnabled()) return;
  const ids = [...new Set(userIds)].filter((id) => id && id !== actorId);
  if (!ids.length) return;
  const base = process.env.APP_URL || "https://fluxo-production-8ef7.up.railway.app";
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { email: true } });
  for (const u of users as { email: string }[]) {
    await sendEmail(
      u.email,
      "Sandra — Solicitação de pagamento",
      emailLayout("Solicitação de pagamento", `<p>${text}</p>`, { label: "Abrir Financeiro", url: `${base}/financeiro` })
    ).catch(() => {});
  }
}

// Registra uma etapa na trilha de auditoria.
export async function logStep(requestId: string, action: string, fromStatus: string | null, toStatus: string | null, user: { id: string; name?: string } | null, note?: string | null) {
  await prisma.requestStep.create({
    data: { requestId, action, fromStatus, toStatus, note: note || null, userId: user?.id || null, userName: user?.name || null },
  });
}
