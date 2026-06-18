import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResponse } from "@/lib/api";
import { createNotifications } from "@/lib/notify";

// Usuário sem acesso solicita liberação; avisa todos os admins/owner.
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;

  const body = await req.json().catch(() => ({}));
  const msg = (body.message || "").toString().slice(0, 300);

  const admins = await prisma.user.findMany({
    where: { role: { in: ["owner", "admin"] }, status: "active" },
    select: { id: true },
  });
  const adminIds = admins.map((a: { id: string }) => a.id);

  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, email: true } });
  const who = me ? `${me.name} (${me.email})` : "Um usuário";
  await createNotifications(
    adminIds,
    "access",
    `${who} solicitou acesso${msg ? `: "${msg}"` : ""}`,
    "/admin",
    user.id
  );

  return NextResponse.json({ ok: true });
}
