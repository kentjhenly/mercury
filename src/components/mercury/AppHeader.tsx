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
    <header className="sticky top-0 z-30 border-b border-border-soft bg-bg-deep">
      <div className="flex items-center justify-between py-3" style={{ padding: "12px clamp(20px,4vw,52px)" }}>
        <div className="flex items-center gap-5">
          {/* Wordmark + live signal dot — the top-bar "instrument on" cue. */}
          <Link href="/mercury" className="flex items-center gap-2.5" aria-label="Mercury home">
            <span className="font-mono font-medium tracking-[0.42em] text-text" style={{ fontSize: "13px" }}>MERCURY</span>
          </Link>
          {/* Plain, honest positioning — no overclaim, just the two facts */}
          <span
            className="hidden font-mono text-dim md:inline"
            style={{ fontSize: "9px", letterSpacing: ".2em" }}
          >
            BUILT FOR HONG KONG HIRING · FREE
          </span>
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
