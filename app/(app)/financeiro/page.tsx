import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import FinancePanel from "@/components/FinancePanel";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const isAdmin = user.role === "owner" || user.role === "admin";
  return <FinancePanel meId={user.id} isAdmin={isAdmin} />;
}
