import { redirect } from "next/navigation";
import { getOwnerId } from "@/lib/mercury/owner";
import { getEmployer } from "@/lib/mercury/data";
import { AppHeader } from "@/components/mercury/AppHeader";

export default async function MercuryLayout({ children }: { children: React.ReactNode }) {
  const ownerId = await getOwnerId();
  if (!ownerId) redirect("/sign-in");

  // The employer record is created by the Better Auth signup hook; read it for
  // the header. (If a session predates the record, the header just omits the name.)
  const employer = await getEmployer(ownerId);

  return (
    <div className="min-h-screen bg-bg-deep">
      <AppHeader companyName={employer?.company_name ?? null} />
      {children}
    </div>
  );
}
