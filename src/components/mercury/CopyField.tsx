"use client";

import { useState } from "react";

export function CopyField({
  value,
  label,
  variant = "field",
}: {
  value: string;
  label?: string;
  variant?: "field" | "chip";
}) {
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

  if (variant === "chip") {
    return (
      <button
        onClick={copy}
        aria-label={label ? `Copy ${label}` : "Copy"}
        title="Click to copy"
        className="inline-flex max-w-full items-center font-mono"
        style={{
          gap: "7px",
          background: "rgba(0,0,0,.3)",
          border: "1px solid rgba(207,212,219,.08)",
          borderRadius: "6px",
          padding: "5px 9px",
          fontSize: "11px",
          color: "#9aa0aa",
          transition: "border-color .2s, color .2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(207,212,219,.2)";
          (e.currentTarget as HTMLElement).style.color = "#d7dbe1";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(207,212,219,.08)";
          (e.currentTarget as HTMLElement).style.color = "#9aa0aa";
        }}
      >
        <span style={{ color: "#565c66", flexShrink: 0 }}>↳</span>
        <span className="truncate">{copied ? "Copied" : value}</span>
      </button>
    );
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

