import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSessionUser, SessionUser } from "./auth";
import { prisma } from "./prisma";

// Authenticates either via login cookie OR an API key (x-api-key header).
// The API key maps to the first/owner user so writes (comments, etc.) have a valid author.
// This is what the Fluxo MCP server uses to let Claude operate the tool.
export async function requireUser(): Promise<SessionUser | NextResponse> {
  const apiKey = headers().get("x-api-key");
  if (apiKey && process.env.FLUXO_API_KEY && apiKey === process.env.FLUXO_API_KEY) {
    const owner =
      (await prisma.user.findFirst({ where: { role: "owner" } })) ||
      (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }));
    if (owner)
      return { id: owner.id, name: owner.name, email: owner.email, role: owner.role, companyId: owner.companyId };
    return { id: "system", name: "MCP", email: "mcp@fluxo.app", role: "owner", companyId: null };
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  return user;
}

export function isResponse(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}

// Like requireUser, but also requires owner or admin role.
export async function requireAdmin(): Promise<SessionUser | NextResponse> {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role !== "owner" && user.role !== "admin") {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }
  return user;
}

// Returns the companyId that owns a given list (via its space or folder->space).
export async function companyIdForList(listId: string): Promise<string | null> {
  const list = await prisma.list.findUnique({
    where: { id: listId },
    include: {
      space: { select: { workspace: { select: { companyId: true } } } },
      folder: { select: { space: { select: { workspace: { select: { companyId: true } } } } } },
    },
  });
  return list?.space?.workspace.companyId || list?.folder?.space.workspace.companyId || null;
}

// True if a company-scoped user may access the given list, respecting privacy.
export async function canAccessList(
  user: { id?: string; role: string; companyId: string | null },
  listId: string
): Promise<boolean> {
  if (user.role === "owner" || user.role === "admin") return true;
  if (!user.companyId) return false;
  const l = await prisma.list.findUnique({
    where: { id: listId },
    select: {
      private: true,
      members: { select: { id: true } },
      space: { select: { private: true, members: { select: { id: true } }, workspace: { select: { companyId: true } } } },
      folder: { select: { space: { select: { private: true, members: { select: { id: true } }, workspace: { select: { companyId: true } } } } } },
    },
  });
  if (!l) return false;
  const space = l.space || l.folder?.space;
  if ((space?.workspace.companyId ?? null) !== user.companyId) return false;
  const uid = user.id;
  if (space?.private && !space.members.some((m: { id: string }) => m.id === uid)) return false;
  if (l.private && !l.members.some((m: { id: string }) => m.id === uid)) return false;
  return true;
}

// IDs of lists a member can see (privacy-aware). Returns null for owner/admin (= all).
export async function accessibleListIds(user: { id?: string; role: string; companyId: string | null }): Promise<string[] | null> {
  if (user.role === "owner" || user.role === "admin") return null;
  if (!user.companyId) return [];
  const lists = await prisma.list.findMany({
    where: {
      OR: [
        { space: { workspace: { companyId: user.companyId } } },
        { folder: { space: { workspace: { companyId: user.companyId } } } },
      ],
    },
    select: {
      id: true,
      private: true,
      members: { select: { id: true } },
      space: { select: { private: true, members: { select: { id: true } } } },
      folder: { select: { space: { select: { private: true, members: { select: { id: true } } } } } },
    },
  });
  const uid = user.id;
  return lists
    .filter((l: any) => {
      const space = l.space || l.folder?.space;
      if (space?.private && !space.members.some((m: { id: string }) => m.id === uid)) return false;
      if (l.private && !l.members.some((m: { id: string }) => m.id === uid)) return false;
      return true;
    })
    .map((l: any) => l.id);
}
