import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { homeForRole } from "@/lib/constants";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(homeForRole(session.role));
}
