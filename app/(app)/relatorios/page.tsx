import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import ReportsPanel from "@/components/ReportsPanel";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <ReportsPanel />;
}
