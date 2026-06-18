import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import ChatPanel from "@/components/ChatPanel";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <ChatPanel meId={user.id} />;
}
