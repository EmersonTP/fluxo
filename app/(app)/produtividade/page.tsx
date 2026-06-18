import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import ProductivityPanel from "@/components/ProductivityPanel";

export const dynamic = "force-dynamic";

export default async function ProductivityPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "owner" && user.role !== "admin") redirect("/");
  return <ProductivityPanel />;
}
