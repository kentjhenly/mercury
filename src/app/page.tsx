import { redirect } from "next/navigation";
import { getOwnerId } from "@/lib/mercury/owner";

// The marketing landing is the self-contained "Mercury Landing" Design Component
// served verbatim from /public/landing. Signed-in employers skip it and go
// straight to their workspace.
export default async function Home() {
  if (await getOwnerId()) redirect("/mercury");
  redirect("/landing/index.html");
}
