"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/auth-client";
import { initials } from "@/lib/utils/formatters";

export function AppHeader({ companyName }: { companyName: string | null }) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border-soft bg-bg-deep/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
        <div className="flex items-center gap-5">
          {/* Wordmark + live signal dot — the top-bar "instrument on" cue. */}
          <Link href="/mercury" className="flex items-center gap-2.5" aria-label="Mercury home">
            <span className="signal-dot" aria-hidden />
            <span className="text-xs font-semibold tracking-[0.42em] text-mercury">MERCURY</span>
          </Link>
          <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden />
          <Link href="/mercury" className="hidden text-xs text-muted hover:text-text sm:inline">
            Workspace
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {companyName ? (
            <div className="flex items-center gap-2.5">
              <span className="hidden text-xs text-muted sm:inline">{companyName}</span>
              <span className="avatar-tile size-7 text-[11px] font-semibold" aria-hidden>
                {initials(companyName, null)}
              </span>
            </div>
          ) : null}
          <button
            onClick={handleSignOut}
            className="rounded border border-border px-3 py-1.5 text-xs text-text-2 hover:border-border-strong"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
