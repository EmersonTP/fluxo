import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import AdminPanel from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "owner" && user.role !== "admin") redirect("/");
  return <AdminPanel />;
}
