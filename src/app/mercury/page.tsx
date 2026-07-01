import Link from "next/link";
import { requireOwnerId } from "@/lib/mercury/owner";
import { listRoles, type RoleWithCounts } from "@/lib/mercury/data";
import { forwardingAddress } from "@/lib/mercury/ingest";
import { STAGES, STAGE_COLOR } from "@/lib/mercury/stages";
import { CreateRoleForm } from "@/components/mercury/CreateRoleForm";
import { CopyField } from "@/components/mercury/CopyField";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const ownerId = await requireOwnerId();
  const roles = await listRoles(ownerId);

  // Global instrument totals across every role (factual sums, not a score).
  const gTotal = roles.reduce((n, r) => n + r.applicant_count, 0);
  const gOwed = roles.reduce((n, r) => n + r.owed_count, 0);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:py-10">
      {/* Status strip: headline + global metrics block */}
      <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="label mb-3 text-xs">Open roles</div>
          <h1 className="text-3xl font-semibold leading-none tracking-tight text-text sm:text-4xl">
            Hiring workspace
          </h1>
        </div>
        <MetricsBlock roles={roles.length} applicants={gTotal} owed={gOwed} />
      </div>

      {/* Role grid — every role is its own board. The dashed cell creates one. */}
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
        {roles.map((role) => (
          <RoleCard key={role.id} role={role} />
        ))}
        <CreateRoleForm variant="card" />
      </div>

      {roles.length === 0 && (
        <p className="mt-6 max-w-md text-xs text-muted">
          Create your first role to get a private forwarding address. Forward a few real applicant
          emails and watch them land on the board as uniform cards — the original CV and email always
          attached.
        </p>
      )}
    </main>
  );
}

function MetricsBlock({ roles, applicants, owed }: { roles: number; applicants: number; owed: number }) {
  return (
    <div className="flex gap-px overflow-hidden rounded-lg border border-border bg-border">
      <Metric label="Roles" value={roles} />
      <Metric label="Applicants" value={applicants} />
      <Metric label="Owed" value={owed} tone={owed > 0 ? "waiting" : undefined} />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "waiting" }) {
  return (
    <div className="px-5 py-3.5 text-center" style={{ background: "var(--metal)" }}>
      <div className={`tnum text-2xl font-medium leading-none ${tone === "waiting" ? "text-waiting" : "text-text"}`}>
        {value}
      </div>
      <div className="label mt-1.5 text-[10px]" style={{ letterSpacing: "0.18em" }}>
        {label}
      </div>
    </div>
  );
}

function RoleCard({ role }: { role: RoleWithCounts }) {
  return (
    <div className="panel rise flex flex-col">
      <Link href={`/mercury/roles/${role.id}`} className="group flex flex-1 flex-col p-[22px] pb-[18px]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold tracking-tight text-text group-hover:text-signal">
              {role.title}
            </div>
            {role.location && <div className="mt-1 truncate text-[13px] text-muted">{role.location}</div>}
          </div>
          <StatusTag status={role.status} />
        </div>

        {/* Stage bar — factual per-stage breakdown, never a ranking. */}
        <StageBar role={role} />

        <div className="mt-3.5 flex items-end justify-between">
          <div className="flex items-baseline gap-2">
            <span className="tnum text-[28px] font-medium leading-none text-text">{role.applicant_count}</span>
            <span className="text-xs text-dim">applicants</span>
          </div>
          {role.owed_count > 0 && (
            <span className="tnum inline-flex items-center gap-1.5 text-[11px] text-waiting">
              <span
                className="size-1.5 rounded-full bg-waiting"
                style={{ boxShadow: "0 0 7px var(--waiting)" }}
                aria-hidden
              />
              {role.owed_count} owed
            </span>
          )}
        </div>
      </Link>

      {/* Forwarding address — the working copy field, kept interactive below the link. */}
      <div className="border-t border-border-soft px-[22px] py-3.5">
        <div className="label mb-1.5 text-[10px]" style={{ letterSpacing: "0.16em" }}>
          Forwarding address
        </div>
        <CopyField value={forwardingAddress(role.ingest_token)} label="forwarding address" />
      </div>
    </div>
  );
}

function StageBar({ role }: { role: RoleWithCounts }) {
  const segments = STAGES.filter((s) => role.stage_counts[s] > 0);
  return (
    <div className="mt-4 flex h-[5px] gap-0.5 overflow-hidden rounded-sm bg-[rgba(207,212,219,0.07)]">
      {segments.map((s) => (
        <div
          key={s}
          title={`${role.stage_counts[s]} in ${s}`}
          style={{ flex: role.stage_counts[s], background: STAGE_COLOR[s] }}
        />
      ))}
    </div>
  );
}

function StatusTag({ status }: { status: "open" | "closed" }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-1 text-[9px] uppercase tracking-[0.16em] ${
        status === "open" ? "tone-positive" : "tone-neutral"
      }`}
    >
      {status}
    </span>
  );
}
