import { STAGES } from "@/lib/mercury/stages";

export default function BoardLoading() {
  return (
    <div className="mx-auto max-w-[1600px] px-5 py-6">
      <div className="mb-4 h-6 w-48 animate-pulse rounded bg-surface-2" />
      <div className="flex gap-3 overflow-hidden">
        {STAGES.map((s) => (
          <div key={s} className="w-72 shrink-0">
            <div className="mb-2 h-5 w-24 animate-pulse rounded bg-surface-2" />
            <div className="flex flex-col gap-2.5">
              <div className="panel h-40 animate-pulse" />
              <div className="panel h-40 animate-pulse opacity-60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
