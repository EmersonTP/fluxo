import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SettingsPanel from "@/components/SettingsPanel";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = { owner: "Admin master", admin: "Admin", member: "Membro" };

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { color: true } });
  return (
    <SettingsPanel
      name={user.name}
      email={user.email}
      role={ROLE_LABEL[user.role] || user.role}
      isAdmin={user.role === "owner" || user.role === "admin"}
      color={dbUser?.color || "#9250ac"}
    />
  );
}
