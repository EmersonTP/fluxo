import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import SettingsPanel from "@/components/SettingsPanel";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = { owner: "Admin master", admin: "Admin", member: "Membro" };

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <SettingsPanel name={user.name} email={user.email} role={ROLE_LABEL[user.role] || user.role} />;
}
