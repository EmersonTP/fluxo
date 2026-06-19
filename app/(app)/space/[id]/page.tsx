import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import SpacePanel from "@/components/SpacePanel";

export const dynamic = "force-dynamic";

export default async function SpacePage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <SpacePanel id={params.id} />;
}
