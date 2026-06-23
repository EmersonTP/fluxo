import { prisma } from "./prisma";

// Trilha de auditoria de acesso/alteração de dados sensíveis (LGPD).
// NUNCA deve quebrar a requisição — qualquer erro é engolido.

type AuditUser = { id?: string | null; name?: string | null } | null | undefined;

export function clientIp(req: Request): string | null {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") || null;
}

export async function logAudit(opts: {
  req?: Request;
  user?: AuditUser;
  action: string;   // view | create | update | delete | export | pay
  entity: string;   // extrato | solicitacao | recebivel | cobranca | cliente | config
  entityId?: string | null;
  companyId?: string | null;
  meta?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: opts.user?.id || null,
        userName: opts.user?.name || null,
        action: opts.action,
        entity: opts.entity,
        entityId: opts.entityId || null,
        companyId: opts.companyId || null,
        ip: opts.req ? clientIp(opts.req) : null,
        meta: opts.meta ? String(opts.meta).slice(0, 500) : null,
      },
    });
  } catch {
    /* auditoria nunca derruba a operação */
  }
}

// Leitura da trilha (admin). Mais recentes primeiro.
export async function recentAudit(companyId: string | null, limit = 200) {
  return prisma.auditLog.findMany({
    where: companyId ? { companyId } : {},
    orderBy: { at: "desc" },
    take: Math.min(limit, 500),
  });
}
