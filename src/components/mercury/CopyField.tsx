"use client";

import { useState } from "react";

export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable — value is still selectable */
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="tnum flex-1 truncate rounded border border-border-soft bg-bg px-2.5 py-1.5 text-xs text-text-2">
        {value}
      </code>
      <button
        onClick={copy}
        className="rounded border border-border px-2.5 py-1.5 text-[11px] text-muted hover:border-border-strong hover:text-text-2"
        aria-label={label ? `Copy ${label}` : "Copy"}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
