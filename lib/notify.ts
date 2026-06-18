import { prisma } from "./prisma";

// Create notifications for a set of users (deduped, optionally excluding the actor).
export async function createNotifications(
  userIds: string[],
  type: string,
  text: string,
  link?: string | null,
  excludeUserId?: string
) {
  const ids = [...new Set(userIds)].filter((id) => id && id !== excludeUserId);
  if (!ids.length) return;
  await prisma.notification.createMany({
    data: ids.map((userId) => ({ userId, type, text, link: link || null })),
  });
}

// Find users mentioned via @name in a text, limited to a company scope (null = all).
export async function mentionedUserIds(text: string, scopeCompanyId: string | null): Promise<string[]> {
  const tokens = Array.from(text.matchAll(/@([\p{L}][\p{L}\d_.-]{1,30})/gu)).map((m) => m[1].toLowerCase());
  if (!tokens.length) return [];
  const where: any = { status: "active" };
  if (scopeCompanyId) where.companyId = scopeCompanyId;
  const users = await prisma.user.findMany({ where, select: { id: true, name: true } });
  const matched = new Set<string>();
  for (const u of users) {
    const first = (u.name || "").split(" ")[0].toLowerCase();
    const full = (u.name || "").toLowerCase().replace(/\s+/g, "");
    if (tokens.some((t) => (first && first.startsWith(t)) || (full && full.startsWith(t)))) matched.add(u.id);
  }
  return [...matched];
}
