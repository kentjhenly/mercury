"use client";

import { useMemo, useState } from "react";
import { renderOfferLetter } from "@/lib/mercury/templates";

interface Props {
  candidateName: string | null;
  roleTitle: string;
  companyName: string | null;
  /** Pre-formatted salary line, or null to leave a placeholder. */
  salaryLine: string | null;
}

// Post-hire convenience: a plain templated offer-letter draft, generated and
// rendered entirely client-side for copy/download. No new deps, nothing sent —
// a useful scaffold the employer edits and issues themselves.
export function OfferLetterDraft({ candidateName, roleTitle, companyName, salaryLine }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const letter = useMemo(
    () =>
      renderOfferLetter({
        candidateName,
        roleTitle,
        companyName,
        salaryLine,
        dateLine: new Date().toLocaleDateString("en-HK", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      }),
    [candidateName, roleTitle, companyName, salaryLine]
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the textarea is selectable as a fallback */
    }
  }

  function download() {
    const safeRole = roleTitle.replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
    const blob = new Blob([letter], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `offer-letter-${safeRole || "draft"}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-border px-3 py-1.5 text-xs text-text-2 hover:border-border-strong"
      >
        Generate offer-letter draft
      </button>
    );
  }

  return (
    <div className="mt-1">
      <textarea
        readOnly
        value={letter}
        rows={12}
        onFocus={(e) => e.currentTarget.select()}
        className="tnum w-full resize-y rounded border border-border bg-bg px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-text-2 outline-none"
        aria-label="Offer letter draft"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded border border-border px-3 py-1.5 text-xs text-text-2 hover:border-border-strong"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
        <button
          type="button"
          onClick={download}
          className="rounded border border-border px-3 py-1.5 text-xs text-text-2 hover:border-border-strong"
        >
          Download .txt
        </button>
        <span className="font-mono text-[10px] tracking-wide text-dim">
          Draft — edit the [placeholders] before you send it.
        </span>
      </div>
    </div>
  );
}
