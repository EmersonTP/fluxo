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
          lists: {
            where: { folderId: null },
            orderBy: { order: "asc" },
            include: { _count: { select: { tasks: true } } },
          },
          folders: {
            orderBy: { order: "asc" },
            include: {
              lists: {
                orderBy: { order: "asc" },
                include: { _count: { select: { tasks: true } } },
              },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ workspaces });
}
