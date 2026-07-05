import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwnerId } from "@/lib/mercury/owner";
import { getRole, listApplicants, getEmployer } from "@/lib/mercury/data";
import { forwardingAddress } from "@/lib/mercury/ingest";
import { estimateSalary, formatSalaryBand, formatSalaryFull } from "@/lib/mercury/salary";
import { getMetro } from "@/lib/mercury/metro";
import { Board } from "@/components/mercury/Board";
import { CopyField } from "@/components/mercury/CopyField";
import { SalaryFeedback } from "@/components/mercury/SalaryFeedback";

export const dynamic = "force-dynamic";

// Whole days between an ISO timestamp and now. Kept out of the component body so
// the render stays pure (no Date.now() call in render).
function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default async function BoardPage({ params }: { params: Promise<{ roleId: string }> }) {
  const ownerId = await requireOwnerId();
  const { roleId } = await params;

  // All three reads are independent — resolve them in one round-trip window
  // rather than fetching the role first and then everything else. listApplicants
  // is owner+role scoped, so a bad roleId just yields [] on the rare notFound.
  const [role, applicants, employer] = await Promise.all([
    getRole(ownerId, roleId),
    listApplicants(ownerId, roleId),
    getEmployer(ownerId),
  ]);
  if (!role) notFound();

  const owedCount = applicants.filter((a) => a.response_owed).length;
  const ingestEmail = forwardingAddress(role.ingest_token);

  // A3 retention read: how long after signup this active session is. Emitted
  // with the return_session event so the funnel can gate on ">= 7 days".
  const daysSinceSignup = employer ? daysSince(employer.created_at) : null;

  // What this role pays in-market — context from bundled data + local math.
  // Information for the human, never a score; honest "unavailable" over a guess.
  const metro = getMetro(role.metro_id);
  const marketBand = estimateSalary(metro, role);

  return (
    <>
      {/* Role header */}
      <div className="border-b border-border-soft bg-bg-deep/95">
        <div className="mx-auto max-w-[1600px] px-5 pb-6 pt-5">
          <Link
            href="/mercury"
            className="font-mono hover:text-muted"
            style={{ fontSize: "11px", letterSpacing: ".16em", color: "#565c66" }}
          >
            ← ALL ROLES
          </Link>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <h1
                className="font-semibold text-text"
                style={{ fontSize: "clamp(24px,3vw,34px)", letterSpacing: "-.02em" }}
              >
                {role.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
                {role.location && <span>{role.location}</span>}
                {role.location && <span className="text-dim">·</span>}
                <CopyField value={ingestEmail} label="forwarding address" variant="chip" />
              </div>

              {/* HK market band for this role — labelled estimate, with its basis on hover */}
              <div
                className="tnum mt-3 flex flex-wrap items-baseline gap-x-2.5 font-mono"
                style={{ fontSize: "11px" }}
              >
                <span style={{ letterSpacing: ".14em", color: "var(--dim)" }}>
                  {metro.marketLabel.toUpperCase()}
                </span>
                {marketBand ? (
                  <span title={marketBand.basis} className="cursor-help">
                    <span style={{ color: "var(--text-2, #d7dbe1)" }}>
                      {formatSalaryBand(metro, marketBand)}
                    </span>
                    <span className="text-muted">
                      {" "}· median {formatSalaryFull(metro, marketBand.p50)} ·{" "}
                      {marketBand.confidence === "medium" ? "rough estimate" : "estimate"}
                    </span>
                  </span>
                ) : (
                  <span className="text-dim">market estimate unavailable</span>
                )}
              </div>

              {/* Correction loop — "does this look right?" on the role's band */}
              {marketBand && (
                <SalaryFeedback
                  roleId={role.id}
                  family={marketBand.family}
                  yearsUsed={marketBand.years}
                  metro={metro}
                />
              )}
            </div>

            {/* Stats block */}
            <div className="flex gap-px overflow-hidden rounded-lg border border-border bg-border">
              <StatCell value={applicants.length} label="Total" />
              <StatCell value={owedCount} label="Owed" tone={owedCount > 0 ? "waiting" : undefined} />
            </div>
          </div>
        </div>
      </div>

      <Board
        role={role}
        companyName={employer?.company_name ?? null}
        initialApplicants={applicants}
        daysSinceSignup={daysSinceSignup}
      />
    </>
  );
}

function StatCell({ value, label, tone }: { value: number; label: string; tone?: "waiting" }) {
  return (
    <div className="text-center" style={{ background: "var(--metal)", padding: "11px 18px" }}>
      <div
        className="tnum font-medium leading-none"
        style={{ fontSize: "22px", color: tone === "waiting" ? "var(--waiting)" : "var(--text)" }}
      >
        {value}
      </div>
      <div className="label mt-1.5" style={{ fontSize: "9px", letterSpacing: "0.18em" }}>
        {label}
      </div>
    </div>
  );
}

