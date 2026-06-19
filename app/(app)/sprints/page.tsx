import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import SprintsPanel from "@/components/SprintsPanel";

export const dynamic = "force-dynamic";

export default async function SprintsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <SprintsPanel />;
}
