import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwnerId } from "@/lib/mercury/owner";
import { getRole, listApplicants, getEmployer } from "@/lib/mercury/data";
import { forwardingAddress } from "@/lib/mercury/ingest";
import { Board } from "@/components/mercury/Board";
import { CopyField } from "@/components/mercury/CopyField";

export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: { params: Promise<{ roleId: string }> }) {
  const ownerId = await requireOwnerId();
  const { roleId } = await params;

  const role = await getRole(ownerId, roleId);
  if (!role) notFound();

  const [applicants, employer] = await Promise.all([
    listApplicants(ownerId, roleId),
    getEmployer(ownerId),
  ]);

  return (
    <>
      <div className="mx-auto max-w-[1600px] px-5 pt-4">
        <Link href="/mercury" className="text-xs text-muted hover:text-text">
          ← All roles
        </Link>
      </div>

      {applicants.length === 0 && (
        <div className="mx-auto max-w-[1600px] px-5 pt-4">
          <div className="panel flex flex-col gap-3 p-5">
            <h2 className="text-sm font-semibold text-text">No applicants yet</h2>
            <p className="text-xs text-muted">
              Forward applicant emails to this role&apos;s private address and they&apos;ll appear on
              the board as uniform cards — the original CV and email always attached.
            </p>
            <div className="max-w-md">
              <CopyField value={forwardingAddress(role.ingest_token)} label="forwarding address" />
            </div>
          </div>
        </div>
      )}

      <Board role={role} companyName={employer?.company_name ?? null} initialApplicants={applicants} />
    </>
  );
}
