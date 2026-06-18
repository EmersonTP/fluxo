import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { companyScope } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const scope = companyScope(user);
  // Company-scoped users with no company assigned see nothing.
  if (scope === null && user.role === "member") return NextResponse.json({ workspaces: [] });

  const workspaces = await prisma.workspace.findMany({
    where: scope ? { companyId: scope } : undefined,
    orderBy: { name: "asc" },
    include: {
      spaces: {
        orderBy: { order: "asc" },
        include: {
          members: { select: { id: true } },
          lists: {
            where: { folderId: null },
            orderBy: { order: "asc" },
            include: { _count: { select: { tasks: true } }, members: { select: { id: true } } },
          },
          folders: {
            orderBy: { order: "asc" },
            include: {
              lists: {
                orderBy: { order: "asc" },
                include: { _count: { select: { tasks: true } }, members: { select: { id: true } } },
              },
            },
          },
        },
      },
    },
  });

  // Membros: filtra espaços/listas privados aos quais não têm acesso
  const isMember = user.role !== "owner" && user.role !== "admin";
  if (isMember) {
    const uid = user.id;
    const canList = (l: any) => !l.private || l.members.some((m: any) => m.id === uid);
    for (const ws of workspaces as any[]) {
      ws.spaces = ws.spaces.filter((sp: any) => !sp.private || sp.members.some((m: any) => m.id === uid));
      for (const sp of ws.spaces) {
        sp.lists = sp.lists.filter(canList);
        for (const f of sp.folders) f.lists = f.lists.filter(canList);
        sp.folders = sp.folders.filter((f: any) => f.lists.length > 0);
      }
    }
  }

  return NextResponse.json({ workspaces });
}
