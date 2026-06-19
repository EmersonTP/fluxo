import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import WorkspacePanel from "@/components/WorkspacePanel";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <WorkspacePanel id={params.id} />;
}
