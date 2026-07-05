import Link from "next/link";
import { requireOwnerId } from "@/lib/mercury/owner";
import { listRoles, type RoleWithCounts } from "@/lib/mercury/data";
import { getResponseRate, type ResponseRateStats } from "@/lib/mercury/responseRate";
import { forwardingAddress } from "@/lib/mercury/ingest";
import { STAGES, STAGE_COLOR } from "@/lib/mercury/stages";
import { CreateRoleForm } from "@/components/mercury/CreateRoleForm";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const ownerId = await requireOwnerId();
  const [roles, rate] = await Promise.all([listRoles(ownerId), getResponseRate(ownerId)]);

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
          <ResponseRateReadout stats={rate} />
        </div>
        <MetricsBlock roles={roles.length} applicants={gTotal} owed={gOwed} />
      </div>

      {/* Role grid */}
      <div className="grid gap-[18px] sm:grid-cols-2">
        {roles.map((role) => (
          <RoleCard key={role.id} role={role} />
        ))}
        <CreateRoleForm variant="card" />
      </div>

      {roles.length === 0 && (
        <p className="mt-6 max-w-md text-xs text-muted">
          Create your first role to get a private forwarding address. Forward a few real applicant
          emails and watch them land on the board as uniform cards — the original CV and email always
          attached. Built for Hong Kong hiring — free, with HK salary context so you know what roles
          really pay before you offer.
        </p>
      )}
    </main>
  );
}

// The employer's own response rate — a professionalism instrument, framed as a
// benefit (responsive employers close candidates faster), never a scold. Hidden
// until there's something to measure.
function ResponseRateReadout({ stats }: { stats: ResponseRateStats }) {
  if (stats.ratePct === null) return null;
  const med = stats.medianFirstResponseHours;
  const medLabel =
    med === null ? null : med < 48 ? `${Math.round(med)}h` : `${Math.round(med / 24)}d`;
  return (
    <div
      className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px]"
      title="Share of applicants you've engaged (past 'New') who've received at least one reply."
    >
      <span style={{ letterSpacing: "0.14em", color: "var(--dim)" }}>RESPONSE RATE</span>
      <span
        className="tnum font-semibold"
        style={{ color: stats.ratePct >= 80 ? "var(--positive)" : "var(--text-2)" }}
      >
        {stats.ratePct}%
      </span>
      {medLabel && (
        <>
          <span style={{ color: "var(--dim)" }}>·</span>
          <span className="tnum text-muted">median {medLabel}</span>
        </>
      )}
      <span className="text-dim">· candidates accept faster from responsive employers</span>
    </div>
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
  const email = forwardingAddress(role.ingest_token);
  return (
    <Link href={`/mercury/roles/${role.id}`} className="panel rise group flex flex-col p-[22px] pb-[18px]">
      {/* Title + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold tracking-tight text-text group-hover:text-signal">
            {role.title}
          </div>
          {role.location && <div className="mt-1 truncate text-[13px] text-muted">{role.location}</div>}
        </div>
        <StatusTag status={role.status} />
      </div>

      {/* Forwarding address — display only; copy it from the role board */}
      <div
        style={{
          marginTop: "16px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "11px",
          background: "rgba(0,0,0,.3)",
          border: "1px solid rgba(207,212,219,.08)",
          borderRadius: "6px",
          padding: "8px 10px",
          overflow: "hidden",
        }}
      >
        <span style={{ color: "var(--dim)", flexShrink: 0 }}>↳</span>
        <span style={{ color: "#9aa0aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {email}
        </span>
      </div>

      {/* Stage bar — factual per-stage breakdown, never a ranking */}
      <StageBar role={role} />

      <div className="mt-[14px] flex items-end justify-between">
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
  );
}

function StageBar({ role }: { role: RoleWithCounts }) {
  const segments = STAGES.filter((s) => role.stage_counts[s] > 0);
  return (
    <div className="mt-[18px] flex h-[5px] gap-0.5 overflow-hidden rounded-sm bg-[rgba(207,212,219,0.07)]">
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
  if (status === "open") {
    return (
      <span
        style={{
          flexShrink: 0,
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "9px",
          letterSpacing: ".16em",
          color: "#6f9d82",
          border: "1px solid rgba(111,157,130,.3)",
          borderRadius: "5px",
          padding: "4px 7px",
        }}
      >
        OPEN
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded px-1.5 py-1 text-[9px] uppercase tracking-[0.16em] tone-negative">
      {status}
    </span>
  );
}
