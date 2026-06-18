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

// True if a company-scoped user may access the given list.
export async function canAccessList(
  user: { role: string; companyId: string | null },
  listId: string
): Promise<boolean> {
  if (user.role === "owner" || user.role === "admin") return true;
  if (!user.companyId) return false;
  const companyId = await companyIdForList(listId);
  return companyId === user.companyId;
}
