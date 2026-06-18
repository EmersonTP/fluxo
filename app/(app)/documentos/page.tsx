import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import DocsPanel from "@/components/DocsPanel";

export const dynamic = "force-dynamic";

export default async function DocsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <DocsPanel />;
}
