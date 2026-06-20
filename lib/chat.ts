import { prisma } from "./prisma";
import { accessibleCompanyIds } from "./auth";

type U = { id: string; role: string; companyId: string | null };

// Acesso a um canal/DM: owner/admin tudo; demais → canais da empresa/globais, ou DMs onde é membro.
export async function canAccessChannel(user: U, channelId: string): Promise<boolean> {
  const ch = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { companyId: true, kind: true, members: { select: { id: true } } },
  });
  if (!ch) return false;
  if (ch.kind === "dm") return ch.members.some((m: { id: string }) => m.id === user.id);
  const ids = accessibleCompanyIds(user);
  if (ids === null) return true; // owner/admin
  return ch.companyId === null || (!!ch.companyId && ids.includes(ch.companyId));
}

export const MSG_INCLUDE = {
  user: { select: { id: true, name: true, color: true } },
  reactions: { select: { id: true, emoji: true, userId: true } },
  attachments: { select: { id: true, filename: true, mime: true, size: true } },
  _count: { select: { replies: true } },
} as const;
